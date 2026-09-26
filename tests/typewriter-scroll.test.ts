import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { computeTypewriterScroll } from '../src/lib/typewriterScroll.ts'

/**
 * Rolagem de máquina de escrever do Compose. O bug de 26/09: a cada tecla a
 * tela ia para o meio (ou o início) do documento, porque se centralizava o
 * editor inteiro e não o cursor. Aqui a regra é: cursor na faixa central =
 * nada rola; fora dela = só o necessário para voltar à borda da faixa.
 */

// Contêiner de 600px no topo da tela: faixa padrão entre 180px e 330px.
const base = { containerTop: 0, containerHeight: 600, scrollTop: 5000, maxScrollTop: 20000 }
const cursor = (top: number) => ({ ...base, caretTop: top, caretBottom: top + 30 })

test('cursor dentro da faixa não rola', () => {
  assert.equal(computeTypewriterScroll(cursor(250)), null)
  assert.equal(computeTypewriterScroll(cursor(180)), null)
  assert.equal(computeTypewriterScroll(cursor(300)), null)
})

test('linha nova abaixo da faixa sobe só o que passou', () => {
  // base do cursor em 360, borda inferior em 330: rola 30px, não meia tela
  assert.equal(computeTypewriterScroll(cursor(330)), 5030)
})

test('cursor acima da faixa desce até a borda superior', () => {
  assert.equal(computeTypewriterScroll(cursor(100)), 4920)
})

test('cursor fora da tela (fim de texto longo) vem para a faixa, não para o meio do documento', () => {
  assert.equal(computeTypewriterScroll(cursor(4000)), 5000 + (4030 - 330))
})

test('não rola para antes do início nem além do fim', () => {
  assert.equal(computeTypewriterScroll({ ...cursor(20), scrollTop: 50 }), 0)
  assert.equal(computeTypewriterScroll({ ...cursor(20), scrollTop: 0 }), null)
  assert.equal(computeTypewriterScroll({ ...cursor(900), maxScrollTop: 5100 }), 5100)
})

test('respeita o topo do contêiner quando ele não começa em 0', () => {
  assert.equal(computeTypewriterScroll({ ...cursor(250 + 100), containerTop: 100 }), null)
})
