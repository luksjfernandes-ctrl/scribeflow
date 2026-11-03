// Regra de interface do ScribeFlow: nenhum elemento visual com ângulo reto.
// Confere o CSS do app: nenhuma declaração zera o raio (nem pela metade, como
// `6px 6px 0 0`), nenhuma classe Tailwind `rounded-none`, e os elementos que
// pintam fundo (folha do editor, itens de menu, abas, setas de tamanho) têm raio.
import { strict as assert } from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
// Sem comentários: um comentário logo antes da regra virava parte do seletor.
const css = (ler('src/index.css') + '\n' + ler('src/styles/composition.css')).replace(/\/\*[\s\S]*?\*\//g, '')

/** Corpo de cada regra cujo seletor é exatamente `seletor` (inclui @media). */
function regras(seletor: string): string[] {
  const out: string[] = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(css))) {
    if (m[1].trim().split(/\s*,\s*/).includes(seletor)) out.push(m[2])
  }
  return out
}

test('nenhum border-radius com canto zerado', () => {
  const zerados = [...css.matchAll(/border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/g)]
    .map((m) => m[1].trim())
    .filter((v) => v.split(/\s+|\//).some((p) => /^0(?:px|%|rem|em)?$/.test(p)))
  assert.deepEqual(zerados, [])
})

test('nenhuma classe rounded-none nos componentes', () => {
  const dir = new URL('../src/components/', import.meta.url)
  const arquivos = readdirSync(dir).map((f) => `src/components/${f}`).concat('src/App.tsx')
  const achados = arquivos.filter((f) => /\brounded(?:-[trblse]{1,2})?-none\b/.test(ler(f)))
  assert.deepEqual(achados, [])
})

test('elementos que pintam fundo têm raio em todas as regras', () => {
  for (const sel of ['.editor-page', '.dropdown-item', '.font-size-arrows button', '.inspector-tab']) {
    const corpos = regras(sel)
    assert.ok(corpos.length > 0, `${sel} sumiu do CSS`)
    assert.ok(corpos.some((c) => /border-radius/.test(c)), `${sel} sem border-radius`)
  }
})

test('busca rápida: a linha ativa e o anel do campo têm cantos arredondados', () => {
  const busca = ler('src/components/QuickSearch.tsx')
  // O botão de cada resultado pinta o fundo verde da linha ativa.
  const botao = busca.match(/data-idx=\{i\}[\s\S]*?className=\{`([^`]*)/)
  assert.ok(botao, 'botão do resultado não encontrado')
  assert.match(botao[1], /\brounded(-[a-z]+)?\b/, 'linha ativa sem raio')
  assert.match(busca, /quick-search-input/)
  // Anel para dentro: para fora, o overflow do modal cortava o anel em pontas retas.
  const anel = regras('.quick-search-input:focus-visible').join('')
  assert.match(anel, /outline-offset:\s*-\d/)
  assert.match(anel, /border-radius/)
})

test('Tabela: o realce da linha tem raio (e o raio vale porque a tabela não é border-collapse)', () => {
  const tabela = ler('src/components/Outliner.tsx')
  assert.doesNotMatch(tabela, /\bborder-collapse\b/, 'com border-collapse o navegador ignora o raio das células')
  assert.match(tabela, /\bborder-separate\b/)
  assert.doesNotMatch(tabela, /<tr[^>]*hover:bg-/, 'fundo no <tr> é sempre um retângulo reto')
  assert.ok(regras('.outliner-row:hover > td:first-child').some((c) => /border-(top|bottom)-left-radius/.test(c)))
  assert.ok(regras('.outliner-row:hover > td:last-child').some((c) => /border-(top|bottom)-right-radius/.test(c)))
})

test('gaveta do Binder no celular: os cantos do lado livre são arredondados', () => {
  const corpo = regras('.mobile-drawer').join('')
  const raio = corpo.match(/border-radius:\s*([^;]+);/)
  assert.ok(raio, '.mobile-drawer sem border-radius')
  const [, direitoCima, direitoBaixo] = raio[1].trim().split(/\s+/)
  assert.ok(parseFloat(direitoCima) > 0 && parseFloat(direitoBaixo) > 0, raio[1])
  assert.match(corpo, /overflow:\s*hidden/, 'sem recorte, o conteúdo pinta por cima do canto')
})
