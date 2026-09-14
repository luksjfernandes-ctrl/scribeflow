import { strict as assert } from 'node:assert'
import { afterEach, beforeEach, test } from 'node:test'
import handler from '../api/keep-alive.ts'

/**
 * Garante que /api/keep-alive nunca executa em chamada nao autenticada.
 *
 * O que realmente importa aqui nao e o status code: e que `fetch` (a ida ao
 * Supabase) NAO aconteca em nenhum caminho sem credencial. Se alguem reordenar
 * o handler e colocar a consulta antes da guarda, os status continuariam certos
 * e so este contador pegaria a regressao.
 */

const SECRET = 'segredo-de-teste'
const SUPABASE_URL = 'https://exemplo.supabase.co'

let fetchCalls = 0
const originalFetch = globalThis.fetch
const originalEnv = { ...process.env }

beforeEach(() => {
  fetchCalls = 0
  globalThis.fetch = (async () => {
    fetchCalls += 1
    return new Response('[]', { status: 200 })
  }) as typeof fetch
  process.env.VITE_SUPABASE_URL = SUPABASE_URL
  process.env.VITE_SUPABASE_ANON_KEY = 'anon-de-teste'
})

afterEach(() => {
  globalThis.fetch = originalFetch
  process.env = { ...originalEnv }
})

/** Stub minimo de (req, res): o handler so usa headers / statusCode / end. */
function call(headers: Record<string, string | undefined>) {
  const res = {
    statusCode: 0,
    body: '',
    setHeader() {},
    end(chunk: string) {
      this.body = chunk
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return handler({ headers } as any, res as any).then(() => res)
}

test('sem header Authorization -> 401 e nao toca o Supabase', async () => {
  process.env.CRON_SECRET = SECRET
  const res = await call({})
  assert.equal(res.statusCode, 401)
  assert.equal(fetchCalls, 0)
})

test('token errado -> 401 e nao toca o Supabase', async () => {
  process.env.CRON_SECRET = SECRET
  const res = await call({ authorization: 'Bearer chute-errado' })
  assert.equal(res.statusCode, 401)
  assert.equal(fetchCalls, 0)
})

test('sem CRON_SECRET configurado -> falha fechado (503), nao 200', async () => {
  delete process.env.CRON_SECRET
  const res = await call({ authorization: `Bearer ${SECRET}` })
  assert.equal(res.statusCode, 503)
  assert.equal(fetchCalls, 0)
})

test('sem CRON_SECRET e sem header -> tambem falha fechado', async () => {
  delete process.env.CRON_SECRET
  const res = await call({})
  assert.equal(res.statusCode, 503)
  assert.equal(fetchCalls, 0)
})

test('a resposta 401 nao vaza o tamanho do segredo', async () => {
  process.env.CRON_SECRET = SECRET
  const res = await call({ authorization: 'Bearer x' })
  assert.equal(JSON.parse(res.body).error, 'Unauthorized')
  assert.ok(!res.body.includes(String(SECRET.length)))
})

test('token valido -> 200 e uma consulta ao Supabase', async () => {
  process.env.CRON_SECRET = SECRET
  const res = await call({ authorization: `Bearer ${SECRET}` })
  assert.equal(res.statusCode, 200)
  assert.equal(fetchCalls, 1)
  assert.equal(JSON.parse(res.body).ok, true)
})

test('bearer minusculo e \\n no secret gravado ainda autenticam', async () => {
  // Este e o motivo dos dois .trim() no handler: valor vindo de stdin carrega
  // \n, e a Vercel nao garante a caixa do esquema.
  process.env.CRON_SECRET = `${SECRET}\n`
  const res = await call({ authorization: `bearer ${SECRET} ` })
  assert.equal(res.statusCode, 200)
  assert.equal(fetchCalls, 1)
})

test('sem credencial do Supabase -> 500 apos autenticar, sem fetch', async () => {
  process.env.CRON_SECRET = SECRET
  delete process.env.VITE_SUPABASE_URL
  const res = await call({ authorization: `Bearer ${SECRET}` })
  assert.equal(res.statusCode, 500)
  assert.equal(fetchCalls, 0)
})
