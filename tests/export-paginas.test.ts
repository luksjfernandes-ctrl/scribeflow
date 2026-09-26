import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import JSZip from 'jszip'
import { Packer } from 'docx'
import type { Doc } from '../src/types.ts'
import { compileManuscript } from '../src/export/compile.ts'
import { buildPdfDefinition, pageGeometry, PDF_FONT, type PdfDefinition, type PdfOptions } from '../src/export/pdf.ts'
import { buildDocx } from '../src/export/docx.ts'

const require = createRequire(import.meta.url)
const pdfmake = require('pdfmake')
const fonts = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/export/fonts')
pdfmake.setUrlAccessPolicy(() => false)
pdfmake.addFonts({ [PDF_FONT]: {
  normal: `${fonts}/EBGaramond-Regular.ttf`, italics: `${fonts}/EBGaramond-Italic.ttf`,
  bold: `${fonts}/EBGaramond-Bold.ttf`, bolditalics: `${fonts}/EBGaramond-BoldItalic.ttf`,
} })

const capitulo = (html: string, subtitle?: string): Doc[] => {
  const meta = (extra: Record<string, unknown> = {}) => ({ created_at: 0, is_include_in_compile: true, ...extra })
  return [
    { id: 'm', title: 'Manuscript', content: '', type: 'folder', parent_id: null, order: 0, metadata: meta({ folder_role: 'manuscript' }) },
    { id: 'c', title: 'Capítulo 1', content: html, type: 'text', parent_id: 'm', order: 0, metadata: meta(subtitle ? { subtitle } : {}) },
  ] as unknown as Doc[]
}

type Pos = { pageNumber: number; top: number }
type Node = Record<string, unknown> & { positions?: Pos[] }
/** Renderiza e devolve os nós do corpo com as posições de linha que o pdfmake gravou. */
const render = async (docs: Doc[], options: PdfOptions = {}): Promise<{ def: PdfDefinition; nodes: Node[] }> => {
  const def = buildPdfDefinition(compileManuscript(docs, 'x'), options)
  await pdfmake.createPdf(def).getBuffer()
  type Sec = { section: Node[] | { stack: Node[] } }
  const nodes = (def.content as unknown as Sec[]).flatMap((s) => (Array.isArray(s.section) ? s.section : s.section.stack))
  return { def, nodes }
}
const id = (n: Node) => (typeof n.id === 'string' ? n.id : '')
const firstText = (n: Node) => (Array.isArray(n.text) ? ((n.text[0] as { text?: string })?.text ?? '') : String(n.text ?? ''))

// ---------- justificação (patch do pdfmake) ----------

test('patch do pdfmake aplicado no Node e no bundle que o Vite usa', () => {
  const root = path.dirname(require.resolve('pdfmake/package.json'))
  for (const f of ['js/ElementWriter.js', 'build/pdfmake.js']) {
    assert.match(readFileSync(path.join(root, f), 'utf8'), /scribeflow: justifica só nos espaços/, f)
  }
})

test('justificação: a sobra vai só para os espaços, não para a troca de estilo', () => {
  const ElementWriter = require('pdfmake/js/ElementWriter').default
  const Line = require('pdfmake/js/Line').default
  // "com␣" | "negrito"(negrito) | "\u00a0e␣" | "itálico"(itálico) | ".␣" | "fim"
  const texts = ['com ', 'negrito', '\u00a0e ', 'itálico', '. ', 'fim']
  const line = new Line(200)
  for (const text of texts) line.addInline({ text, width: 20, alignment: 'justify', leadingCut: 0, trailingCut: 0 })
  const writer = new ElementWriter({ availableWidth: 200 })
  writer.alignLine(line)
  const x = line.inlines.map((i: { x: number }) => i.x)
  const gaps = x.slice(1).map((v: number, i: number) => Math.round(v - x[i] - 20))
  // 80 pt de sobra em 4 espaços (depois de "com", o nbsp, depois de "e" e depois do ponto): 20 cada.
  // Entre "itálico" e "." não há espaço: nada de sobra ali.
  assert.deepEqual(gaps, [20, 20, 20, 0, 20])
})

