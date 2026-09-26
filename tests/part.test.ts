import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parsePartTitle } from '../src/lib/part.ts'

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
