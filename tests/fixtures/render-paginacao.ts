// Gera os PDFs de prova da paginação (sem e com controle de viúvas/órfãs).
// Uso: npx tsx tests/fixtures/render-paginacao.ts <semente> <pasta-de-saída>
import { createRequire } from 'node:module'
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compileManuscript } from '../../src/export/compile.ts'
import { buildPdfDefinition, PDF_FONT } from '../../src/export/pdf.ts'
import { capituloLongo } from './capitulo-longo.ts'

const require = createRequire(import.meta.url)
const pdfmake = require('pdfmake')
const fonts = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/export/fonts')
pdfmake.setUrlAccessPolicy(() => false)
pdfmake.addFonts({ [PDF_FONT]: {
  normal: `${fonts}/EBGaramond-Regular.ttf`, italics: `${fonts}/EBGaramond-Italic.ttf`,
  bold: `${fonts}/EBGaramond-Bold.ttf`, bolditalics: `${fonts}/EBGaramond-BoldItalic.ttf`,
} })
const [semente, pasta] = [Number(process.argv[2] ?? 7), process.argv[3] ?? '.']

type Pos = { pageNumber: number }
type Sec = { section: Record<string, unknown>[] | { stack: Record<string, unknown>[] } }
/** Mesmo critério do teste: órfã, viúva e título no pé, pelas posições de linha. */
const problemas = (content: unknown[]): string[] => {
  const nodes = (content as Sec[]).flatMap((s) => (Array.isArray(s.section) ? s.section : s.section.stack))
  const out: string[] = []
  nodes.forEach((n, i) => {
    const pos = (n.positions as Pos[] | undefined) ?? []
    if (!pos.length || typeof n.id !== 'string') return
    const pages = [...new Set(pos.map((p) => p.pageNumber))]
    if (n.id.startsWith('sf-p') && pages.length > 1) {
      if (pos.filter((p) => p.pageNumber === pages[0]).length < 2) out.push(`órfã p${pages[0]}`)
      if (pos.filter((p) => p.pageNumber === pages[pages.length - 1]).length < 2) out.push(`viúva p${pages[pages.length - 1]}`)
    }
    if (n.id.startsWith('sf-h')) {
      const next = (nodes[i + 1]?.positions as Pos[] | undefined) ?? []
      const page = pos[pos.length - 1].pageNumber
      if (next.length && next.filter((p) => p.pageNumber === page).length < Math.min(2, next.length)) out.push(`título-no-pé p${page}`)
    }
  })
  return out
}
const run = async () => {
  for (const [nome, widowControl] of [['sem', false], ['com', true]] as const) {
    const def = buildPdfDefinition(compileManuscript(capituloLongo(semente), 'Paginação'), { widowControl })
    const buf: Buffer = await pdfmake.createPdf(def).getBuffer()
    writeFileSync(path.join(pasta, `paginacao-${nome}.pdf`), buf)
    console.log(`${nome}: ${problemas(def.content).join(', ') || 'nenhum problema'}`)
  }
}
run()
