import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import JSZip from 'jszip'
import { Packer } from 'docx'
import type { Doc } from '../src/types.ts'
import { parseHtml, trimEmptyBlocks } from '../src/export/html.ts'
import { compileManuscript, parseEpigraph, safeFileName, splitPartTitle } from '../src/export/compile.ts'
import { buildPdfDefinition, PDF_FONT, type PdfDefinition } from '../src/export/pdf.ts'
import { buildDocx } from '../src/export/docx.ts'
import { renderRtf, renderTxt, rtfEscape } from '../src/export/text.ts'

// ---------- HTML → blocos ----------

test('parseHtml preserva negrito, itálico, sublinhado, títulos e alinhamento', () => {
  const blocks = parseHtml(
    '<p>Com<strong> negrito</strong>,<em> itálico</em>&nbsp;e<u> sub</u>.</p>' +
    '<h2>Um título</h2><p style="text-align: justify;">Justo</p><p style="text-align: center;">Centro</p><p></p>',
  )
  assert.deepEqual(blocks, [
    { type: 'paragraph', runs: [{ text: 'Com' }, { text: ' negrito', bold: true }, { text: ',' }, { text: ' itálico', italic: true }, { text: ' e' }, { text: ' sub', underline: true }, { text: '.' }] },
    { type: 'heading', level: 2, runs: [{ text: 'Um título' }] },
    { type: 'paragraph', align: 'justify', runs: [{ text: 'Justo' }] },
    { type: 'paragraph', align: 'center', runs: [{ text: 'Centro' }] },
    { type: 'paragraph', runs: [] },
  ])
})

test('parseHtml: marcas aninhadas, br, entidades e aspas curvas', () => {
  const [p] = parseHtml('<p><strong>a <em>b</em></strong><br>“c” &amp; &#8212; &lt;d&gt;</p>')
  assert.deepEqual(p, {
    type: 'paragraph',
    runs: [{ text: 'a ', bold: true }, { text: 'b', bold: true, italic: true }, { text: '\n“c” & — <d>' }],
  })
})

test('parseHtml: listas do TipTap (p dentro de li), citação e separador', () => {
  const blocks = parseHtml('<ul><li><p>um</p></li><li><p>dois</p></li></ul><ol><li><p>a</p></li></ol><blockquote><p>cit</p></blockquote><hr>')
  assert.equal(blocks.length, 4)
  assert.deepEqual(blocks[0], { type: 'list', ordered: false, items: [[{ type: 'paragraph', runs: [{ text: 'um' }] }], [{ type: 'paragraph', runs: [{ text: 'dois' }] }]] })
  assert.equal(blocks[1].type === 'list' && blocks[1].ordered, true)
  assert.deepEqual(blocks[2], { type: 'blockquote', children: [{ type: 'paragraph', runs: [{ text: 'cit' }] }] })
  assert.deepEqual(blocks[3], { type: 'rule' })
})

test('parseHtml aceita texto solto sem <p> (conteúdo antigo) e HTML vazio', () => {
  assert.deepEqual(parseHtml('texto <b>solto</b>'), [{ type: 'paragraph', runs: [{ text: 'texto ' }, { text: 'solto', bold: true }] }])
  assert.deepEqual(parseHtml(''), [])
  assert.deepEqual(trimEmptyBlocks(parseHtml('<p></p><p>x</p><p></p>')), [{ type: 'paragraph', runs: [{ text: 'x' }] }])
})

// ---------- epígrafe, Livro/Parte, nome de arquivo ----------

test('parseEpigraph separa a atribuição com travessão', () => {
  assert.deepEqual(parseEpigraph('Viver é muito perigoso.\n— Guimarães Rosa'), { lines: ['Viver é muito perigoso.'], attribution: 'Guimarães Rosa' })
  assert.deepEqual(parseEpigraph('Só texto'), { lines: ['Só texto'] })
  assert.deepEqual(parseEpigraph('a\n-- Autor'), { lines: ['a'], attribution: 'Autor' })
  assert.equal(parseEpigraph('  \n '), null)
  assert.equal(parseEpigraph(undefined), null)
})

test('splitPartTitle divide rótulo e nome', () => {
  assert.deepEqual(splitPartTitle('Livro I – Infância'), { label: 'Livro I', name: 'Infância' })
  assert.deepEqual(splitPartTitle('Livro II - Juventude'), { label: 'Livro II', name: 'Juventude' })
  assert.deepEqual(splitPartTitle('Epílogo'), { name: 'Epílogo' })
  assert.equal(safeFileName('Meu Livro: A República!'), 'meu_livro_a_republica')
})

// ---------- montagem pela árvore ----------

