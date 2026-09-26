/**
 * Converte o HTML do TipTap num modelo de blocos neutro, que o PDF, o DOCX, o
 * RTF e o TXT sabem desenhar. É puro (sem DOM) para rodar nos testes em Node.
 *
 * Cobre o que o editor produz: p, h1–h6, strong/b, em/i, u, s, br, ul/ol/li,
 * blockquote, hr, pre, e o alinhamento em style="text-align: …".
 * Marcas sem efeito no livro impresso (mark, code, span de comentário, link)
 * viram texto simples.
 */

export type Align = 'left' | 'center' | 'right' | 'justify';

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
}

export type Block =
  | { type: 'paragraph'; align?: Align; runs: Run[] }
  | { type: 'heading'; level: 1 | 2 | 3; align?: Align; runs: Run[] }
  | { type: 'list'; ordered: boolean; items: Block[][] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'rule' };

type Token =
  | { kind: 'open'; tag: string; attrs: string }
  | { kind: 'close'; tag: string }
  | { kind: 'text'; text: string };

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);
const BLOCK_TAGS = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'hr', 'pre']);

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’',
  mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»',
};

export const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (whole, ent: string) => {
    if (ent[0] === '#') {
      const code = ent[1] === 'x' || ent[1] === 'X' ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ent] ?? whole;
  });

