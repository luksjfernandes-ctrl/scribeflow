import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { LIMITS, isLimitError, limitMessage, refusedMessage } from '../src/lib/limits.ts'

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

test('erro de limite e reconhecido pelo SQLSTATE ou pela marca da cota', () => {
  assert.equal(isLimitError({ code: '23514', message: 'violates check constraint "docs_content_tamanho"' }), true)
  assert.equal(isLimitError({ code: 'P0001', message: 'scribeflow_limite: espaco' }), true)
  assert.equal(isLimitError({ code: '42501', message: 'new row violates row-level security policy' }), false)
  assert.equal(isLimitError(null), false)
  assert.equal(refusedMessage('violates check constraint "docs_metadata_folder_color_safe"'), 'Não salvou: o banco recusou a última alteração.')
})

test('mensagens cabem na faixa de salvamento', () => {
  for (const e of ['docs_content_tamanho', 'docs_metadata_tamanho', 'scribeflow_limite: espaco']) {
    assert.ok((limitMessage(e) ?? '').length <= 90, e)
  }
})

test('os numeros de LIMITS batem com o supabase_schema.sql', () => {
  const sql = readFileSync(new URL('../supabase_schema.sql', import.meta.url), 'utf8')
  assert.match(sql, new RegExp(`octet_length\\(content\\) <= ${LIMITS.docContentMB * 1e6}\\)`))
  assert.match(sql, new RegExp(`pg_column_size\\(metadata\\) <= ${LIMITS.docMetadataMB * 1e6}\\)`))
  assert.match(sql, new RegExp(`> ${LIMITS.userTotalMB * 1e6}`))
  assert.match(sql, new RegExp(`quantos > ${LIMITS.docsPerUser}`))
  assert.match(sql, new RegExp(`>= ${LIMITS.projectsPerUser} THEN`))
})
