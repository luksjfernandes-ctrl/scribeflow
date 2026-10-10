import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { LIMITS, limitMessage } from '../src/lib/limits.ts'

test('check de tamanho do doc vira mensagem em portugues', () => {
  const m = limitMessage('new row for relation "docs" violates check constraint "docs_content_tamanho"')
  assert.ok(m && m.includes(`${LIMITS.docContentMB} MB`))
})

test('cota da conta, de docs e de livros sao reconhecidas', () => {
  assert.ok(limitMessage('scribeflow_limite: espaco')?.includes(`${LIMITS.userTotalMB} MB`))
  assert.ok(limitMessage('scribeflow_limite: docs')?.includes('documentos'))
  assert.ok(limitMessage('scribeflow_limite: projetos')?.includes(`${LIMITS.projectsPerUser} livros`))
})

test('metadata, titulo e ajustes tem mensagem propria', () => {
  assert.ok(limitMessage('violates check constraint "docs_metadata_tamanho"')?.includes('snapshots'))
  assert.equal(limitMessage('violates check constraint "projects_name_tamanho"'), 'O título passou do tamanho máximo.')
  assert.ok(limitMessage('violates check constraint "projects_settings_tamanho"'))
})

test('erro que nao e limite segue o caminho de sempre', () => {
  assert.equal(limitMessage('new row violates row-level security policy for table "docs"'), null)
  assert.equal(limitMessage('Failed to fetch'), null)
  assert.equal(limitMessage(undefined), null)
  assert.equal(limitMessage(''), null)
})
