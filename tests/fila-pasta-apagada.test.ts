// Doc movido para uma pasta que outro aparelho apagou de vez: o UPDATE com o
// parent_id esbarra na chave estrangeira (23503). A fila juntava o parent_id
// em toda gravacao seguinte e reenviava para sempre; o texto nunca gravava.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { SaveQueue } from '../src/lib/persistence'
import { makeDocWriter } from '../src/lib/docWriter'

type Linha = { id: string; parent_id: string | null; order: number; title: string; content: string; metadata: Record<string, unknown>; updated_at: number }

function cenario() {
  // Banco com chave estrangeira em parent_id. A pasta F ja foi apagada.
  const banco = new Map<string, Linha>([
    ['M', { id: 'M', parent_id: null, order: 0, title: 'Manuscrito', content: '', metadata: {}, updated_at: 1 }],
    ['X', { id: 'X', parent_id: 'M', order: 0, title: 'Cap X', content: '<p>v1</p>', metadata: {}, updated_at: 1 }],
  ])
  const local = [...banco.values()].map((r) => ({ ...r }))
  const bases = new Map([['X', { updatedAt: 1, title: 'Cap X', content: '<p>v1</p>', metadata: {} }]])
  const avisos: string[] = []
  const write = makeDocWriter({
    update: async (id, _p, body, expectedAt) => {
      const row = banco.get(id)
      if (!row || (expectedAt !== undefined && row.updated_at !== expectedAt)) return { data: [], error: null }
      if ('parent_id' in body && body.parent_id !== null && !banco.has(body.parent_id as string)) {
        return { data: null, error: { code: '23503', message: 'insert or update on table "docs" violates foreign key constraint "docs_parent_id_fkey"' } }
      }
      Object.assign(row, body)
      return { data: [{ id }], error: null }
    },
    read: async (id) => ({ data: (banco.get(id) as never) ?? null, error: null }),
    hasSession: async () => true,
    getBase: (id) => bases.get(id) as never,
    setBase: (id, b) => bases.set(id, b as never),
    localMetadata: (id) => local.find((d) => d.id === id)?.metadata as never,
    updateLocalMetadata: () => {},
    markConfirmed: () => {},
    newId: () => 'snap',
    now: () => 1000,
    stamp: () => '03/11 10:00',
    warn: (m) => avisos.push(m),
  })
  const q = new SaveQueue({
    write,
    getDoc: (id) => local.find((d) => d.id === id) as never,
    setTimer: () => 0,
    clearTimer: () => {},
  })
  return { banco, q, avisos }
}

test('o texto grava mesmo com a pasta de destino apagada; a mudanca de pasta e descartada', async () => {
  const { banco, q, avisos } = cenario()
  // Aparelho desatualizado: devolve X da lixeira para a pasta F, que nao existe mais.
  q.enqueue('X', 'P', { fields: { parent_id: 'F', order: 0 } })
  q.enqueue('X', 'P', { fields: { content: '<p>capitulo reescrito</p>', updated_at: 2 } as never })
  await q.flush()
  assert.equal(banco.get('X')!.content, '<p>capitulo reescrito</p>')
  assert.equal(banco.get('X')!.parent_id, 'M', 'o doc fica onde o banco tem')
  assert.equal(q.status(), 'saved')
  assert.equal(q.hasUnsaved(), false)
  assert.match(avisos.join('\n'), /pasta de destino/)
})

test('so a mudanca de pasta: sai da fila sem erro preso', async () => {
  const { banco, q } = cenario()
  q.enqueue('X', 'P', { fields: { parent_id: 'F', order: 3 } })
  await q.flush()
  assert.equal(banco.get('X')!.parent_id, 'M')
  assert.equal(q.status(), 'saved')
  // Edicao seguinte grava normalmente.
  q.enqueue('X', 'P', { fields: { title: 'Cap X revisto' } })
  await q.flush()
  assert.equal(banco.get('X')!.title, 'Cap X revisto')
})

test('mover para uma pasta que existe continua gravando a pasta', async () => {
  const { q } = cenario()
  q.enqueue('X', 'P', { fields: { parent_id: 'M', order: 1 } })
  // pasta existente: grava
  await q.flush()
  assert.equal(q.status(), 'saved')
})
