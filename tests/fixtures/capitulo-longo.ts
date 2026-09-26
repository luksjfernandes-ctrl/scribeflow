import type { Doc } from '../../src/types.ts'

/**
 * Capítulo longo e determinístico (gerador linear congruente): 70 parágrafos de
 * 1 a 9 linhas e títulos internos, para provocar viúvas, órfãs e título no pé.
 */
export const capituloLongo = (semente = 7): Doc[] => {
  const palavras = 'ação coração memória cidade silêncio janela tempo caminho palavra rio casa noite luz voz mãe pai infância escola'.split(' ')
  let x = semente
  const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648
  const frase = (n: number) => Array.from({ length: n }, () => palavras[Math.floor(rnd() * palavras.length)]).join(' ')
  const partes: string[] = []
  for (let i = 0; i < 70; i++) {
    if (i % 11 === 5) partes.push(`<h2>Seção ${i}</h2>`)
    const tam = [4, 12, 22, 35, 50, 70, 95][Math.floor(rnd() * 7)]
    partes.push(`<p>${frase(tam)}.</p>`)
  }
  const meta = (extra: Record<string, unknown> = {}) => ({ created_at: 0, is_include_in_compile: true, ...extra })
  return [
    { id: 'm', title: 'Manuscript', content: '', type: 'folder', parent_id: null, order: 0, metadata: meta({ folder_role: 'manuscript' }) },
    { id: 'c', title: 'Capítulo longo', content: partes.join(''), type: 'text', parent_id: 'm', order: 0, metadata: meta() },
  ] as unknown as Doc[]
}
