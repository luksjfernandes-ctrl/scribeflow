/**
 * Corrige a justificação do pdfmake 0.3 (ElementWriter.alignLine).
 *
 * O pdfmake reparte a sobra da linha justificada entre TODOS os pedaços de
 * texto (inlines), e um pedaço novo começa em cada troca de estilo. Assim,
 * "<em>itálico</em>." ganhava espaço entre a palavra e o ponto, e o negrito
 * ganhava espaço dos dois lados ("itálico ." no PDF). Aqui a sobra vai só
 * para as fronteiras que são espaço de verdade (pedaço anterior termina em
 * espaço), como no Word e no navegador.
 *
 * Roda no postinstall, no prebuild e no pretest; é idempotente e falha alto
 * se o trecho original sumir (pdfmake atualizado: rever a correção).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const MARK = 'scribeflow: justifica só nos espaços v2';

const ORIGINAL = /( *)if \(alignment === 'justify' && !line\.newLineForced && !line\.lastLineInParagraph && line\.inlines\.length > 1\) \{\n\s*let additionalSpacing = \(width - lineWidth\) \/ \(line\.inlines\.length - 1\);\n\s*for \(let i = 1, l = line\.inlines\.length; i < l; i\+\+\) \{\n\s*offset = i \* additionalSpacing;\n\s*line\.inlines\[i\]\.x \+= offset;\n\s*line\.inlines\[i\]\.justifyShift = additionalSpacing;\n\s*\}\n\s*\}/;

const patched = (pad) => [
  `${pad}if (alignment === 'justify' && !line.newLineForced && !line.lastLineInParagraph && line.inlines.length > 1) {`,
  `${pad}  // ${MARK} (scripts/patch-pdfmake.mjs)`,
  // Fronteira de espaço: o pedaço anterior termina em espaço, ou este começa com
  // espaço (o nbsp que o editor grava depois de uma marca) e não é só espaço.
  `${pad}  const isGap = (i) => /\\s$/.test(line.inlines[i - 1].text || '') || /^\\s+\\S/.test(line.inlines[i].text || '');`,
  `${pad}  let gaps = 0;`,
  `${pad}  for (let i = 1, l = line.inlines.length; i < l; i++) if (isGap(i)) gaps++;`,
  `${pad}  if (gaps > 0) {`,
  `${pad}    let additionalSpacing = (width - lineWidth) / gaps;`,
  `${pad}    let shift = 0;`,
  `${pad}    for (let i = 1, l = line.inlines.length; i < l; i++) {`,
  `${pad}      if (isGap(i)) {`,
  `${pad}        shift += additionalSpacing;`,
  `${pad}        line.inlines[i].justifyShift = additionalSpacing;`,
  `${pad}      }`,
  `${pad}      line.inlines[i].x += shift;`,
  `${pad}    }`,
  `${pad}  }`,
  `${pad}}`,
].join('\n');

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('pdfmake/package.json'));
// js/ é o que o Node usa (testes); build/pdfmake.js é o que o Vite empacota.
const files = ['js/ElementWriter.js', 'build/pdfmake.js'].map((f) => path.join(root, f));

let failed = false;
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  if (src.includes(MARK)) continue;
  const m = src.match(ORIGINAL);
  if (!m) {
    console.error(`[patch-pdfmake] trecho da justificação não encontrado em ${file}`);
    failed = true;
    continue;
  }
  writeFileSync(file, src.replace(ORIGINAL, patched(m[1])));
  console.log(`[patch-pdfmake] justificação corrigida em ${path.relative(process.cwd(), file)}`);
}
if (failed) process.exit(1);
