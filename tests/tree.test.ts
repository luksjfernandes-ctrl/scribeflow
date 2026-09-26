import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { countWords, flattenSubtree, outlineWords, subtreeWords } from '../src/lib/tree.ts'
import { readExpanded, readViewMode, readZoom, writeExpanded, writeViewMode, writeZoom } from '../src/lib/uiState.ts'
import type { Doc } from '../src/types.ts'

const doc = (id: string, parent_id: string | null, order: number, extra: Partial<Doc> = {}): Doc =>
  ({ id, parent_id, order, type: 'text', title: id, content: '', metadata: {}, ...extra }) as unknown as Doc

// Manuscript > Intro, Livro I (Parte) > Cap1, Cap2, Pasta > Cena1, Cena2 (ordem gravada fora de ordem)
const docs: Doc[] = [
  doc('ms', null, 0, { type: 'folder' as Doc['type'] }),
  doc('livro', 'ms', 1, { metadata: { section_type: 'Part' } as Doc['metadata'] }),
  doc('intro', 'ms', 0, { content: '<p>um dois</p>' }),
  doc('pasta', 'livro', 2, { type: 'folder' as Doc['type'] }),
  doc('cap2', 'livro', 1, { content: '<p>tres quatro cinco</p>' }),
  doc('cap1', 'livro', 0, { content: '<p><strong>seis</strong> sete</p>' }),
  doc('cena2', 'pasta', 1, { content: '<p>oito</p>' }),
  doc('cena1', 'pasta', 0, { content: '<p>nove dez</p>' }),
]

test('achata a subarvore na ordem do Binder, com cenas de pasta e capitulos do Livro', () => {
  assert.deepEqual(flattenSubtree(docs, 'ms').map(d => d.id), ['ms', 'intro', 'livro', 'cap1', 'cap2', 'pasta', 'cena1', 'cena2'])
  assert.deepEqual(flattenSubtree(docs, 'livro').map(d => d.id), ['livro', 'cap1', 'cap2', 'pasta', 'cena1', 'cena2'])
  assert.deepEqual(flattenSubtree(docs, 'cap1').map(d => d.id), ['cap1'])
  assert.deepEqual(flattenSubtree(docs, 'nao-existe'), [])
})

test('ciclo no dado nao trava', () => {
  const ciclo = [doc('a', 'b', 0), doc('b', 'a', 0)]
  assert.deepEqual(flattenSubtree(ciclo, 'a').map(d => d.id), ['a', 'b'])
})

test('Outliner soma descendentes de pasta e de Livro/Parte', () => {
  assert.equal(countWords('<p>a</p><p>b c</p>'), 3)
  assert.equal(outlineWords(docs, docs.find(d => d.id === 'pasta')!), 3)
  assert.equal(outlineWords(docs, docs.find(d => d.id === 'livro')!), 8)
  assert.equal(outlineWords(docs, docs.find(d => d.id === 'cap2')!), 3)
  assert.equal(subtreeWords(docs, 'ms'), 10)
})

const memoria = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

test('vista, zoom e pastas abertas voltam do storage; lixo cai no padrao', () => {
  const s = memoria()
  assert.equal(readViewMode(s), 'editor')
  assert.equal(readZoom(s), 100)
  writeViewMode('corkboard', s); writeZoom(130, s)
  assert.equal(readViewMode(s), 'corkboard')
  assert.equal(readZoom(s), 130)
  s.setItem('scribeflow-view-mode', 'hack'); s.setItem('scribeflow-zoom', '9999')
  assert.equal(readViewMode(s), 'editor')
  assert.equal(readZoom(s), 100)
  writeExpanded('p1', new Set(['x', 'y']), s)
  assert.deepEqual([...readExpanded('p1', s)], ['x', 'y'])
  assert.deepEqual([...readExpanded('p2', s)], [])
  s.setItem('scribeflow-expanded:p3', '{quebrado')
  assert.deepEqual([...readExpanded('p3', s)], [])
})

test('storage que lanca nao derruba', () => {
  const ruim = { getItem: () => { throw new Error('bloqueado') }, setItem: () => { throw new Error('bloqueado') } }
  assert.equal(readZoom(ruim), 100)
  writeZoom(120, ruim)
  assert.deepEqual([...readExpanded('p', ruim)], [])
})
