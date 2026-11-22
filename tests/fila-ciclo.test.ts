// Doc movido para uma pasta que, no banco, ja e descendente dele (aba
// desatualizada restaura ou arrasta X para F, e outra aba ja tinha posto F
// dentro de X). O gatilho scribeflow_sem_ciclo (supabase_schema.sql, secao 11)
// recusa com 23514, o mesmo SQLSTATE dos limites: a fila guardava (hold) toda
// gravacao seguinte do doc, que leva o parent_id junto, e o texto nao gravava.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { SaveQueue } from '../src/lib/persistence'
import { makeDocWriter } from '../src/lib/docWriter'

type Linha = { id: string; parent_id: string | null; order: number; title: string; content: string; metadata: Record<string, unknown>; updated_at: number }

// Mesma recusa do gatilho: sobe a cadeia de pais a partir do destino.
function fechaCiclo(banco: Map<string, Linha>, id: string, destino: string | null) {
  for (let atual = destino; atual !== null; atual = banco.get(atual)?.parent_id ?? null) {
    if (atual === id) return true
  }
  return false
}

function cenario() {
  // No banco, F ja esta dentro de X: M > X > F.
  const banco = new Map<string, Linha>([
    ['M', { id: 'M', parent_id: null, order: 0, title: 'Manuscrito', content: '', metadata: {}, updated_at: 1 }],
    ['X', { id: 'X', parent_id: 'M', order: 0, title: 'Cap X', content: '<p>v1</p>', metadata: {}, updated_at: 1 }],
    ['F', { id: 'F', parent_id: 'X', order: 0, title: 'Pasta F', content: '', metadata: {}, updated_at: 1 }],
  ])
  const local = [...banco.values()].map((r) => ({ ...r }))
  const bases = new Map([['X', { updatedAt: 1, title: 'Cap X', content: '<p>v1</p>', metadata: {} }]])
  const avisos: string[] = []
  const restaurados: string[] = []
  const write = makeDocWriter({
    update: async (id, _p, body, expectedAt) => {
      const row = banco.get(id)
      if (!row || (expectedAt !== undefined && row.updated_at !== expectedAt)) return { data: [], error: null }
      // Mesma ordem do Postgres: o gatilho BEFORE (scribeflow_sem_ciclo) roda
      // antes do CHECK de tamanho.
      if ('parent_id' in body && body.parent_id !== row.parent_id && fechaCiclo(banco, id, body.parent_id as string | null)) {
        return { data: null, error: { code: '23514', message: 'scribeflow_ciclo: o item ficaria dentro de si mesmo' } }
      }
      if (typeof body.content === 'string' && body.content.length > 50) {
        return { data: null, error: { code: '23514', message: 'new row for relation "docs" violates check constraint "docs_content_tamanho"' } }
      }
      Object.assign(row, body)
      return { data: [{ id }], error: null }
    },
    read: async (id) => ({ data: (banco.get(id) as never) ?? null, error: null }),
    hasSession: async () => true,
    getBase: (id) => bases.get(id) as never,
    setBase: (id, b) => bases.set(id, b as never),
    localMetadata: (id) => local.find((d) => d.id === id)?.metadata as never,
    updateLocalMetadata: () => {},
    markConfirmed: () => {},
    restoreLocalPlacement: (id) => restaurados.push(id),
    newId: () => 'snap',
    now: () => 1000,
    stamp: () => '22/11 18:00',
    warn: (m) => avisos.push(m),
  })
  const q = new SaveQueue({
    write,
    getDoc: (id) => local.find((d) => d.id === id) as never,
    setTimer: () => 0,
    clearTimer: () => {},
  })
  return { banco, q, avisos, restaurados }
}

test('o texto grava mesmo com o arraste recusado por ciclo; a mudanca de pasta e descartada', async () => {
  const { banco, q, avisos, restaurados } = cenario()
  // Aba desatualizada: poe X dentro de F, que no banco ja e filha de X.
  q.enqueue('X', 'P', { fields: { parent_id: 'F', order: 0 } })
  q.enqueue('X', 'P', { fields: { content: '<p>capitulo reescrito</p>', updated_at: 2 } as never })
  await q.flush()
  assert.equal(banco.get('X')!.content, '<p>capitulo reescrito</p>')
  assert.equal(banco.get('X')!.parent_id, 'M', 'o doc fica onde o banco tem')
  assert.equal(banco.get('F')!.parent_id, 'X', 'a arvore continua sem ciclo')
  assert.equal(q.status(), 'saved')
  assert.equal(q.hasUnsaved(), false)
  assert.match(avisos.join('\n'), /ciclo/)
  assert.deepEqual(restaurados, ['X'], 'o estado local volta para a pasta do banco')
})

test('so a mudanca de pasta recusada por ciclo: sai da fila sem erro preso', async () => {
  const { banco, q } = cenario()
  q.enqueue('X', 'P', { fields: { parent_id: 'F', order: 3 } })
  await q.flush()
  assert.equal(banco.get('X')!.parent_id, 'M')
  assert.equal(q.status(), 'saved')
  // Edicao seguinte grava normalmente.
  q.enqueue('X', 'P', { fields: { title: 'Cap X revisto' } })
  await q.flush()
  assert.equal(banco.get('X')!.title, 'Cap X revisto')
})

test('limite de verdade com mudanca de pasta continua guardado (hold), sem descartar a pasta', async () => {
  const { banco, q } = cenario()
  q.enqueue('X', 'P', { fields: { parent_id: null, order: 1, content: `<p>${'x'.repeat(60)}</p>` } as never })
  await q.flush()
  assert.equal(banco.get('X')!.content, '<p>v1</p>')
  assert.equal(q.status(), 'error')
  assert.equal(q.hasUnsaved(), true)
})

test('arraste que fecha ciclo E texto acima do limite: descarta a pasta e guarda o texto', async () => {
  const { banco, q, restaurados } = cenario()
  q.enqueue('X', 'P', { fields: { parent_id: 'F', order: 0, content: `<p>${'x'.repeat(60)}</p>` } as never })
  await q.flush()
  assert.equal(banco.get('X')!.parent_id, 'M', 'a pasta recusada nao chega ao banco')
  assert.equal(banco.get('X')!.content, '<p>v1</p>', 'o texto grande nao grava')
  assert.equal(q.status(), 'error')
  assert.equal(q.hasUnsaved(), true, 'o texto fica guardado (hold), nao vai fora')
  assert.deepEqual(restaurados, ['X'])
})
