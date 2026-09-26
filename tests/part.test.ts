import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { isPartDoc, parsePartTitle } from '../src/lib/part.ts'
import type { Doc } from '../src/types.ts'

test('rotulo e nome com meia-risca, travessao ou hifen com espacos', () => {
  assert.deepEqual(parsePartTitle('Livro I – Infância'), { label: 'Livro I', name: 'Infância' })
  assert.deepEqual(parsePartTitle('Livro II — Juventude'), { label: 'Livro II', name: 'Juventude' })
  assert.deepEqual(parsePartTitle('Livro III - A Cidade'), { label: 'Livro III', name: 'A Cidade' })
})

test('so o primeiro separador divide; o resto fica no nome', () => {
  assert.deepEqual(parsePartTitle('Livro IV – Guerra – e paz'), { label: 'Livro IV', name: 'Guerra – e paz' })
})

test('sem separador, o titulo inteiro e o nome', () => {
  assert.deepEqual(parsePartTitle('Livro I'), { label: '', name: 'Livro I' })
  assert.deepEqual(parsePartTitle('Jean-Paul e a náusea'), { label: '', name: 'Jean-Paul e a náusea' })
  assert.deepEqual(parsePartTitle(' – Infância'), { label: '', name: '– Infância' })
  assert.deepEqual(parsePartTitle(''), { label: '', name: '' })
})

const d = (type: Doc['type'], section_type: string) => ({ type, metadata: { section_type } }) as Doc

test('isPartDoc: so documento de texto com section_type Part', () => {
  assert.equal(isPartDoc(d('text', 'Part')), true)
  assert.equal(isPartDoc(d('text', ' part ')), true)
  assert.equal(isPartDoc(d('text', 'Scene')), false)
  assert.equal(isPartDoc(d('folder', 'Part')), false)
  assert.equal(isPartDoc(null), false)
})
