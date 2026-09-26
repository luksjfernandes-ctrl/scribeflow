import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseEpigraph } from '../src/lib/epigraph.ts'

test('citacao com atribuicao em travessao', () => {
  assert.deepEqual(parseEpigraph('Não é porque as coisas são difíceis que não ousamos.\n— Sêneca'), [
    { kind: 'quote', text: 'Não é porque as coisas são difíceis que não ousamos.' },
    { kind: 'attribution', text: '— Sêneca' },
  ])
})

test('meia-risca e "--" tambem marcam a atribuicao', () => {
  assert.equal(parseEpigraph('x\n– Autor')[1].kind, 'attribution')
  assert.equal(parseEpigraph('x\n  -- Autor')[1].kind, 'attribution')
})

test('hifen simples no meio ou no inicio de verso nao e atribuicao', () => {
  assert.equal(parseEpigraph('- um verso com hifen')[0].kind, 'quote')
  assert.equal(parseEpigraph('texto — com travessao no meio')[0].kind, 'quote')
})

test('vazio, so espacos e linhas em branco nas pontas', () => {
  assert.deepEqual(parseEpigraph(''), [])
  assert.deepEqual(parseEpigraph('   \n  '), [])
  assert.deepEqual(parseEpigraph(undefined), [])
  assert.deepEqual(parseEpigraph('\n\nverso\n\n').map((l) => l.kind), ['quote'])
})

test('linha em branco no meio separa estrofes', () => {
  assert.deepEqual(parseEpigraph('a\n\nb\r\n— c').map((l) => l.kind), ['quote', 'blank', 'quote', 'attribution'])
})

test('subtitulo antigo de uma linha continua funcionando como citacao', () => {
  assert.deepEqual(parseEpigraph('Onde tudo começou'), [{ kind: 'quote', text: 'Onde tudo começou' }])
})
