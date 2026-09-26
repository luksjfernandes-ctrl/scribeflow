import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseEpigraph } from '../src/lib/epigraph.ts'

test('citacao com atribuicao em travessao', () => {
  assert.deepEqual(parseEpigraph('Não é porque as coisas são difíceis que não ousamos.\n— Sêneca'), [
    { kind: 'quote', text: 'Não é porque as coisas são difíceis que não ousamos.', display: 'Não é porque as coisas são difíceis que não ousamos.' },
    { kind: 'attribution', text: '— Sêneca', display: '— Sêneca' },
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
  assert.deepEqual(parseEpigraph('Onde tudo começou'), [{ kind: 'quote', text: 'Onde tudo começou', display: 'Onde tudo começou' }])
})

test('ultima linha curta sem travessao e sem ponto final vira atribuicao, com "— " so na exibicao', () => {
  const r = parseEpigraph('Quando o trabalho é um prazer, a vida é uma alegria.\nMaxim Gorky')
  assert.equal(r[1].kind, 'attribution')
  assert.equal(r[1].text, 'Maxim Gorky', 'o texto salvo nao muda')
  assert.equal(r[1].display, '— Maxim Gorky')
})

test('"--" e meia-risca viram travessao na exibicao', () => {
  assert.equal(parseEpigraph('x\n-- Autor')[1].display, '— Autor')
  assert.equal(parseEpigraph('x\n–Autor')[1].display, '— Autor')
})

test('ultima linha NAO e atribuicao se terminar em pontuacao, for longa ou for a unica linha', () => {
  assert.equal(parseEpigraph('Primeiro verso\ne o mar.').at(-1)!.kind, 'quote')
  assert.equal(parseEpigraph('Primeiro verso\nquem sabe o que virá?').at(-1)!.kind, 'quote')
  assert.equal(parseEpigraph('Primeiro verso\num dois três quatro cinco seis sete').at(-1)!.kind, 'quote')
  assert.equal(parseEpigraph('Maxim Gorky')[0].kind, 'quote', 'sozinha, e subtitulo, nao atribuicao')
  assert.equal(parseEpigraph('Primeiro verso\n\nMaxim Gorky').at(-1)!.kind, 'attribution')
})

test('pontuacao dentro de aspas no fim tambem conta como fim de frase', () => {
  assert.equal(parseEpigraph('Ele disse\n“fim.”').at(-1)!.kind, 'quote')
})

test('dialogo: travessao no meio da epigrafe fica como texto; so as linhas finais sao atribuicao', () => {
  const r = parseEpigraph('— Não sou nada, disse ele.\n— Nunca serei nada.\nE à parte isso tenho em mim todos os sonhos do mundo.\n— Fernando Pessoa')
  assert.deepEqual(r.map((l) => [l.kind, l.display]), [
    ['quote', '— Não sou nada, disse ele.'],
    ['quote', '— Nunca serei nada.'],
    ['quote', 'E à parte isso tenho em mim todos os sonhos do mundo.'],
    ['attribution', '— Fernando Pessoa'],
  ])
})

test('dialogo sem atribuicao: todas as linhas com travessao ficam como citacao quando nada vem antes', () => {
  assert.deepEqual(parseEpigraph('— Onde vais?\n— Ao mar.').map((l) => l.kind), ['quote', 'quote'])
  assert.deepEqual(parseEpigraph('— Sêneca').map((l) => l.kind), ['quote'], 'linha unica e sempre citacao')
})

test('varias linhas finais com travessao formam a atribuicao', () => {
  assert.deepEqual(parseEpigraph('Verso.\n— Autor\n— Obra, 1922').map((l) => l.kind), ['quote', 'attribution', 'attribution'])
})
