import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { DRAFT_TTL_MS, readDrafts, recoverySnapshot, removeDraft, saveDraft, type Draft } from '../src/lib/drafts.ts'

/** localStorage em memoria, com a mesma interface. */
function memoria() {
  const m = new Map<string, string>()
  return {
    get length() { return m.size },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v) },
    removeItem: (k: string) => { m.delete(k) },
    m,
  }
}

const rascunho = (over: Partial<Draft> = {}): Draft => ({
  userId: 'u1', docId: 'd1', projectId: 'p1', payload: { content: '<p>não enviado</p>', updated_at: 5 }, at: 1000, ...over,
})

test('guarda so rascunho com texto do livro; ordem/pasta nao', () => {
  const s = memoria()
  assert.equal(saveDraft(s, rascunho()), true)
  assert.equal(saveDraft(s, rascunho({ docId: 'd2', payload: { order: 3 } })), false)
  assert.equal(s.m.size, 1)
})

test('le os rascunhos da conta e do livro, apaga os vencidos', () => {
  const s = memoria()
  saveDraft(s, rascunho())
  saveDraft(s, rascunho({ docId: 'd2', projectId: 'p2' }))
  saveDraft(s, rascunho({ docId: 'd3', userId: 'u2' }))
  saveDraft(s, rascunho({ docId: 'd4', at: 1000 - DRAFT_TTL_MS - 1 }))
  const lidos = readDrafts(s, 'u1', 'p1', 1000)
  assert.deepEqual(lidos.map((d) => d.docId), ['d1'])
  assert.equal(s.m.size, 3, 'o vencido saiu; o de outra conta e o de outro livro ficam')
  removeDraft(s, 'u1', 'd1')
  assert.equal(readDrafts(s, 'u1', 'p1', 1000).length, 0)
})

test('recuperacao vira snapshot so quando o banco nao tem o mesmo texto', () => {
  const r = rascunho({ payload: { content: '<p>B</p>', title: 'Cap (antes de restaurar)' } })
  assert.equal(recoverySnapshot({ title: 'Cap', content: '<p>B</p>' }, r, 'x'), null, 'o envio da descarga deu certo')
  const snap = recoverySnapshot({ title: 'Cap', content: '<p>A</p>' }, r, 'x')
  assert.deepEqual(snap, { id: 'x', timestamp: 1000, title: 'Cap (não salvo ao fechar)', content: '<p>B</p>' })
  assert.equal(recoverySnapshot({ title: 'Cap', content: '' }, rascunho({ payload: { metadata: {} } }), 'y'), null)
})

test('storage cheio ou bloqueado nao derruba nada', () => {
  const cheio = { ...memoria(), setItem: () => { throw new Error('QuotaExceeded') } }
  assert.equal(saveDraft(cheio, rascunho()), false)
})
