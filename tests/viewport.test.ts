import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { measureAppViewport } from '../src/lib/viewport.ts'

test('sem visualViewport usa a altura da janela', () => {
  assert.deepEqual(measureAppViewport(800, null), { height: 800, offsetTop: 0, keyboardOpen: false })
})

test('teclado do iPhone aberto: segue a área visível e o deslocamento', () => {
  // iPhone 15: janela 659px; com o teclado a área visível cai para ~350px e o iOS rola 120px.
  assert.deepEqual(measureAppViewport(659, { height: 349.6, offsetTop: 120.2 }), { height: 350, offsetTop: 120, keyboardOpen: true })
})

test('barra do Safari recolhendo não conta como teclado', () => {
  assert.equal(measureAppViewport(659, { height: 600, offsetTop: 0 }).keyboardOpen, false)
})

test('deslocamento negativo (elástico do iOS) vira zero', () => {
  assert.equal(measureAppViewport(659, { height: 659, offsetTop: -12 }).offsetTop, 0)
})
