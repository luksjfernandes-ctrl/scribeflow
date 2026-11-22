// Texto puro do HTML do TipTap: uma regra só para busca, estatísticas e
// contagem de palavras (src/lib/plainText.ts).
import { strict as assert } from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'
import { countWords, htmlToText, matchesSearch } from '../src/lib/plainText'
import { countWords as countWordsDaArvore } from '../src/lib/tree'

test('entidades viram o caractere: a busca acha "tom & jerry" e "amp" some', () => {
  const html = '<p>Tom &amp; Jerry &amp; Spike &lt;3</p>'
  assert.equal(htmlToText(html), 'Tom & Jerry & Spike <3')
  assert.ok(htmlToText(html).toLowerCase().includes('tom & jerry'))
  assert.ok(!htmlToText(html).includes('amp'))
  assert.equal(htmlToText('<p>um&nbsp;dois</p>'), 'um dois')
})

test('fim de parágrafo separa palavras; formatação no meio da palavra não', () => {
  assert.equal(countWords('<p>Olá mundo</p><p>Adeus mundo</p><h2>Fim</h2>'), 5)
  assert.equal(countWords('<p>linha<br>outra</p>'), 2)
  assert.equal(countWords('<ul><li><p>um</p></li><li><p>dois</p></li></ul>'), 2)
  assert.equal(countWords('<p>pala<strong>vra</strong> só</p>'), 2)
  assert.ok(htmlToText('<p>pala<em>vra</em></p>').includes('palavra'))
})

test('vazio, nulo e só marcação contam zero', () => {
  assert.equal(countWords(''), 0)
  assert.equal(countWords(null), 0)
  assert.equal(countWords(undefined), 0)
  assert.equal(countWords('<p></p><p><br></p>'), 0)
  assert.equal(htmlToText('<p>  </p>'), '')
})

test('a contagem da árvore (Tabela, Texto contínuo) é a mesma', () => {
  const html = '<p>Olá mundo</p><p>pala<strong>vra</strong> &amp; fim</p>'
  assert.equal(countWordsDaArvore(html), countWords(html))
  assert.equal(countWordsDaArvore(html), 5)
})

test('nenhuma tela tira tags por conta própria', () => {
  const dir = new URL('../src/components/', import.meta.url)
  const arquivos = readdirSync(dir).map((f) => `src/components/${f}`).concat('src/App.tsx')
  const proprios = arquivos.filter((f) => /\.replace\(\/<\[\^>\]\*>\/g/.test(readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')))
  assert.deepEqual(proprios, [])
})

test('busca do Binder: apara o termo e acha texto com entidade ou formatação', () => {
  const doc = { title: 'Prólogo', content: '<p>Tom &amp; Jerry, pala<em>vra</em></p>', metadata: { synopsis: '' } } as never
  assert.ok(matchesSearch(doc, 'prólogo '))
  assert.ok(matchesSearch(doc, '  tom & jerry'))
  assert.ok(matchesSearch(doc, 'palavra'))
  assert.ok(!matchesSearch(doc, 'amp'))
})
