// Exportação: caracteres de controle não podem corromper o DOCX, e listas
// mantêm o número inicial, o aninhamento e a formatação em todos os formatos.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import JSZip from 'jszip'
import { Packer } from 'docx'
import { parseHtml } from '../src/export/html.ts'
import type { Manuscript } from '../src/export/compile.ts'
import { buildDocx } from '../src/export/docx.ts'
import { buildPdfDefinition } from '../src/export/pdf.ts'
import { renderRtf, renderTxt } from '../src/export/text.ts'

const manuscrito = (html: string, title = 'Capítulo'): Manuscript =>
  ({ title: 'Livro', items: [{ id: '1', kind: 'chapter', title, depth: 0, startsPage: true, epigraph: null, blocks: parseHtml(html) }] }) as unknown as Manuscript

const docxParte = async (ms: Manuscript, parte = 'word/document.xml') =>
  (await JSZip.loadAsync(await Packer.toBuffer(buildDocx(ms)))).file(parte)!.async('string')

// Proibidos pelo XML 1.0: qualquer um deles faz o Word recusar o arquivo.
const PROIBIDO = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/

test('caracteres de controle no texto e no título não chegam ao XML do DOCX', async () => {
  const ms = manuscrito('<p>linha um\u000Blinha dois &#1; fim &#xD800;</p><pre>a\u0007b</pre>', 'Título\u0002')
  const xml = await docxParte(ms)
  assert.doesNotMatch(xml, PROIBIDO)
  assert.match(xml, /linha um linha dois/)
  assert.match(xml, />Título</)
})

test('parseHtml: quebra manual do Word (U+000B) vira espaço; outros controles somem', () => {
  assert.deepEqual(parseHtml('<p>a\u000Bb\u0001c</p>'), [{ type: 'paragraph', runs: [{ text: 'a bc' }] }])
})

const LISTA_EM_3 = '<ol start="3"><li><p>três</p></li><li><p>quatro</p></li></ol>'

test('<ol start> mantém a numeração no TXT, RTF e PDF', () => {
  const ms = manuscrito(LISTA_EM_3)
  assert.match(renderTxt(ms), /3\. três\n4\. quatro/)
  const rtf = renderRtf(ms)
  assert.match(rtf, / 3\.\\tab tr/)
  assert.match(rtf, / 4\.\\tab quatro/)
  const ol = JSON.stringify(buildPdfDefinition(ms).content)
  assert.match(ol, /"ol":\[.*?\],"start":3/)
})

test('<ol start> mantém a numeração no DOCX', async () => {
  const numbering = await docxParte(manuscrito(LISTA_EM_3), 'word/numbering.xml')
  assert.match(numbering, /<w:start w:val="3"\/>/)
  // A lista comum continua começando em 1.
  const comum = await docxParte(manuscrito('<ol><li><p>um</p></li></ol>'), 'word/numbering.xml')
  assert.doesNotMatch(comum, /<w:start w:val="3"\/>/)
})

const ANINHADA = '<ol><li><p>um</p><ol><li><p>aninhado</p></li></ol><p>segundo parágrafo</p></li><li><p>dois</p></li></ol>'

test('DOCX: lista dentro de item desce um nível; parágrafo extra do item fica recuado', async () => {
  const xml = await docxParte(manuscrito(ANINHADA))
  const paragrafo = (texto: string) => xml.match(new RegExp(`<w:p>(?:(?!</w:p>).)*?${texto}(?:(?!</w:p>).)*?</w:p>`))![0]
  assert.match(paragrafo('>um<'), /<w:ilvl w:val="0"\/>/)
  assert.match(paragrafo('aninhado'), /<w:ilvl w:val="1"\/>/)
  assert.match(paragrafo('segundo parágrafo'), /<w:ind w:left="\d+"/)
  assert.match(paragrafo('>dois<'), /<w:ilvl w:val="0"\/>/)
})

test('RTF: item de lista mantém negrito/itálico e a lista aninhada vai para a linha de baixo', () => {
  const rtf = renderRtf(manuscrito('<ul><li><p><strong>Negrito</strong> e <em>itálico</em></p><ul><li><p>filho</p></li></ul></li></ul>'))
  const linhas = rtf.split('\n').filter((l) => l.includes('\\fi-354'))
  assert.equal(linhas.length, 2)
  assert.match(linhas[0], /\\li709\\fi-354 \\u8226\?\\tab \{\\b Negrito\} e \{\\i it/)
  assert.match(linhas[1], /\\li1418\\fi-354 \\u8226\?\\tab filho/)
})
