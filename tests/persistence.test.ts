import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  SaveQueue,
  mergeServerDocs,
  shouldRefetchOnRealtime,
  type SaveStatus,
  type WriteResult,
} from '../src/lib/persistence.ts'
import type { Doc, DocumentMetadata } from '../src/types.ts'

/**
 * Regras da camada de persistencia do editor (src/lib/persistence.ts).
 * Cada teste corresponde a um jeito concreto de o subtitulo, o titulo ou o
 * corpo "voltarem sozinhos" ou se perderem, relatado em 26/09/2026.
 */

const meta = (over: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  status: 'To Do',
  label: 'none',
  label_color: 'transparent',
  synopsis: '',
  notes: '',
  target_word_count: 0,
  is_include_in_compile: true,
  section_type: 'Scene',
  created_at: 1,
  updated_at: 1,
  keywords: [],
  custom_metadata: {},
  snapshots: [],
  comments: [],
  bookmarks: [],
  ...over,
})

const doc = (id: string, over: Partial<Doc> = {}): Doc => ({
  id,
  title: `Doc ${id}`,
  content: '<p></p>',
  type: 'text',
  parent_id: null,
  order: 0,
  metadata: meta(),
  ...over,
})

interface Call {
  docId: string
  projectId: string
  payload: Record<string, unknown>
}

/** Fila com timers manuais e escrita falsa controlada pelo teste. */
function setup(opts: { docs?: Doc[]; results?: WriteResult[] } = {}) {
  let docs = opts.docs ?? [doc('a'), doc('b')]
  const calls: Call[] = []
  const results = [...(opts.results ?? [])]
  const statuses: SaveStatus[] = []
  const timers: Array<{ fn: () => void; ms: number } | null> = []
  let clock = 1000
  let release: (() => void) | null = null
  let gate: Promise<void> | null = null

  const queue = new SaveQueue({
    getDoc: (id) => docs.find((d) => d.id === id),
    write: async (docId, projectId, payload) => {
      calls.push({ docId, projectId, payload })
      if (gate) await gate
      return results.shift() ?? { ok: true }
    },
    onStatus: (s) => statuses.push(s),
    now: () => clock,
    setTimer: (fn, ms) => {
      timers.push({ fn, ms })
      return timers.length - 1
    },
    clearTimer: (h) => {
      timers[h as number] = null
    },
  })

  return {
    queue,
    calls,
    statuses,
    timers,
    setDocs: (next: Doc[]) => {
      docs = next
    },
    tick: (ms = 1) => {
      clock += ms
    },
    hold: () => {
      gate = new Promise((r) => {
        release = () => {
          gate = null
          r()
        }
      })
    },
    release: () => release?.(),
  }
}

test('metadata e montado na hora de gravar, sem depender do updater do setDocs', async () => {
  // Estado local ainda SEM o subtitulo (o updater do React nao rodou).
  const t = setup({ docs: [doc('a', { metadata: meta({ synopsis: 'sinopse' }) })] })
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 'Epigrafe' } })
  await t.queue.flush()

  assert.equal(t.calls.length, 1)
  const sent = t.calls[0].payload.metadata as DocumentMetadata
  assert.equal(sent.subtitle, 'Epigrafe')
  assert.equal(sent.synopsis, 'sinopse', 'nao pode apagar os outros campos do metadata')
})

test('varias edicoes seguidas viram uma gravacao com o ultimo valor de cada campo', async () => {
  const t = setup()
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 'E' } })
  t.queue.enqueue('a', 'p1', { fields: { content: '<p>corpo</p>' } })
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 'Epi' } })
  await t.queue.flush()

  assert.equal(t.calls.length, 1)
  assert.equal(t.calls[0].payload.content, '<p>corpo</p>')
  assert.equal((t.calls[0].payload.metadata as DocumentMetadata).subtitle, 'Epi')
})

test('cada entrada grava no projeto em que foi editada, mesmo apos trocar de projeto', async () => {
  const t = setup()
  t.queue.enqueue('a', 'projeto-A', { fields: { title: 'Cap 1' } })
  t.setDocs([]) // trocou de projeto: o doc saiu do estado local
  await t.queue.flush()

  assert.equal(t.calls[0].projectId, 'projeto-A')
})