const tokenize = (html: string): Token[] => {
  const tokens: Token[] = [];
  const re = /<!--[\s\S]*?-->|<\/?([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^\s>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*\/?>|([^<]+)|</g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const [whole, tag, attrs, text] = m;
    if (whole.startsWith('<!--')) continue;
    if (tag) {
      const name = tag.toLowerCase();
      if (whole[1] === '/') tokens.push({ kind: 'close', tag: name });
      else {
        tokens.push({ kind: 'open', tag: name, attrs: attrs ?? '' });
        if (VOID_TAGS.has(name) || whole.endsWith('/>')) tokens.push({ kind: 'close', tag: name });
      }
    } else if (text !== undefined) {
      tokens.push({ kind: 'text', text: decodeEntities(text) });
    } else {
      tokens.push({ kind: 'text', text: '<' });
    }
  }
  return tokens;
};

const alignFrom = (attrs: string): Align | undefined => {
  const m = attrs.match(/text-align\s*:\s*(left|center|right|justify)/i) ?? attrs.match(/data-text-align\s*=\s*["']?(left|center|right|justify)/i);
  return m ? (m[1].toLowerCase() as Align) : undefined;
};

type Marks = Omit<Run, 'text'>;

/** Quebra de linha do <br> enquanto os espaços são colapsados; vira \n no fim. */
const BR = '\u2028';

const markFor = (tag: string): keyof Marks | null => {
  switch (tag) {
    case 'strong': case 'b': return 'bold';
    case 'em': case 'i': return 'italic';
    case 'u': return 'underline';
    case 's': case 'strike': case 'del': return 'strike';
    default: return null;
  }
};

/** Junta runs vizinhos com as mesmas marcas e colapsa espaços como o navegador faz. */
const normalizeRuns = (runs: Run[], preserveSpace = false): Run[] => {
  const out: Run[] = [];
  for (const r of runs) {
    const text = preserveSpace ? r.text.replace(/\u2028/g, '\n') : r.text.replace(/[ \t\r\n\f]+/g, ' ').replace(/\u2028/g, '\n');
    if (!text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.bold === r.bold && prev.italic === r.italic && prev.underline === r.underline && prev.strike === r.strike) {
      prev.text += text;
    } else {
      out.push({ ...r, text });
    }
  }
  if (!preserveSpace) {
    // Espaço colado a uma quebra de linha e nas pontas não aparece no navegador.
    for (let i = 0; i < out.length; i++) {
      if (i === 0) out[i].text = out[i].text.replace(/^ +/, '');
      if (i === out.length - 1) out[i].text = out[i].text.replace(/ +$/, '');
      out[i].text = out[i].text.replace(/ *\n */g, '\n');
      if (i > 0 && out[i - 1].text.endsWith(' ') && out[i].text.startsWith(' ')) out[i].text = out[i].text.slice(1);
    }
  }
  return out.filter((r) => r.text.length > 0).map((r) => {
    const clean: Run = { text: r.text };
    if (r.bold) clean.bold = true;
    if (r.italic) clean.italic = true;
    if (r.underline) clean.underline = true;
    if (r.strike) clean.strike = true;
    return clean;
  });
};

class Parser {
  private i = 0;
  constructor(private readonly tokens: Token[]) {}

  /** Lê blocos até fechar `until` (ou até o fim). */
  parseBlocks(until?: string): Block[] {
    const blocks: Block[] = [];
    let loose: Run[] = [];
    const flushLoose = () => {
      const runs = normalizeRuns(loose);
      if (runs.length) blocks.push({ type: 'paragraph', runs });
      loose = [];
    };
    while (this.i < this.tokens.length) {
      const t = this.tokens[this.i];
      if (t.kind === 'close') {
        this.i++;
        if (t.tag === until) break;
        continue;
      }
      if (t.kind === 'open' && BLOCK_TAGS.has(t.tag)) {
        flushLoose();
        this.i++;
        blocks.push(...this.parseBlock(t.tag, t.attrs));
        continue;
      }
      // Texto ou marca inline fora de bloco: parágrafo implícito.
      loose.push(...this.parseInline({}, until, true));
    }
    flushLoose();
    return blocks;
  }

  private parseBlock(tag: string, attrs: string): Block[] {
    const align = alignFrom(attrs);
    switch (tag) {
      case 'p': case 'div': case 'li': {
        // div/li podem conter blocos (TipTap põe <p> dentro de <li>).
        if (this.nextIsBlock()) {
          const inner = this.parseBlocks(tag);
          return align ? inner.map((b) => (b.type === 'paragraph' && !b.align ? { ...b, align } : b)) : inner;
        }
        const runs = normalizeRuns(this.parseInline({}, tag));
        return [{ type: 'paragraph', ...(align ? { align } : {}), runs }];
      }
      case 'pre': {
        const runs = normalizeRuns(this.parseInline({}, tag), true);
        return [{ type: 'paragraph', ...(align ? { align } : {}), runs }];
      }
      case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': {
        const level = Math.min(3, Number(tag[1])) as 1 | 2 | 3;
        const runs = normalizeRuns(this.parseInline({}, tag));
        return [{ type: 'heading', level, ...(align ? { align } : {}), runs }];
      }
      case 'ul': case 'ol': {
        const items: Block[][] = [];
        while (this.i < this.tokens.length) {
          const t = this.tokens[this.i];
          if (t.kind === 'close' && t.tag === tag) { this.i++; break; }
          if (t.kind === 'open' && t.tag === 'li') {
            this.i++;
            items.push(this.parseBlock('li', t.attrs));
            continue;
          }
          if (t.kind === 'text' && !t.text.trim()) { this.i++; continue; }
          // Conteúdo fora de <li>: trata como um item.
          const stray = this.parseBlocks(tag);
          if (stray.length) items.push(stray);
          break;
        }
        return [{ type: 'list', ordered: tag === 'ol', items }];
      }
      case 'blockquote':
        return [{ type: 'blockquote', children: this.parseBlocks('blockquote') }];
      case 'hr':
        // o tokenizer já empurrou o </hr> sintético
        if (this.tokens[this.i]?.kind === 'close') this.i++;
        return [{ type: 'rule' }];
      default:
        return [];
    }
  }

  private nextIsBlock(): boolean {
    for (let j = this.i; j < this.tokens.length; j++) {
      const t = this.tokens[j];
      if (t.kind === 'text') { if (t.text.trim()) return false; continue; }
      if (t.kind === 'close') return false;
      return BLOCK_TAGS.has(t.tag);
    }
    return false;
  }

  /**
   * Lê conteúdo inline até fechar `until`. Com `stopAtBlock`, para antes de uma
   * tag de bloco (usado no texto solto fora de parágrafo).
   */
  private parseInline(marks: Marks, until?: string, stopAtBlock = false): Run[] {
    const runs: Run[] = [];
    while (this.i < this.tokens.length) {
      const t = this.tokens[this.i];
      if (t.kind === 'text') {
        runs.push({ ...marks, text: t.text });
        this.i++;
        continue;
      }
      if (t.kind === 'close') {
        if (t.tag === until) { if (!stopAtBlock) this.i++; return runs; }
        if (stopAtBlock && BLOCK_TAGS.has(t.tag)) return runs;
        this.i++;
        // fechamento de uma marca inline: devolve ao chamador que a abriu
        if (markFor(t.tag) || ['a', 'span', 'mark', 'code', 'sub', 'sup'].includes(t.tag)) return runs;
        continue;
      }
      // open
      if (BLOCK_TAGS.has(t.tag)) {
        if (stopAtBlock) return runs;
        // bloco dentro de inline (HTML colado malformado): quebra de linha
        this.i++;
        if (t.tag === 'hr') { if (this.tokens[this.i]?.kind === 'close') this.i++; }
        runs.push({ ...marks, text: BR });
        continue;
      }
      this.i++;
      if (t.tag === 'br') {
        if (this.tokens[this.i]?.kind === 'close') this.i++;
        runs.push({ ...marks, text: BR });
        continue;
      }
      if (VOID_TAGS.has(t.tag)) { if (this.tokens[this.i]?.kind === 'close') this.i++; continue; }
      const mark = markFor(t.tag);
      runs.push(...this.parseInline(mark ? { ...marks, [mark]: true } : marks, undefined, false));
    }
    return runs;
  }
}

/** HTML do editor → blocos. HTML vazio ou só com parágrafos vazios dá []. */
export const parseHtml = (html: string | null | undefined): Block[] => {
  if (!html) return [];
  return new Parser(tokenize(html)).parseBlocks();
};

export const runsText = (runs: Run[]): string => runs.map((r) => r.text).join('');

/** Texto corrido de um bloco (para TXT e contagens). */
export const blockText = (b: Block): string => {
  switch (b.type) {
    case 'paragraph': case 'heading': return runsText(b.runs);
    case 'list': return b.items.map((item, i) => `${b.ordered ? `${i + 1}.` : '•'} ${item.map(blockText).join('\n')}`).join('\n');
    case 'blockquote': return b.children.map(blockText).join('\n');
    case 'rule': return '* * *';
  }
};

const isEmptyBlock = (b: Block): boolean => (b.type === 'paragraph' || b.type === 'heading') && runsText(b.runs).trim() === '';

/** Tira parágrafos vazios do começo e do fim (o TipTap deixa um <p></p> no final). */
export const trimEmptyBlocks = (blocks: Block[]): Block[] => {
  let start = 0;
  let end = blocks.length;
  while (start < end && isEmptyBlock(blocks[start])) start++;
  while (end > start && isEmptyBlock(blocks[end - 1])) end--;
  return blocks.slice(start, end);
};
