/**
 * TXT e RTF, a partir do mesmo manuscrito montado pela árvore. O RTF leva
 * negrito, itálico, sublinhado, alinhamento, epígrafe e quebra de página por
 * capítulo; caracteres fora do ASCII vão como \uN, que é o que o RTF exige
 * (antes saíam em UTF-8 cru num arquivo declarado cp1252 e viravam lixo).
 */
import { Block, blockText, Run } from './html';
import type { CompileItem, Epigraph, Manuscript } from './compile';

const epigraphText = (e: Epigraph): string => [...e.lines, ...(e.attribution ? [`— ${e.attribution}`] : [])].join('\n');

const itemHeading = (item: CompileItem): string => {
  if (item.kind === 'part') return [item.label?.toUpperCase(), item.name || item.title].filter(Boolean).join('\n');
  if (item.kind === 'chapter') return item.title.toUpperCase();
  return item.title;
};

export const renderTxt = (ms: Manuscript): string => {
  const parts: string[] = [ms.title.toUpperCase()];
  for (const item of ms.items) {
    const chunk: string[] = [];
    if (item.startsPage) chunk.push('='.repeat(40));
    const head = itemHeading(item);
    if (head) chunk.push(head);
    if (item.epigraph) chunk.push(epigraphText(item.epigraph));
    const body = item.blocks.map(blockText).join('\n\n');
    if (body) chunk.push(body);
    parts.push(chunk.join('\n\n'));
  }
  return parts.join('\n\n\n') + '\n';
};

/** Escapa texto para RTF: \ { } e tudo fora do ASCII como \uN? (N com sinal, 16 bits). */
export const rtfEscape = (s: string): string => {
  let out = '';
  for (const ch of s) {
    const code = ch.codePointAt(0)!;
    if (ch === '\\' || ch === '{' || ch === '}') out += '\\' + ch;
    else if (ch === '\n') out += '\\line ';
    else if (ch === '\t') out += '\\tab ';
    else if (code < 0x80) out += ch;
    else if (code <= 0xffff) out += `\\u${code > 0x7fff ? code - 0x10000 : code}?`;
    else {
      // fora do BMP: par substituto
      const hi = 0xd800 + ((code - 0x10000) >> 10);
      const lo = 0xdc00 + ((code - 0x10000) & 0x3ff);
      out += `\\u${hi - 0x10000}?\\u${lo - 0x10000}?`;
    }
  }
  return out;
};

const rtfRuns = (runs: Run[]): string =>
  runs.map((r) => {
    const on = `${r.bold ? '\\b' : ''}${r.italic ? '\\i' : ''}${r.underline ? '\\ul' : ''}${r.strike ? '\\strike' : ''}`;
    return on ? `{${on} ${rtfEscape(r.text)}}` : rtfEscape(r.text);
  }).join('');

const RTF_ALIGN = { left: '\\ql', center: '\\qc', right: '\\qr', justify: '\\qj' } as const;

const rtfBlocks = (blocks: Block[], indentTw = 0): string => {
  let out = '';
  let afterHeading = true;
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph': {
        const fi = !afterHeading && indentTw === 0 && b.runs.length ? '\\fi567' : '';
        out += `{\\pard${RTF_ALIGN[b.align ?? 'justify']}${fi}\\li${indentTw}\\sl360\\slmult1 ${rtfRuns(b.runs)}\\par}\n`;
        afterHeading = b.runs.length === 0;
        break;
      }
      case 'heading': {
        const fs = b.level === 1 ? 32 : b.level === 2 ? 28 : 24;
        out += `{\\pard${RTF_ALIGN[b.align ?? 'left']}\\sb240\\sa120\\keepn\\b\\fs${fs} ${rtfRuns(b.runs)}\\par}\n`;
        afterHeading = true;
        break;
      }
      case 'list':
        b.items.forEach((item, i) => {
          const mark = b.ordered ? `${i + 1}.` : '\\u8226?';
          const text = item.map(blockText).join(' ');
          out += `{\\pard\\ql\\li${indentTw + 709}\\fi-354 ${mark}\\tab ${rtfEscape(text)}\\par}\n`;
        });
        afterHeading = true;
        break;
      case 'blockquote':
        out += rtfBlocks(b.children, indentTw + 1134).replace(/\\fs\d+/g, '');
        afterHeading = true;
        break;
      case 'rule':
        out += '{\\pard\\qc\\sb120\\sa120 *\\emspace *\\emspace *\\par}\n';
        afterHeading = true;
        break;
    }
  }
  return out;
};

const rtfEpigraph = (e: Epigraph): string =>
  e.lines.map((l) => `{\\pard\\qj\\li2268\\i\\fs21 ${rtfEscape(l)}\\par}\n`).join('') +
  (e.attribution ? `{\\pard\\qr\\li2268\\sa480\\fs20 ${rtfEscape(`— ${e.attribution}`)}\\par}\n` : '{\\pard\\sa480\\par}\n');

export const renderRtf = (ms: Manuscript): string => {
  let rtf = '{\\rtf1\\ansi\\ansicpg1252\\deff0\\uc1{\\fonttbl{\\f0\\froman\\fcharset0 Garamond;}}\n';
  rtf += `{\\info{\\title ${rtfEscape(ms.title)}}}\n`;
  rtf += '\\paperw11906\\paperh16838\\margl1701\\margr1417\\margt1417\\margb1417\\f0\\fs24\n';
  rtf += `{\\pard\\qc\\sb4536\\fs60 ${rtfEscape(ms.title)}\\par}\n`;
  for (const item of ms.items) {
    const brk = item.startsPage ? '\\pagebb' : '';
    if (item.kind === 'part') {
      if (item.label) rtf += `{\\pard\\qc${brk}\\sb3600\\sa120\\expndtw60\\fs24 ${rtfEscape(item.label.toUpperCase())}\\par}\n`;
      rtf += `{\\pard\\qc${item.label ? '' : brk + '\\sb3600'}\\sa567\\fs56 ${rtfEscape(item.name || item.title)}\\par}\n`;
    } else if (item.kind === 'chapter') {
      rtf += `{\\pard\\qc${brk}\\sb1701\\sa510\\keepn\\fs44 ${rtfEscape(item.title)}\\par}\n`;
    } else if (item.title) {
      rtf += `{\\pard\\qc${brk}\\sb454\\sa227\\keepn\\fs30 ${rtfEscape(item.title)}\\par}\n`;
    } else if (brk) {
      rtf += `{\\pard${brk}\\par}\n`;
    }
    if (item.epigraph) rtf += rtfEpigraph(item.epigraph);
    rtf += rtfBlocks(item.blocks);
  }
  return rtf + '}';
};