test('falha de rede volta para a fila e nao marca "salvo"', async () => {
  const t = setup({ results: [{ ok: false, retry: true, error: 'network' }] })
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 'X' } })
  await t.queue.flush()

  assert.equal(t.queue.status(), 'error')
  assert.equal(t.queue.hasUnsaved(), true)
  assert.ok(t.timers.some((x) => x && x.ms === 5000), 'agenda nova tentativa')

  await t.queue.flush()
  assert.equal(t.calls.length, 2)
  assert.equal((t.calls[1].payload.metadata as DocumentMetadata).subtitle, 'X')
  assert.equal(t.queue.status(), 'saved')
})

test('update que casa 0 linhas vira erro visivel e nao fica em loop', async () => {
  const t = setup({ results: [{ ok: false, retry: false, error: '0 linhas' }] })
  t.queue.enqueue('a', 'p1', { fields: { title: 'T' } })
  await t.queue.flush()

  assert.equal(t.queue.status(), 'error')
  assert.equal(t.queue.hasUnsaved(), false)
  assert.equal(t.timers.filter(Boolean).length, 0)
})

test('reenfileirar uma falha nao passa por cima de edicao feita durante o await', async () => {
  const t = setup({ results: [{ ok: false, retry: true }] })
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 'velho' } })
  t.hold()
  const flushing = t.queue.flush()
  await Promise.resolve()
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 'novo' } })
  t.release()
  await flushing
  await t.queue.flush()

  const last = t.calls[t.calls.length - 1].payload.metadata as DocumentMetadata
  assert.equal(last.subtitle, 'novo')
})

test('status fica "pending" enquanto houver gravacao em voo ou edicao nova', async () => {
  const t = setup()
  t.queue.enqueue('a', 'p1', { fields: { content: '<p>1</p>' } })
  assert.equal(t.queue.status(), 'pending')
  t.hold()
  const flushing = t.queue.flush()
  await Promise.resolve()
  t.queue.enqueue('a', 'p1', { fields: { content: '<p>12</p>' } })
  t.release()
  await flushing
  assert.equal(t.queue.status(), 'pending', 'a edicao nova ainda nao foi gravada')
  await t.queue.flush()
  assert.equal(t.queue.status(), 'saved')
})

test('flushes nao se cruzam: o segundo espera o primeiro terminar', async () => {
  const t = setup()
  t.queue.enqueue('a', 'p1', { fields: { content: 'v1' } })
  t.hold()
  const first = t.queue.flush()
  await Promise.resolve()
  t.queue.enqueue('a', 'p1', { fields: { content: 'v2' } })
  const second = t.queue.flush()
  await Promise.resolve()
  assert.equal(t.calls.length, 1, 'v2 nao pode sair antes de v1 terminar')
  t.release()
  await Promise.all([first, second])
  assert.deepEqual(
    t.calls.map((c) => c.payload.content),
    ['v1', 'v2'],
  )
})

test('eco da propria gravacao e reconhecido pelo updated_at enviado', async () => {
  const t = setup()
  t.queue.enqueue('a', 'p1', { fields: { title: 'T' } })
  await t.queue.flush()
  const sentAt = t.calls[0].payload.updated_at

  assert.equal(t.queue.isOwnEcho('a', sentAt), true)
  assert.equal(t.queue.isOwnEcho('a', 999), false)
  assert.equal(t.queue.isOwnEcho('b', sentAt), false)
})

test('duas gravacoes no mesmo milissegundo recebem updated_at distintos', async () => {
  const t = setup()
  t.queue.enqueue('a', 'p1', { fields: { title: '1' } })
  await t.queue.flush()
  t.queue.enqueue('a', 'p1', { fields: { title: '2' } })
  await t.queue.flush()
  assert.notEqual(t.calls[0].payload.updated_at, t.calls[1].payload.updated_at)
})

test('realtime: eco proprio nao refaz o fetch; mudanca de outra aba refaz', () => {
  const own = (id: string, at: unknown) => id === 'a' && at === 1234
  assert.equal(shouldRefetchOnRealtime({ eventType: 'UPDATE', new: { id: 'a', updated_at: 1234 } }, own), false)
  assert.equal(shouldRefetchOnRealtime({ eventType: 'UPDATE', new: { id: 'a', updated_at: 5678 } }, own), true)
  assert.equal(shouldRefetchOnRealtime({ eventType: 'UPDATE', new: { id: 'a' } }, own), true, 'sem updated_at, refaz por seguranca')
  assert.equal(shouldRefetchOnRealtime({ eventType: 'INSERT', new: { id: 'c', updated_at: 1234 } }, own), true)
  assert.equal(shouldRefetchOnRealtime({ eventType: 'DELETE', new: null }, own), true)
})

