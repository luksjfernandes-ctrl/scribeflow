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

test('pinça e pan não redimensionam o texto nem simulam teclado', () => {
  const previous = measureAppViewport(800, { height: 800, offsetTop: 0, scale: 1 })
  assert.deepEqual(measureAppViewport(800, { height: 400, offsetTop: 150, scale: 2 }, previous), previous)
  assert.deepEqual(measureAppViewport(800, { height: 1000, offsetTop: 20, scale: 0.8 }, previous), previous)
})

test('zoom com teclado aberto conserva a geometria; voltar à escala 1 retoma', () => {
  const keyboard = measureAppViewport(800, { height: 350, offsetTop: 120, scale: 1 })
  assert.deepEqual(measureAppViewport(800, { height: 175, offsetTop: 180, scale: 2 }, keyboard), keyboard)
  assert.deepEqual(measureAppViewport(800, { height: 800, offsetTop: 0, scale: 1 }, keyboard), {
    height: 800, offsetTop: 0, keyboardOpen: false,
  })
})

test('documento inativo ou medições inválidas não zeram a área de escrita', () => {
  const previous = { height: 350, offsetTop: 120, keyboardOpen: true }
  for (const vv of [
    { height: 0, offsetTop: 0, scale: 0 },
    { height: NaN, offsetTop: 0, scale: 1 },
    { height: 350, offsetTop: Infinity, scale: 1 },
  ]) assert.deepEqual(measureAppViewport(800, vv, previous), previous)
  assert.deepEqual(measureAppViewport(800, { height: 400, offsetTop: 50, scale: 2 }), {
    height: 800, offsetTop: 0, keyboardOpen: false,
  })
})
