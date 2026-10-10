import { strict as assert } from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { LABEL_COLORS } from '../src/constants.ts'
import { LABEL_OPTIONS, STATUS_OPTIONS, labelName, statusName } from '../src/lib/metadataLabels.ts'

test('os valores gravados continuam os mesmos (os livros antigos dependem deles)', () => {
  assert.deepEqual(STATUS_OPTIONS.map((o) => o.value), ['To Do', 'First Draft', 'Revised Draft', 'Final Draft'])
  assert.deepEqual(LABEL_OPTIONS.map((o) => o.value), ['none', 'red', 'green', 'blue', 'yellow'])
})

test('todo status e toda cor de rotulo tem nome em portugues', () => {
  for (const o of STATUS_OPTIONS) assert.notEqual(statusName(o.value), o.value, o.value)
  for (const cor of Object.keys(LABEL_COLORS)) assert.notEqual(labelName(cor), cor, cor)
  assert.equal(statusName('First Draft'), 'Primeiro rascunho')
  assert.equal(labelName('red'), 'Capítulo')
  assert.equal(labelName('purple'), 'Ideia')
})

test('valor desconhecido nao some: status aparece como esta, rotulo vira "Sem rótulo"', () => {
  assert.equal(statusName('Em revisão'), 'Em revisão')
  assert.equal(statusName(undefined), 'Sem status')
  assert.equal(statusName(''), 'Sem status')
  assert.equal(labelName('magenta'), 'Sem rótulo')
  assert.equal(labelName(undefined), 'Sem rótulo')
})

/**
 * Guarda contra volta do ingles na interface: textos que existiam antes da
 * traducao e nao podem reaparecer. Procura so em texto de tela (entre > e <,
 * ou em title/placeholder/aria-label/label), nao em nomes de variaveis.
 */
const REMOVIDOS = [
  'Take Snapshot', 'Project Saved', 'Include in Compile', 'No Label', 'First Draft', 'Revised Draft',
  'Final Draft', 'Compile & Export', 'Project Settings', 'Project Targets', 'Project Statistics',
  'Toggle Binder', 'Toggle Inspector', 'Welcome to ScribeFlow', 'Search Project', 'Export Manuscript',
  'Move to Trash', 'Start writing', 'Untitled', 'No synopsis', 'Add Bookmark', 'Add keyword',
  'Something went wrong', 'CLOUD SYNC ACTIVE', 'NO SELECTION', 'words/day', 'Target reached',
  'Write a subtitle or epigraph', 'Go to Document', 'New Text', 'New Folder', 'Rename',
]
const ARQUIVOS = [
  'src/App.tsx',
  ...readdirSync('src/components').filter((f) => f.endsWith('.tsx') && !f.startsWith('._')).map((f) => `src/components/${f}`),
  'src/lib/conflict.ts',
  'src/lib/drafts.ts',
  'src/lib/limits.ts',
]
const textoDeTela = (src: string): string[] => [
  ...[...src.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]),
  ...[...src.matchAll(/(?:title|placeholder|aria-label|ariaLabel|label)[=:]\s*["'`]([^"'`]+)["'`]/g)].map((m) => m[1]),
  ...[...src.matchAll(/(?:alert|confirm|prompt)\(\s*["'`]([^"'`]+)/g)].map((m) => m[1]),
  ...[...src.matchAll(/\|\|\s*'([^']+)'/g)].map((m) => m[1]),
]

test('interface sem os textos em ingles que foram traduzidos', () => {
  const achados: string[] = []
  for (const arquivo of ARQUIVOS) {
    const textos = textoDeTela(readFileSync(arquivo, 'utf8'))
    for (const t of textos) for (const r of REMOVIDOS) if (t.includes(r)) achados.push(`${arquivo}: "${t.trim()}"`)
  }
  assert.deepEqual(achados, [])
})

test('a pagina declara portugues', () => {
  assert.match(readFileSync('index.html', 'utf8'), /<html lang="pt-BR">/)
})