test('justificação: linha sem espaço nenhum não se desmancha', () => {
  const ElementWriter = require('pdfmake/js/ElementWriter').default
  const Line = require('pdfmake/js/Line').default
  const line = new Line(200)
  for (const text of ['super', 'cali']) line.addInline({ text, width: 20, alignment: 'justify', leadingCut: 0, trailingCut: 0 })
  new ElementWriter({ availableWidth: 200 }).alignLine(line)
  assert.deepEqual(line.inlines.map((i: { x: number }) => i.x), [0, 20])
})

// ---------- linha em branco e última linha ----------

const linhas = (n: number) => Array.from({ length: n }, (_, i) => `<p>Linha curta ${i + 1}.</p>`).join('')

test('linha em branco que cairia no topo da página some (sem controle, ela abre a página)', async () => {
  let achou = false
  for (let n = 10; n < 40 && !achou; n++) {
    const docs = capitulo(`${linhas(n)}<p></p>${linhas(6)}`)
    const sem = (await render(docs, { widowControl: false })).nodes.find((x) => id(x).startsWith('sf-b'))!
    const top = pageGeometry().margins[1]
    if (Math.abs((sem.positions?.[0]?.top ?? 0) - top) >= 1) continue
    achou = true
    const { nodes } = await render(docs)
    const branco = nodes.find((x) => id(x).startsWith('sf-b'))!
    const depois = nodes[nodes.indexOf(branco) + 1]
    // o parágrafo seguinte começa no topo: a linha em branco não ocupa altura
    assert.equal(Math.round(depois.positions![0].top), Math.round(top), `n=${n}`)
    assert.equal(depois.positions![0].pageNumber, sem.positions![0].pageNumber)
  }
  assert.ok(achou, 'nenhum caso levou a linha em branco ao topo: o teste não prova nada')
})

test('linha em branco no meio da página continua (é a pausa que o autor deixou)', async () => {
  const { nodes } = await render(capitulo('<p>Um.</p><p></p><p>Dois.</p>'))
  const [um, branco, dois] = ['Um.', '', 'Dois.'].map((t) => nodes.find((x) => (t ? firstText(x) === t : id(x).startsWith('sf-b')))!)
  assert.ok(branco.positions!.length === 1)
  assert.ok(dois.positions![0].top - um.positions![0].top > 30, 'dois pulos de linha')
})

test('o capítulo não termina numa página com 1 linha só', async () => {
  let casos = 0
  for (let n = 10; n < 45; n++) {
    const docs = capitulo(`${linhas(n)}<p>Frase final.</p>`)
    const sem = (await render(docs, { widowControl: false })).nodes
    const fim = sem.find((x) => firstText(x) === 'Frase final.')!
    const pag = fim.positions![0].pageNumber
    const naPagina = sem.flatMap((x) => x.positions ?? []).filter((p) => p.pageNumber === pag).length
    if (naPagina !== 1) continue
    casos++
    const com = (await render(docs)).nodes
    const fimCom = com.find((x) => firstText(x) === 'Frase final.')!
    const pagCom = fimCom.positions![0].pageNumber
    const linhasCom = com.flatMap((x) => x.positions ?? []).filter((p) => p.pageNumber === pagCom).length
    assert.ok(linhasCom >= 2, `n=${n}: ${linhasCom} linha(s) na última página`)
  }
  assert.ok(casos > 0, 'nenhum caso de última linha sozinha: o teste não prova nada')
})

