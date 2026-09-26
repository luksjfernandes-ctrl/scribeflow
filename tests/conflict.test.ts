import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { conflictSnapshot, needsConflictSnapshot } from '../src/lib/conflict.ts'

test('texto de outra aba gravado no meio pede snapshot', () => {
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p>base AbaA</p>', '<p>base AbaB</p>'), true)
})

test('sem conflito real nao ha snapshot', () => {
  // o banco ainda esta na base (so o updated_at mudou, ex.: metadata)
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p>base</p>', '<p>base mais</p>'), false)
  // o banco ja tem exatamente o nosso texto
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p>nosso</p>', '<p>nosso</p>'), false)
  // so muda a marcacao, nao o texto
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p><strong>base</strong></p>', '<p>x</p>'), false)
  // banco vazio nao vira snapshot vazio
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p></p>', '<p>x</p>'), false)
})

test('snapshot traz o texto da outra aba e avisa no titulo', () => {
  const s = conflictSnapshot('Capítulo 1', '<p>AbaA</p>', 'id1', 42)
  assert.deepEqual(s, { id: 'id1', timestamp: 42, title: 'Capítulo 1 (versão de outra aba)', content: '<p>AbaA</p>' })
})
