import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { cleanEnv } from '../src/lib/env.ts'

test('tira o "\\n" do fim da chave (o caso da Vercel)', () => {
  assert.equal(cleanEnv('sb_publishable_abc\n'), 'sb_publishable_abc')
  assert.equal(cleanEnv('eyJ.a.b\r\n'), 'eyJ.a.b')
  assert.equal(cleanEnv('  https://x.supabase.co \n'), 'https://x.supabase.co')
})

test('valor limpo passa igual', () => {
  assert.equal(cleanEnv('sb_publishable_abc'), 'sb_publishable_abc')
})

test('vazio, so espacos ou ausente vira undefined (cai no erro de configuracao)', () => {
  assert.equal(cleanEnv(''), undefined)
  assert.equal(cleanEnv(' \n'), undefined)
  assert.equal(cleanEnv(undefined), undefined)
})
