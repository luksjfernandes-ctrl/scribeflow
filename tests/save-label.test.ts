import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { saveLabel } from '../src/lib/saveLabel.ts'

const t = new Date(2026, 8, 28, 21, 7)

test('salvo mostra a hora da confirmacao', () => {
  assert.deepEqual(saveLabel({ status: 'saved', online: true, savedAt: t, unsaved: false }), { text: 'Salvo às 21:07', tone: 'ok' })
})

test('pendente mostra Salvando…', () => {
  assert.equal(saveLabel({ status: 'pending', online: true, savedAt: t, unsaved: true }).text, 'Salvando…')
})

test('erro nao diz salvo', () => {
  const r = saveLabel({ status: 'error', online: true, savedAt: t, unsaved: true })
  assert.equal(r.tone, 'error')
  assert.ok(!r.text.startsWith('Salvo'))
})

test('offline com edicao pendente nao promete salvo no aparelho', () => {
  const r = saveLabel({ status: 'pending', online: false, savedAt: t, unsaved: true })
  assert.equal(r.tone, 'warn')
  assert.ok(!/salvo neste aparelho/i.test(r.text))
  assert.ok(/não feche/.test(r.text))
})

test('offline sem pendencia mostra a ultima confirmacao', () => {
  assert.equal(saveLabel({ status: 'saved', online: false, savedAt: t, unsaved: false }).text, 'Sem conexão · salvo às 21:07')
})

test('erro de limite mostra o motivo em vez de "tentando de novo"', () => {
  const r = saveLabel({ status: 'error', online: true, savedAt: t, unsaved: true, errorText: 'Sua conta chegou a 25 MB' })
  assert.deepEqual(r, { text: 'Sua conta chegou a 25 MB', tone: 'error' })
})

test('sem rede, o aviso de conexao vence o texto de erro', () => {
  const r = saveLabel({ status: 'error', online: false, savedAt: t, unsaved: true, errorText: 'limite' })
  assert.equal(r.tone, 'warn')
})