test('cenário da qa2: a p. nova não abre com linha em branco nem fica com 1 linha', async () => {
  const html = '<h1>Um título de seção</h1><p>Texto normal com<strong> negrito</strong>&nbsp;e<em> itálico</em>. Segunda frase do primeiro parágrafo, longa o bastante para ocupar mais de uma linha e mostrar o recuo de livro na primeira linha.</p><p>Segundo parágrafo, que deve ter recuo na primeira linha no estilo Livro.</p><ul><li><p>item um</p></li><li><p>item dois</p></li></ul><p>Parágrafo depois da lista.</p><p></p><p>Frase escrita no Compose 93731.</p><p></p>'
  const docs = capitulo(html, 'A vida, se bem usada, é longa.\n— Sêneca')
  const semNodes = (await render(docs, { widowControl: false })).nodes
  const sem = semNodes.find((x) => id(x).startsWith('sf-b'))!
  assert.equal(Math.round(sem.positions![0].top), Math.round(pageGeometry().margins[1]), 'sem controle: branco no topo (o defeito)')
  const { nodes } = await render(docs)
  const fim = nodes.find((x) => firstText(x).startsWith('Frase escrita'))!
  const pag = fim.positions![0].pageNumber
  const naPagina = nodes.filter((x) => x.positions?.some((p) => p.pageNumber === pag))
  assert.ok(naPagina.length >= 2)
  assert.ok(!id(naPagina[0]).startsWith('sf-b'), 'a página não abre com a linha em branco')
})

// ---------- tamanho de página ----------

const CM = 72 / 2.54
test('PDF: 14 × 21 por padrão; A4 quando pedido', () => {
  const ms = compileManuscript(capitulo('<p>x</p>'), 'x')
  const size = (o: PdfOptions) => {
    const p = buildPdfDefinition(ms, o).pageSize as { width: number; height: number }
    return [+(p.width / CM).toFixed(1), +(p.height / CM).toFixed(1)]
  }
  assert.deepEqual(size({}), [14, 21])
  assert.deepEqual(size({ pageSize: '14x21' }), [14, 21])
  assert.deepEqual(size({ pageSize: 'a4' }), [21, 29.7])
})

test('PDF em A4 renderiza com o capítulo a 1/3 da página', async () => {
  const { nodes } = await render(capitulo('<p>x</p>'), { pageSize: 'a4' })
  const title = nodes.flatMap((x) => (Array.isArray(x.stack) ? (x.stack as Node[]) : [])).find((x) => x.text === 'Capítulo 1')!
  const top = title.positions![0].top
  assert.ok(Math.abs(top - 29.7 * CM / 3) < 2, `topo do título em ${top.toFixed(1)} pt`)
})

const pgSz = async (o: Parameters<typeof buildDocx>[1]) => {
  const zip = await JSZip.loadAsync(await Packer.toBuffer(buildDocx(compileManuscript(capitulo('<p>x</p>', 'Citação\n— Autor'), 'x'), o)))
  const xml = await zip.file('word/document.xml')!.async('string')
  return [...new Set(xml.match(/<w:pgSz [^>]*>/g))]
}
test('DOCX: A4 por padrão; 14 × 21 quando pedido', async () => {
  assert.deepEqual(await pgSz({}), ['<w:pgSz w:w="11907" w:h="16840" w:orient="portrait"/>'])
  assert.deepEqual(await pgSz({ pageSize: '14x21' }), ['<w:pgSz w:w="7938" w:h="11907" w:orient="portrait"/>'])
})

// ---------- parágrafo vazio no fim ----------

test('parágrafos vazios no fim do texto não saem (nem <p><br></p>, nem nbsp), sem mexer no gravado', async () => {
  const html = '<p>Última frase.</p><p></p><p><br class="ProseMirror-trailingBreak"></p><p>&nbsp;</p>'
  const docs = capitulo(html)
  const ms = compileManuscript(docs, 'x')
  assert.equal(ms.items[0].blocks.length, 1)
  assert.equal(docs[1].content, html, 'o conteúdo gravado não muda')
  const zip = await JSZip.loadAsync(await Packer.toBuffer(buildDocx(ms)))
  const xml = await zip.file('word/document.xml')!.async('string')
  const corpo = xml.slice(xml.indexOf('Última frase.'))
  assert.ok(!/<w:pStyle w:val="Corpo(Primeiro)?"\/><\/w:pPr><\/w:p>/.test(corpo), 'nenhum parágrafo vazio depois da última frase')
})
