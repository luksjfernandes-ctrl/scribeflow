import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { SaveQueue, mergeServerDocs, unloadVersionFilter, writtenDuringFetch } from '../src/lib/persistence.ts'
import { makeDocWriter, type DbResult, type DocRow } from '../src/lib/docWriter.ts'
import { baseFromRow, type DocBase } from '../src/lib/conflict.ts'
import { readDrafts, recoverySnapshot, saveDraft } from '../src/lib/drafts.ts'
import { SESSION_LOST } from '../src/lib/limits.ts'
import type { Doc, DocumentMetadata } from '../src/types.ts'

/**
 * Duas abas (ou dois aparelhos) escrevendo no mesmo capitulo, com o codigo de
 * gravacao do app (lib/docWriter.ts + SaveQueue) contra um banco em memoria
 * que filtra como o PostgREST (id, project_id, updated_at). A regra que todos
 * os casos conferem: nenhum texto some; o que perde a disputa vira snapshot.
 */

const meta = (over: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  status: 'To Do', label: 'none', label_color: 'transparent', synopsis: '', notes: '', target_word_count: 0,
  is_include_in_compile: true, section_type: 'Scene', created_at: 1, updated_at: 1, keywords: [],
  custom_metadata: {}, snapshots: [], comments: [], bookmarks: [], ...over,
})

type Row = { id: string; project_id: string; title: string; content: string; metadata: DocumentMetadata; updated_at: number }

class BancoEmMemoria {
  rows = new Map<string, Row>()
  sessao = true
  constructor(row: Row) { this.rows.set(row.id, structuredClone(row)) }
  get(id: string): Row { return structuredClone(this.rows.get(id)!) }
  /** UPDATE ... WHERE id AND project_id [AND updated_at] — sem sessao, a RLS casa 0 linhas. */
  update(id: string, projectId: string, body: Record<string, unknown>, versoes?: number[]): DbResult<Array<{ id: string }>> {
    const row = this.rows.get(id)
    if (!this.sessao || !row || row.project_id !== projectId) return { data: [], error: null }
    if (versoes && !versoes.includes(row.updated_at)) return { data: [], error: null }
    Object.assign(row, structuredClone(body))
    return { data: [{ id }], error: null }
  }
  read(id: string, projectId: string): DbResult<DocRow> {
    const row = this.rows.get(id)
    if (!this.sessao || !row || row.project_id !== projectId) return { data: null, error: null }
    const { title, content, metadata, updated_at } = structuredClone(row)
    return { data: { title, content, metadata, updated_at }, error: null }
  }
}

/** Uma aba: estado local, base da gravacao condicional, fila e relogio proprios. */
function aba(banco: BancoEmMemoria, relogio: { t: number }) {
  const inicial = banco.get('cap')
  let docs: Doc[] = [{ id: 'cap', title: inicial.title, content: inicial.content, type: 'text', parent_id: null, order: 0, metadata: inicial.metadata }]
  const bases = new Map<string, DocBase>([['cap', baseFromRow(inicial)]])
  let seq = 0
  const confirmados = new Map<string, number>()
  const queue = new SaveQueue({
    getDoc: (id) => docs.find((d) => d.id === id),
    write: makeDocWriter({
      update: async (docId, projectId, body, expectedAt) => banco.update(docId, projectId, body, expectedAt === undefined ? undefined : [expectedAt]),
      read: async (docId, projectId) => banco.read(docId, projectId),
      hasSession: async () => banco.sessao,
      getBase: (id) => bases.get(id),
      setBase: (id, b) => { bases.set(id, b) },
      localMetadata: (id) => docs.find((d) => d.id === id)?.metadata,
      updateLocalMetadata: (id, fn) => { docs = docs.map((d) => (d.id === id ? { ...d, metadata: fn(d.metadata) } : d)) },
      markConfirmed: (id) => { confirmados.set(id, ++seq) },
      newId: () => `snap-${relogio.t}`,
      now: () => relogio.t,
      stamp: () => '10/10 10:00',
    }),
    now: () => relogio.t,
    setTimer: () => 0, // o teste decide quando gravar
    clearTimer: () => {},
  })
  return {
    queue,
    bases,
    get docs() { return docs },
    set docs(v: Doc[]) { docs = v },
    get seq() { return seq },
    confirmados,
    escreve(content: string) {
      docs = docs.map((d) => (d.id === 'cap' ? { ...d, content } : d))
      queue.enqueue('cap', 'p1', { fields: { content } })
    },
    mudaStatus(status: string) {
      docs = docs.map((d) => (d.id === 'cap' ? { ...d, metadata: { ...d.metadata, status } } : d))
      queue.enqueue('cap', 'p1', { metadataPatch: { status } })
    },
  }
}

const novoBanco = () => new BancoEmMemoria({ id: 'cap', project_id: 'p1', title: 'Capítulo 1', content: '<p>base</p>', metadata: meta(), updated_at: 100 })
const textosNoBanco = (b: BancoEmMemoria) => {
  const r = b.get('cap')
  return [r.content, ...(r.metadata.snapshots || []).map((s) => s.content)]
}

