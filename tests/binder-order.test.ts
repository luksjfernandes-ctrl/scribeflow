import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Doc } from '../src/types.ts'
import {
  applyOrderUpdates,
  getDropPosition,
  getSortedChildren,
  nextOrder,
  planDrop,
} from '../src/lib/binderOrder.ts'

/**
 * Lógica do arrastar e soltar do Binder: cada drop tem que deixar os irmãos
 * de origem e de destino com `order` 0..n-1, sem repetição nem buraco.
 */

const doc = (id: string, parent_id: string | null, order: number, extra: Partial<Doc> = {}): Doc =>
  ({
    id,
    title: id,
    content: '',
    type: 'text',
    parent_id,
    order,
    metadata: { created_at: 0 },
    ...extra,
  }) as unknown as Doc

const folder = (id: string, parent_id: string | null, order: number, role?: string): Doc =>
  doc(id, parent_id, order, { type: role === 'trash' ? 'trash' : 'folder', metadata: { created_at: 0, folder_role: role } as Doc['metadata'] })

// Manuscript com 6 capítulos (c1..c6), uma parte (p1) com 2 cenas e a lixeira.
const base = (): Doc[] => [
  folder('man', null, 0, 'manuscript'),
  folder('trash', null, 1, 'trash'),
  doc('c1', 'man', 0),
  doc('c2', 'man', 1),
  doc('c3', 'man', 2),
  doc('c4', 'man', 3),
  doc('c5', 'man', 4),
  doc('c6', 'man', 5),
  folder('p1', 'man', 6),
  doc('s1', 'p1', 0),
  doc('s2', 'p1', 1),
]

const titlesIn = (docs: Doc[], parent: string | null) => getSortedChildren(docs, parent).map((d) => d.id)
const ordersIn = (docs: Doc[], parent: string | null) => getSortedChildren(docs, parent).map((d) => d.order)

const drop = (docs: Doc[], a: string, t: string, p: 'before' | 'after' | 'inside') => {
  const updates = planDrop(docs, a, t, p)
  assert.ok(updates, `drop ${a} -> ${t} (${p}) deveria ser válido`)
  return applyOrderUpdates(docs, updates)
}

test('desce um capítulo no mesmo nível e reindexa todos', () => {
  const after = drop(base(), 'c1', 'c4', 'after')
  assert.deepEqual(titlesIn(after, 'man'), ['c2', 'c3', 'c4', 'c1', 'c5', 'c6', 'p1'])
  assert.deepEqual(ordersIn(after, 'man'), [0, 1, 2, 3, 4, 5, 6])
})

test('sobe um capítulo no mesmo nível', () => {
  const after = drop(base(), 'c5', 'c2', 'before')
  assert.deepEqual(titlesIn(after, 'man'), ['c1', 'c5', 'c2', 'c3', 'c4', 'c6', 'p1'])
})

test('grava só quem mudou', () => {
  const updates = planDrop(base(), 'c2', 'c1', 'before')!
  assert.deepEqual(updates.map((u) => u.id).sort(), ['c1', 'c2'])
})

test('soltar no mesmo lugar não gera escrita', () => {
  assert.deepEqual(planDrop(base(), 'c2', 'c1', 'after'), [])
  assert.deepEqual(planDrop(base(), 'c2', 'c3', 'before'), [])
})

test('soltar sobre si mesmo é ignorado', () => {
  assert.equal(planDrop(base(), 'c3', 'c3', 'before'), null)
})

test('soltar em cima de pasta entra no fim dela e fecha o buraco na origem', () => {
  const after = drop(base(), 'c2', 'p1', 'inside')
  assert.deepEqual(titlesIn(after, 'p1'), ['s1', 's2', 'c2'])
  assert.deepEqual(ordersIn(after, 'p1'), [0, 1, 2])
  assert.deepEqual(titlesIn(after, 'man'), ['c1', 'c3', 'c4', 'c5', 'c6', 'p1'])
  assert.deepEqual(ordersIn(after, 'man'), [0, 1, 2, 3, 4, 5])
})

