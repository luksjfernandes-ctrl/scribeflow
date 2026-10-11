import { strict as assert } from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { LABEL_COLORS } from '../src/constants.ts'
import { isPart } from '../src/lib/binderOrder.ts'
import {
  LABEL_OPTIONS,
  SECTION_OPTIONS,
  STATUS_OPTIONS,
  labelName,
  quantos,
  sectionName,
  statusName,
} from '../src/lib/metadataLabels.ts'
import type { Doc } from '../src/types.ts'

test('os valores gravados continuam os mesmos (os livros antigos dependem deles)', () => {
  assert.deepEqual(STATUS_OPTIONS.map((o) => o.value), ['To Do', 'First Draft', 'Revised Draft', 'Final Draft'])
  assert.deepEqual(LABEL_OPTIONS.map((o) => o.value), ['none', 'red', 'green', 'blue', 'yellow'])
  assert.deepEqual(SECTION_OPTIONS.map((o) => o.value), ['Scene', 'Part', 'Heading'])
})

test('todo status e toda cor de rotulo tem nome em portugues', () => {
  for (const o of STATUS_OPTIONS) assert.notEqual(statusName(o.value), o.value, o.value)
  // Nome exato por cor: o fallback "Sem rótulo" tambem difere da cor, entao
  // so comparar com a propria cor nao pegaria um mapeamento apagado.
  const esperado: Record<string, string> = {
    none: 'Sem rótulo', red: 'Capítulo', orange: 'Nota', yellow: 'Nota',
    green: 'Cena', blue: 'Pesquisa', purple: 'Ideia',
  }
  assert.deepEqual(Object.keys(LABEL_COLORS).sort(), Object.keys(esperado).sort())
  for (const cor of Object.keys(LABEL_COLORS)) assert.equal(labelName(cor), esperado[cor], cor)
  assert.equal(statusName('First Draft'), 'Primeiro rascunho')
})

test('tipo de secao: a opcao "Livro / Parte" grava o valor que o app reconhece como parte', () => {
  const parte = SECTION_OPTIONS.find((o) => o.label === 'Livro / Parte')
  const doc = { type: 'text', metadata: { section_type: parte?.value } } as unknown as Doc
  assert.equal(isPart(doc), true)
  assert.equal(sectionName('Scene'), 'Cena')
  assert.equal(sectionName('Heading'), 'Título')
  // Valor fora da lista (livro antigo) aparece como esta gravado, sem sumir.
  assert.equal(sectionName('Capítulo'), 'Capítulo')
  assert.equal(sectionName(undefined), 'Sem tipo')
})

test('contadores no singular quando a quantidade e 1', () => {
  assert.equal(quantos(1, 'palavra', 'palavras'), '1 palavra')
  assert.equal(quantos(0, 'palavra', 'palavras'), '0 palavras')
  assert.equal(quantos(1234, 'caractere', 'caracteres'), '1.234 caracteres')
})

test('novos itens nascem com titulo em portugues', () => {
  const app = readFileSync('src/App.tsx', 'utf8')
  for (const t of ['New Document', 'New Folder', 'New Character', 'New Setting']) {
    assert.doesNotMatch(app, new RegExp(`['"\`]${t}['"\`]`), t)
  }
  for (const t of ['Nova pasta', 'Novo personagem', 'Novo lugar', 'Novo documento']) assert.match(app, new RegExp(`'${t}'`), t)
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

test('a imagem da previa do link existe em public/ com o tamanho declarado', () => {
  const html = readFileSync('index.html', 'utf8')
  const url = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1]
  assert.equal(url, 'https://scribeflow-psi.vercel.app/og.jpg')
  const jpg = readFileSync('public/og.jpg')
  // Marcador SOF do JPEG: altura e largura em 16 bits depois de FFC0/FFC2.
  const sof = jpg.findIndex((b, i) => b === 0xff && (jpg[i + 1] === 0xc0 || jpg[i + 1] === 0xc2))
  assert.ok(sof > 0)
  assert.deepEqual([jpg.readUInt16BE(sof + 7), jpg.readUInt16BE(sof + 5)], [1200, 630])
  assert.match(html, /og:image:width" content="1200"/)
  assert.match(html, /og:image:height" content="630"/)
})