let seq = 0
const mk = (title: string, parent_id: string | null, extra: Partial<Doc> & { meta?: Record<string, unknown> } = {}): Doc => {
  const { meta, ...rest } = extra
  return {
    id: title, title, content: `<p>${title}</p>`, type: 'text', parent_id, order: seq++,
    metadata: { created_at: 0, is_include_in_compile: true, ...meta },
    ...rest,
  } as unknown as Doc
}
const fold = (title: string, parent_id: string | null, role?: string, meta: Record<string, unknown> = {}) =>
  mk(title, parent_id, { type: role === 'trash' ? 'trash' : 'folder', content: '', meta: { folder_role: role ?? null, ...meta } })

const projeto = (): Doc[] => {
  seq = 0
  return [
    fold('Manuscript', null, 'manuscript'),
    fold('Research', null, 'research'),
    fold('Trash', null, 'trash', { is_include_in_compile: false }),
    mk('Introdução', 'Manuscript'),
    mk('Livro I – Infância', 'Manuscript', { meta: { section_type: 'Part', subtitle: 'Epígrafe do livro\n— Autor' } }),
    mk('Capítulo 1', 'Livro I – Infância', { meta: { subtitle: 'Sub do 1' } }),
    fold('Capítulo 2', 'Livro I – Infância', undefined, { is_include_in_compile: true }),
    mk('Cena A', 'Capítulo 2'),
    mk('Cena B', 'Capítulo 2'),
    mk('Livro II – Juventude', 'Manuscript', { meta: { section_type: 'Part' } }), // divisória, sem filhos
    mk('Capítulo 3', 'Manuscript'),
    mk('Nota fora', 'Manuscript', { meta: { is_include_in_compile: false } }),
    mk('Pesquisa marcada', 'Research'),
    fold('Parte apagada', 'Trash'),
    mk('Filho apagado', 'Parte apagada'), // continua marcado para compilar
  ]
}

test('compileManuscript segue a árvore do binder, não o `order` solto', () => {
  const docs = projeto()
  // Embaralha a ordem do array e os `order` entre pastas diferentes: não pode importar.
  docs.reverse()
  const ms = compileManuscript(docs, 'O Livro')
  assert.deepEqual(ms.items.map((i) => `${i.kind}:${i.title}`), [
    'chapter:Introdução',
    'part:Livro I – Infância',
    'chapter:Capítulo 1',
    'chapter:Capítulo 2',
    'section:Cena A',
    'section:Cena B',
    'part:Livro II – Juventude',
    'chapter:Capítulo 3',
  ])
})

test('compileManuscript tira lixeira (em qualquer profundidade), Research e itens desmarcados', () => {
  const titles = compileManuscript(projeto(), 'x').items.map((i) => i.title)
  for (const fora of ['Filho apagado', 'Parte apagada', 'Pesquisa marcada', 'Nota fora']) assert.ok(!titles.includes(fora), fora)
})

test('página nova só em capítulo e Livro; cenas seguem no fluxo', () => {
  const ms = compileManuscript(projeto(), 'x')
  const quebra = Object.fromEntries(ms.items.map((i) => [i.title, i.startsPage]))
  assert.equal(quebra['Capítulo 2'], true)
  assert.equal(quebra['Cena A'], false)
  assert.equal(quebra['Cena B'], false)
  const livro = ms.items.find((i) => i.kind === 'part')!
  assert.equal(livro.label, 'Livro I')
  assert.equal(livro.name, 'Infância')
  assert.deepEqual(livro.epigraph, { lines: ['Epígrafe do livro'], attribution: 'Autor' })
})

test('capítulo desmarcado com cenas marcadas: a primeira cena abre a página', () => {
  seq = 0
  const docs = [fold('Manuscript', null, 'manuscript'), fold('Cap', 'Manuscript', undefined, { is_include_in_compile: false }), mk('C1', 'Cap'), mk('C2', 'Cap')]
  const ms = compileManuscript(docs, 'x')
  assert.deepEqual(ms.items.map((i) => [i.title, i.startsPage]), [['C1', true], ['C2', false]])
})

test('projeto sem pasta Manuscript usa as raízes não estruturais', () => {
  seq = 0
  const docs = [fold('Trash', null, 'trash'), mk('Solto', null), mk('Apagado', 'Trash')]
  assert.deepEqual(compileManuscript(docs, 'x').items.map((i) => i.title), ['Solto'])
})

// ---------- PDF ----------

type Sec = { section: Record<string, unknown>[]; footer: unknown }
const sections = (def: PdfDefinition) => def.content as unknown as Sec[]
const breaksIn = (sec: Sec) => sec.section.filter((n) => n.pageBreak === 'before').length