test('reordena pastas entre si (antes/depois) sem aninhar', () => {
  const docs = [...base(), folder('p2', 'man', 7)]
  const after = drop(docs, 'p2', 'p1', 'before')
  assert.deepEqual(titlesIn(after, 'man').slice(-2), ['p2', 'p1'])
  assert.equal(after.find((d) => d.id === 'p2')!.parent_id, 'man')
})

test('move entre pastas na posição do alvo, não no fim', () => {
  const after = drop(base(), 'c3', 's1', 'after')
  assert.deepEqual(titlesIn(after, 'p1'), ['s1', 'c3', 's2'])
  assert.deepEqual(ordersIn(after, 'p1'), [0, 1, 2])
  assert.deepEqual(ordersIn(after, 'man'), [0, 1, 2, 3, 4, 5])
})

test('tira uma cena da pasta e põe antes de um capítulo', () => {
  const after = drop(base(), 's2', 'c1', 'before')
  assert.deepEqual(titlesIn(after, 'man')[0], 's2')
  assert.equal(after.find((d) => d.id === 's2')!.parent_id, 'man')
  assert.deepEqual(titlesIn(after, 'p1'), ['s1'])
})

test('mover para a raiz usa null, nunca string vazia', () => {
  const docs = [...base(), folder('g1', null, 2)]
  const updates = planDrop(docs, 'c1', 'g1', 'after')!
  assert.equal(updates.find((u) => u.id === 'c1')!.parent_id, null)
})

test('pasta não entra nela mesma nem num descendente', () => {
  const docs = [...base(), folder('p2', 'p1', 2), doc('s3', 'p2', 0)]
  assert.equal(planDrop(docs, 'p1', 'p2', 'inside'), null)
  assert.equal(planDrop(docs, 'p1', 's3', 'before'), null)
})

test('pastas estruturais não se movem e lixeira não recebe arraste', () => {
  assert.equal(planDrop(base(), 'man', 'trash', 'before'), null)
  assert.equal(planDrop(base(), 'c1', 'trash', 'inside'), null)
})

test('texto não aceita "dentro"', () => {
  assert.equal(planDrop(base(), 'c1', 'c2', 'inside'), null)
})

test('order repetido do legado vira sequência limpa no primeiro arraste', () => {
  const docs = [folder('man', null, 0, 'manuscript'), doc('a', 'man', 0), doc('b', 'man', 1), doc('c', 'man', 1), doc('d', 'man', 1)]
  const after = drop(docs, 'a', 'd', 'after')
  assert.deepEqual(titlesIn(after, 'man'), ['b', 'c', 'd', 'a'])
  assert.deepEqual(ordersIn(after, 'man'), [0, 1, 2, 3])
})

test('arrastes seguidos mantêm a sequência sem buracos', () => {
  let docs = base()
  docs = drop(docs, 'c1', 'c6', 'after')
  docs = drop(docs, 'c6', 'c2', 'before')
  docs = drop(docs, 'c4', 'p1', 'inside')
  docs = drop(docs, 's1', 'c3', 'before')
  docs = drop(docs, 'c4', 'c5', 'after')
  for (const parent of ['man', 'p1']) {
    const orders = ordersIn(docs, parent)
    assert.deepEqual(orders, orders.map((_, i) => i), `pasta ${parent}`)
  }
  assert.deepEqual(titlesIn(docs, 'man'), ['c6', 'c2', 's1', 'c3', 'c5', 'c4', 'c1', 'p1'])
})

test('posição pelo ponteiro: quartos na pasta, metades no texto', () => {
  const rect = { top: 100, height: 20 }
  assert.equal(getDropPosition(102, rect, true), 'before')
  assert.equal(getDropPosition(110, rect, true), 'inside')
  assert.equal(getDropPosition(118, rect, true), 'after')
  assert.equal(getDropPosition(108, rect, false), 'before')
  assert.equal(getDropPosition(112, rect, false), 'after')
})

test('nextOrder usa máximo + 1 (não colide depois de ir para a lixeira)', () => {
  const docs = [doc('a', 'man', 0), doc('c', 'man', 2)]
  assert.equal(nextOrder(docs, 'man'), 3)
  assert.equal(nextOrder(docs, 'vazia'), 0)
})
