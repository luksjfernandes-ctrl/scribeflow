// Regra de interface do ScribeFlow: nenhum elemento visual com ângulo reto.
// Confere o CSS do app: nenhuma declaração zera o raio (nem pela metade, como
// `6px 6px 0 0`), nenhuma classe Tailwind `rounded-none`, e os elementos que
// pintam fundo (folha do editor, itens de menu, abas, setas de tamanho) têm raio.
import { strict as assert } from 'node:assert'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'node:test'

const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const css = ler('src/index.css') + '\n' + ler('src/styles/composition.css')

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