test('merge: campo com edicao pendente fica com o valor local, em qualquer doc', () => {
  const local = [
    doc('a', { title: 'Titulo local', metadata: meta({ subtitle: 'Subtitulo digitado' }) }),
    doc('b', { content: '<p>corpo local</p>' }),
  ]
  const server = [
    doc('a', { title: 'Titulo do banco', metadata: meta({ subtitle: '' }) }),
    doc('b', { content: '<p>corpo velho</p>', title: 'Titulo novo de outra aba' }),
  ]
  const dirty = (id: string) => new Set(id === 'a' ? ['metadata'] : id === 'b' ? ['content'] : [])
  const merged = mergeServerDocs(local, server, dirty)

  assert.equal(merged[0].metadata.subtitle, 'Subtitulo digitado')
  assert.equal(merged[0].title, 'Titulo do banco', 'campo sem edicao local aceita o do banco')
  assert.equal(merged[1].content, '<p>corpo local</p>')
  assert.equal(merged[1].title, 'Titulo novo de outra aba')
})

test('merge: sem edicao pendente, o banco manda; inserts e deletes remotos entram', () => {
  const local = [doc('a', { title: 'velho' }), doc('apagado')]
  const server = [doc('a', { title: 'novo' }), doc('inserido')]
  const merged = mergeServerDocs(local, server, () => new Set())

  assert.deepEqual(
    merged.map((d) => [d.id, d.title]),
    [
      ['a', 'novo'],
      ['inserido', 'Doc inserido'],
    ],
  )
})

test('fila expõe os campos sujos (pendentes e em voo) para o merge', async () => {
  const t = setup()
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 's' } })
  assert.deepEqual([...t.queue.dirtyFields('a')], ['metadata'])
  t.hold()
  const flushing = t.queue.flush()
  await Promise.resolve()
  t.queue.enqueue('a', 'p1', { fields: { content: 'c' } })
  assert.deepEqual([...t.queue.dirtyFields('a')].sort(), ['content', 'metadata'], 'em voo + pendente')
  t.release()
  await flushing
  assert.deepEqual([...t.queue.dirtyFields('a')], ['content'])
  await t.queue.flush()
  assert.equal(t.queue.dirtyFields('a').size, 0)
})

test('descarga da pagina: o que esta pendente ou em voo sai pelo envio sincrono', async () => {
  const t = setup({ docs: [doc('a', { metadata: meta({ synopsis: 'sinopse' }) }), doc('b')] })
  t.queue.enqueue('a', 'p1', { fields: { content: '<p>em voo</p>' } })
  t.hold()
  void t.queue.flush() // o fetch normal fica pendurado, como na descarga
  await Promise.resolve()
  t.queue.enqueue('a', 'p1', { metadataPatch: { subtitle: 'Epigrafe' } })
  t.queue.enqueue('b', 'p2', { fields: { title: 'Cap B' } })

  const sent: Call[] = []
  const ids = t.queue.drainForUnload((docId, projectId, payload) => {
    sent.push({ docId, projectId, payload })
    return true
  })

  assert.deepEqual(ids.sort(), ['a', 'b'])
  const a = sent.find((c) => c.docId === 'a')!
  assert.equal(a.projectId, 'p1')
  assert.equal(a.payload.content, '<p>em voo</p>', 'o que estava em voo nao pode se perder')
  const m = a.payload.metadata as DocumentMetadata
  assert.equal(m.subtitle, 'Epigrafe')
  assert.equal(m.synopsis, 'sinopse')
  assert.equal(sent.find((c) => c.docId === 'b')!.projectId, 'p2')
  assert.ok(t.queue.isOwnEcho('a', a.payload.updated_at), 'o eco do envio da descarga tambem e reconhecido')
  assert.ok(t.queue.hasUnsaved(), 'a fila nao muda: se a pagina sobreviver, o flush normal regrava')
  t.release()
})

test('descarga da pagina sem nada pendente nao envia nada', () => {
  const t = setup()
  assert.deepEqual(t.queue.drainForUnload(() => true), [])
})
