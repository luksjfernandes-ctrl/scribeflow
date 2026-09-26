import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import type { Doc } from '../src/types.ts'
import { isInTrash, restoreParentId, withoutTrash } from '../src/lib/trash.ts'
import { labelColorOf } from '../src/constants.ts'

const doc = (id: string, parent_id: string | null, extra: Partial<Doc> = {}): Doc =>
  ({ id, title: id, content: '', type: 'text', parent_id, order: 0, metadata: { created_at: 0 }, ...extra }) as unknown as Doc
const folder = (id: string, parent_id: string | null, role?: string): Doc =>
  doc(id, parent_id, { type: role === 'trash' ? 'trash' : 'folder', metadata: { created_at: 0, folder_role: role } as Doc['metadata'] })

// Manuscript > Parte 1 > Cena; e na lixeira: Parte 2 > Cena apagada.
const base = (): Doc[] => [
  folder('man', null, 'manuscript'),
  folder('trash', null, 'trash'),
  folder('p1', 'man'),
  doc('cena', 'p1'),
  folder('p2', 'trash'),
  doc('apagada', 'p2'),
]

test('isInTrash enxerga qualquer profundidade dentro da lixeira', () => {
  const docs = base()
  assert.equal(isInTrash(docs, 'apagada'), true)
  assert.equal(isInTrash(docs, 'p2'), true)
  assert.equal(isInTrash(docs, 'trash'), true)
  assert.equal(isInTrash(docs, 'cena'), false)
})

test('withoutTrash tira da busca e da contagem o que está dentro de pasta apagada', () => {
  assert.deepEqual(withoutTrash(base()).map(d => d.id), ['man', 'p1', 'cena'])
})

test('isInTrash não entra em laço com parent_id circular', () => {
  const docs = [doc('a', 'b'), doc('b', 'a')]
  assert.equal(isInTrash(docs, 'a'), false)
})

test('restaurar volta para a pasta de origem se ela ainda existir fora da lixeira', () => {
  assert.equal(restoreParentId(base(), { parent_id: 'p1', order: 0, is_include_in_compile: true }), 'p1')
})

test('restaurar cai no Manuscript se a origem sumiu, está na lixeira ou não existe registro', () => {
  const docs = base()
  assert.equal(restoreParentId(docs, { parent_id: 'sumiu', order: 0, is_include_in_compile: true }), 'man')
  assert.equal(restoreParentId(docs, { parent_id: 'p2', order: 0, is_include_in_compile: true }), 'man')
  assert.equal(restoreParentId(docs, undefined), 'man')
})

test('restaurar nunca devolve para dentro de um texto', () => {
  assert.equal(restoreParentId(base(), { parent_id: 'cena', order: 0, is_include_in_compile: true }), 'man')
})

test('cor do rótulo vem de label; label_color só vale como legado', () => {
  assert.equal(labelColorOf({ label: 'red', label_color: 'transparent' }), '#E05050')
  assert.equal(labelColorOf({ label: 'none', label_color: 'transparent' }), null)
  assert.equal(labelColorOf({ label: 'none', label_color: '#123456' }), '#123456')
})