test('PDF: uma página nova por capítulo e por Livro, nenhuma por parágrafo ou cena', () => {
  const def = buildPdfDefinition(compileManuscript(projeto(), 'O Livro'))
  const secs = sections(def)
  // rosto | Introdução | Livro I | Cap 1, Cap 2 + cenas | Livro II | Cap 3
  assert.equal(secs.length, 6)
  // Cada seção já abre página; dentro dela, só capítulos quebram (Cap 2 depois do Cap 1).
  assert.deepEqual(secs.map(breaksIn), [0, 0, 0, 1, 0, 0])
  assert.equal((def.defaultStyle as { font: string }).font, PDF_FONT)
})

test('PDF: folha de rosto e páginas de Livro sem número; o resto numerado', () => {
  const secs = sections(buildPdfDefinition(compileManuscript(projeto(), 'O Livro')))
  assert.deepEqual(secs.map((s) => s.footer === null ? 'sem' : typeof s.footer), ['sem', 'function', 'sem', 'function', 'sem', 'function'])
})

test('PDF: renderiza de verdade com a fonte embutida e sem página em branco', async () => {
  const require = createRequire(import.meta.url)
  const pdfmake = require('pdfmake')
  const fonts = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/export/fonts')
  pdfmake.setUrlAccessPolicy(() => false)
  pdfmake.addFonts({ [PDF_FONT]: {
    normal: `${fonts}/EBGaramond-Regular.ttf`, italics: `${fonts}/EBGaramond-Italic.ttf`,
    bold: `${fonts}/EBGaramond-Bold.ttf`, bolditalics: `${fonts}/EBGaramond-BoldItalic.ttf`,
  } })
  const buf: Buffer = await pdfmake.createPdf(buildPdfDefinition(compileManuscript(projeto(), 'O Livro'))).getBuffer()
  const pages = (buf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length
  // rosto, Introdução, Livro I, Cap 1, Cap 2 (com as cenas), Livro II, Cap 3
  assert.equal(pages, 7)
  assert.match(buf.toString('latin1'), /EBGaramond/)
})

// ---------- DOCX ----------

test('DOCX: estilos de capítulo, epígrafe, corpo e Livro, com quebra por capítulo e formatação', async () => {
  seq = 0
  const docs = projeto()
  docs.find((d) => d.id === 'Capítulo 1')!.content = '<p>Com <strong>negrito</strong> e <em>itálico</em>.</p><p style="text-align: center;">Centro</p>'
  const buf = await Packer.toBuffer(buildDocx(compileManuscript(docs, 'O Livro')))
  const zip = await JSZip.loadAsync(buf)
  const xml = await zip.file('word/document.xml')!.async('string')
  const styles = await zip.file('word/styles.xml')!.async('string')
  const count = (re: RegExp) => (xml.match(re) ?? []).length
  assert.equal(count(/<w:pStyle w:val="Heading1"\/>/g), 4)
  assert.equal(count(/<w:pageBreakBefore\/>/g), 4) // só os capítulos; Livro abre seção nova
  assert.equal(count(/<w:type w:val="nextPage"\/>/g), 2)
  assert.equal(count(/<w:pStyle w:val="ParteTitulo"\/>/g), 2)
  assert.equal(count(/<w:pStyle w:val="Epigrafe"\/>/g), 2)
  assert.equal(count(/<w:pStyle w:val="EpigrafeAutor"\/>/g), 1)
  assert.match(xml, /<w:b\/>.*?negrito/)
  assert.match(xml, /<w:i\/>.*?itálico/)
  assert.match(xml, /<w:jc w:val="center"\/>.*?Centro/)
  // centralizado sem o recuo de primeira linha do Corpo
  assert.match(xml, /<w:pStyle w:val="CorpoPrimeiro"\/><w:jc w:val="center"\/><\/w:pPr><w:r><w:t xml:space="preserve">Centro/)
  assert.doesNotMatch(xml, /Filho apagado|Nota fora/)
  assert.match(styles, /w:styleId="Epigrafe"/)
  assert.match(styles, /Garamond/)
})

// ---------- TXT / RTF ----------

test('RTF escapa acentos e aspas como \\uN e TXT sai na ordem certa', () => {
  assert.equal(rtfEscape('ação “x” {a}\\'), 'a\\u231?\\u227?o \\u8220?x\\u8221? \\{a\\}\\\\')
  const ms = compileManuscript(projeto(), 'O Livro')
  const rtf = renderRtf(ms)
  assert.ok(/^[\x00-\x7f]*$/.test(rtf), 'RTF só com ASCII')
  assert.equal((rtf.match(/\\pagebb/g) ?? []).length, 6)
  const txt = renderTxt(ms)
  assert.ok(txt.indexOf('INTRODUÇÃO') < txt.indexOf('LIVRO I') && txt.indexOf('Cena A') < txt.indexOf('CAPÍTULO 3'))
  assert.ok(!txt.includes('Filho apagado'))
})