test('duas abas no mesmo capitulo: o ultimo vence e o outro texto vira snapshot', async () => {
  const banco = novoBanco()
  const A = aba(banco, { t: 1000 })
  const B = aba(banco, { t: 900 }) // relogio de B atrasado em relacao ao de A
  A.escreve('<p>texto de A</p>')
  B.escreve('<p>texto de B</p>')
  await A.queue.flush()
  await B.queue.flush()

  assert.equal(banco.get('cap').content, '<p>texto de B</p>')
  assert.ok(textosNoBanco(banco).includes('<p>texto de A</p>'), 'o texto de A ficou como snapshot')
  assert.equal(A.queue.status(), 'saved')
  assert.equal(B.queue.status(), 'saved')
})

test('outra aba muda so o status: o texto desta aba grava sem snapshot e o status fica', async () => {
  const banco = novoBanco()
  const A = aba(banco, { t: 1000 })
  const B = aba(banco, { t: 1100 })
  A.escreve('<p>texto de A</p>')
  B.mudaStatus('Done')
  await B.queue.flush()
  await A.queue.flush()

  const r = banco.get('cap')
  assert.equal(r.content, '<p>texto de A</p>')
  assert.equal(r.metadata.status, 'Done')
  assert.equal((r.metadata.snapshots || []).length, 0)
})

test('fechar a aba depois que a outra gravou: nao sobrescreve e o texto volta como snapshot', async () => {
  const banco = novoBanco()
  const storage = new Map<string, string>()
  const ls = {
    get length() { return storage.size },
    key: (i: number) => [...storage.keys()][i] ?? null,
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, v) },
    removeItem: (k: string) => { storage.delete(k) },
  }
  const A = aba(banco, { t: 1000 })
  const B = aba(banco, { t: 1100 })
  B.escreve('<p>texto de B</p>')
  await B.queue.flush()
  A.escreve('<p>ultimo paragrafo de A</p>')

  // pagehide da aba A: rascunho primeiro, depois o PATCH condicional (keepalive).
  A.queue.drainForUnload((docId, projectId, payload) => {
    saveDraft(ls, { userId: 'u1', docId, projectId, payload, at: 1000 })
    const filtro = unloadVersionFilter(A.bases.get(docId)?.updatedAt, A.queue.ownWriteStamps(docId))
    const versoes = filtro ? filtro.slice(4, -1).split(',').map(Number) : undefined
    banco.update(docId, projectId, payload, versoes)
    return true
  })
  assert.equal(banco.get('cap').content, '<p>texto de B</p>', 'o texto de B continua')

  // Proxima abertura do livro: o rascunho vira snapshot.
  const [draft] = readDrafts(ls, 'u1', 'p1', 2000)
  const snap = recoverySnapshot(banco.get('cap'), draft, 'rec')
  assert.equal(snap?.content, '<p>ultimo paragrafo de A</p>')
  assert.equal(snap?.title, 'Capítulo 1 (não salvo ao fechar)')
})

test('fechar a aba sem disputa: o PATCH grava e o rascunho nao vira snapshot', async () => {
  const banco = novoBanco()
  const A = aba(banco, { t: 1000 })
  A.escreve('<p>texto de A</p>')
  let draftPayload: Record<string, unknown> = {}
  A.queue.drainForUnload((docId, projectId, payload) => {
    draftPayload = payload
    const filtro = unloadVersionFilter(A.bases.get(docId)?.updatedAt, A.queue.ownWriteStamps(docId))
    banco.update(docId, projectId, payload, filtro!.slice(4, -1).split(',').map(Number))
    return true
  })
  assert.equal(banco.get('cap').content, '<p>texto de A</p>')
  assert.equal(recoverySnapshot(banco.get('cap'), { userId: 'u1', docId: 'cap', projectId: 'p1', payload: draftPayload, at: 1 }, 'x'), null)
})

test('sessao caiu: a edicao fica guardada, nao e descartada, e vira rascunho na troca de conta', async () => {
  const banco = novoBanco()
  const A = aba(banco, { t: 1000 })
  banco.sessao = false
  A.escreve('<p>escrito sem sessao</p>')
  await A.queue.flush()
  assert.equal(A.queue.heldError(), SESSION_LOST)
  assert.equal(A.queue.hasUnsaved(), true)

  const [pendente] = A.queue.takeAll()
  assert.equal(pendente.payload.content, '<p>escrito sem sessao</p>')
  assert.equal(banco.get('cap').content, '<p>base</p>')
})

test('releitura que comecou antes da propria gravacao nao volta o editor', async () => {
  const banco = novoBanco()
  const A = aba(banco, { t: 1000 })
  const inicioDoFetch = A.seq
  const respostaVelha = banco.get('cap') // SELECT lido antes do UPDATE
  A.escreve('<p>acabei de escrever</p>')
  await A.queue.flush()

  const stale = writtenDuringFetch(A.confirmados.get('cap'), inicioDoFetch)
  assert.equal(stale, true)
  const servidor: Doc = { id: 'cap', title: respostaVelha.title, content: respostaVelha.content, type: 'text', parent_id: null, order: 0, metadata: respostaVelha.metadata }
  A.docs = mergeServerDocs(A.docs, [servidor], () => new Set(), () => stale)
  assert.equal(A.docs[0].content, '<p>acabei de escrever</p>')
})
