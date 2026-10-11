import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { parseHtml } from '../src/export/html.ts'
import { renderRtf } from '../src/export/text.ts'
import type { Manuscript } from '../src/export/compile.ts'

const livro = (html: string): Manuscript => ({
  title: 'Livro',
  items: [{ id: 'c1', kind: 'chapter', title: 'Capítulo 1', depth: 0, startsPage: true, epigraph: null, blocks: parseHtml(html) }],
})

test('citacao no RTF preserva texto do usuario com "\\fs12"', () => {
  const rtf = renderRtf(livro('<blockquote><p>C:\\fs12\\dados</p></blockquote>'))
  // rtfEscape dobra a barra: o texto tem que sair inteiro, com as barras dobradas.
  assert.ok(rtf.includes('C:\\\\fs12\\\\dados'), rtf)
})

test('titulo dentro de citacao sai sem tamanho de fonte; fora dela, com', () => {
  const dentro = renderRtf(livro('<blockquote><h2>Dentro</h2></blockquote>'))
  assert.ok(/\\b Dentro\\par/.test(dentro), dentro)
  const fora = renderRtf(livro('<h2>Fora</h2>'))
  assert.ok(fora.includes('\\b\\fs28 Fora\\par'), fora)
})
