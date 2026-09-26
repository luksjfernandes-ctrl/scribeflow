/**
 * PDF do manuscrito com pdfmake: fluxo contínuo, página nova só em capítulo e
 * em Livro/Parte, formatação do editor preservada e fonte serifada embutida
 * (EB Garamond, SIL OFL), para acentos, aspas curvas e grego saírem certos.
 *
 * `buildPdfDefinition` é puro (testável em Node); `renderPdf` carrega o pdfmake
 * e as fontes só na hora de exportar, fora do bundle principal.
 */
import type { Align, Block, Run } from './html';
import type { CompileItem, Epigraph, Manuscript } from './compile';

// pdfmake não tem tipos para a 0.3; o contrato usado aqui é pequeno.
export type PdfNode = Record<string, unknown>;
export interface PdfDefinition extends PdfNode {
  content: PdfNode[];
}

export const PDF_FONT = 'EBGaramond';

const CM = 72 / 2.54;
/** Formato 14 × 21 cm, o mais comum no livro brasileiro. */
export const PAGE = { width: 14 * CM, height: 21 * CM };
const MARGINS = [2 * CM, 1.8 * CM, 1.7 * CM, 2.2 * CM]; // esq., topo, dir., base
const BODY_SIZE = 11;
const INDENT = 1.2 * 11; // recuo de primeira linha: ~1 quadratim

const runNode = (r: Run): PdfNode => {
  const n: PdfNode = { text: r.text };
  if (r.bold) n.bold = true;
  if (r.italic) n.italics = true;
  if (r.underline) n.decoration = 'underline';
  else if (r.strike) n.decoration = 'lineThrough';
  return n;
};

const runsNode = (runs: Run[]): PdfNode[] | string => (runs.length ? runs.map(runNode) : ' ');

/**
 * Blocos do corpo. `bookIndent`: recuo de primeira linha, menos no primeiro
 * parágrafo depois de título, como em livro.
 */
const blocksToNodes = (blocks: Block[], opts: { bookIndent: boolean; defaultAlign: Align }): PdfNode[] => {
  const out: PdfNode[] = [];
  let afterHeading = true;
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph': {
        const align = b.align ?? opts.defaultAlign;
        const indent = opts.bookIndent && !afterHeading && (align === 'justify' || align === 'left') && b.runs.length > 0;
        out.push({ text: runsNode(b.runs), alignment: align, ...(indent ? { leadingIndent: INDENT } : {}) });
        afterHeading = b.runs.length === 0;
        break;
      }
      case 'heading': {
        const size = b.level === 1 ? 15 : b.level === 2 ? 13 : 11.5;
        out.push({
          text: runsNode(b.runs),
          fontSize: size,
          bold: b.level !== 3,
          italics: b.level === 3,
          alignment: b.align ?? 'left',
          margin: [0, size * 1.1, 0, size * 0.45],
          headlineLevel: b.level,
        });
        afterHeading = true;
        break;
      }
      case 'list': {
        const items = b.items.map((item) => ({ stack: blocksToNodes(item, { bookIndent: false, defaultAlign: 'left' }) }));
        out.push({ [b.ordered ? 'ol' : 'ul']: items, margin: [INDENT, 4, 0, 4] });
        afterHeading = true;
        break;
      }
      case 'blockquote':
        out.push({
          stack: blocksToNodes(b.children, { bookIndent: false, defaultAlign: 'justify' }),
          fontSize: BODY_SIZE - 1,
          margin: [INDENT * 1.6, 6, INDENT * 1.6, 6],
        });
        afterHeading = true;
        break;
      case 'rule':
        out.push({ text: '* * *', alignment: 'center', margin: [0, 8, 0, 8] });
        afterHeading = true;
        break;
    }
  }
  return out;
};

/** Epígrafe de livro: bloco recuado, itálico, justificado, corpo menor; atribuição à direita. */
export const epigraphNode = (e: Epigraph): PdfNode => ({
  stack: [
    ...e.lines.map((line) => ({ text: line, italics: true, alignment: 'justify' })),
    ...(e.attribution ? [{ text: `— ${e.attribution}`, alignment: 'right', margin: [0, 4, 0, 0], fontSize: BODY_SIZE - 2 }] : []),
  ],
  fontSize: BODY_SIZE - 1.5,
  lineHeight: 1.2,
  margin: [PAGE.width * 0.22, 0, 0, 22],
  unbreakable: true,
});

const partNodes = (item: CompileItem): PdfNode[] => {
  const head: PdfNode[] = [];
  if (item.label) {
    head.push({ text: item.label.toUpperCase(), alignment: 'center', fontSize: 10.5, characterSpacing: 2.2, margin: [0, 0, 0, 10] });
  }
  head.push({
    id: `part:${item.id}`,
    text: item.name || item.title,
    outline: true,
    outlineText: item.title,
    outlineExpanded: true,
    alignment: 'center',
    fontSize: 24,
    lineHeight: 1.1,
    margin: [0, 0, 0, 28],
  });
  return [
    {
      stack: [...head, ...(item.epigraph ? [epigraphNode(item.epigraph)] : [])],
      margin: [0, PAGE.height * 0.24, 0, 0],
      pageBreak: 'before',
    },
    ...blocksToNodes(item.blocks, { bookIndent: true, defaultAlign: 'justify' }),
  ];
};

const chapterNodes = (item: CompileItem, partId: string | null): PdfNode[] => {
  const head: PdfNode[] = [];
  if (item.title) {
    head.push({
      text: item.title,
      outline: true,
      ...(partId ? { outlineParentId: `part:${partId}` } : {}),
      alignment: 'center',
      fontSize: 20,
      lineHeight: 1.1,
      margin: [0, 0, 0, item.epigraph ? 22 : 30],
    });
  }
  if (item.epigraph) head.push(epigraphNode(item.epigraph));
  return [
    { stack: head.length ? head : [{ text: '' }], margin: [0, PAGE.height * 0.12, 0, 0], pageBreak: 'before' },
    ...blocksToNodes(item.blocks, { bookIndent: true, defaultAlign: 'justify' }),
  ];
};

const sectionNodes = (item: CompileItem): PdfNode[] => {
  const out: PdfNode[] = [];
  const top = item.startsPage ? PAGE.height * 0.12 : 16;
  if (item.title) {
    out.push({
      text: item.title,
      alignment: 'center',
      fontSize: item.depth === 1 ? 13.5 : 12,
      italics: item.depth > 1,
      margin: [0, top, 0, item.epigraph ? 12 : 10],
      ...(item.startsPage ? { pageBreak: 'before' } : {}),
    });
  } else if (item.startsPage) {
    out.push({ text: '', pageBreak: 'before' });
  }
  if (item.epigraph) out.push(epigraphNode(item.epigraph));
  out.push(...blocksToNodes(item.blocks, { bookIndent: true, defaultAlign: 'justify' }));
  return out;
};

const pageNumber = (currentPage: number): PdfNode => ({ text: String(currentPage), alignment: 'center', fontSize: 9, margin: [0, 0.8 * CM, 0, 0] });

/**
 * Seção do pdfmake: começa em página nova e tem rodapé próprio. Folha de rosto
 * e Livro/Parte vão em seções sem rodapé (sem número de página); o resto, em
 * seções numeradas. A numeração conta todas as páginas, como no livro impresso.
 */
const section = (nodes: PdfNode[], numbered: boolean): PdfNode => {
  // A seção já abre página nova: a quebra do primeiro nó geraria página em branco.
  const [first, ...rest] = nodes;
  const head = first && first.pageBreak === 'before' ? (({ pageBreak: _drop, ...keep }) => keep)(first) : first;
  return {
    section: head ? [head, ...rest] : [{ text: '' }],
    pageSize: 'inherit',
    pageMargins: 'inherit',
    footer: numbered ? pageNumber : null,
  };
};

export const buildPdfDefinition = (ms: Manuscript): PdfDefinition => {
  const content: PdfNode[] = [
    section([{ stack: [{ text: ms.title, fontSize: 26, alignment: 'center', lineHeight: 1.1 }], margin: [0, PAGE.height * 0.28, 0, 0] }], false),
  ];
  let body: PdfNode[] = [];
  const flush = () => {
    if (body.length) content.push(section(body, true));
    body = [];
  };
  let partId: string | null = null;
  for (const item of ms.items) {
    if (item.kind === 'part') {
      flush();
      partId = item.id;
      content.push(section(partNodes(item), false));
    } else if (item.kind === 'chapter') body.push(...chapterNodes(item, partId));
    else body.push(...sectionNodes(item));
  }
  flush();

  return {
    pageSize: { width: PAGE.width, height: PAGE.height },
    pageMargins: MARGINS,
    info: { title: ms.title, creator: 'ScribeFlow', producer: 'ScribeFlow' },
    defaultStyle: { font: PDF_FONT, fontSize: BODY_SIZE, lineHeight: 1.22 },
    content,
  };
};

type PdfMakeLike = {
  addVirtualFileSystem: (vfs: Record<string, string>) => void;
  addFonts: (fonts: Record<string, Record<string, string>>) => void;
  createPdf: (def: PdfDefinition) => { getBlob: () => Promise<Blob> };
};

let pdfMakeReady: Promise<PdfMakeLike> | null = null;

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/** Carrega pdfmake + fontes uma vez por sessão, sob demanda. */
const loadPdfMake = (): Promise<PdfMakeLike> => {
  pdfMakeReady ??= (async () => {
    const [mod, regular, italic, bold, boldItalic] = await Promise.all([
      import('pdfmake/build/pdfmake'),
      import('./fonts/EBGaramond-Regular.ttf?url'),
      import('./fonts/EBGaramond-Italic.ttf?url'),
      import('./fonts/EBGaramond-Bold.ttf?url'),
      import('./fonts/EBGaramond-BoldItalic.ttf?url'),
    ]);
    const pdfMake = ((mod as { default?: unknown }).default ?? mod) as PdfMakeLike;
    const files = { 'regular.ttf': regular.default, 'italic.ttf': italic.default, 'bold.ttf': bold.default, 'bolditalic.ttf': boldItalic.default };
    const vfs: Record<string, string> = {};
    await Promise.all(Object.entries(files).map(async ([name, url]) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`fonte ${name}: HTTP ${res.status}`);
      vfs[name] = toBase64(await res.arrayBuffer());
    }));
    pdfMake.addVirtualFileSystem(vfs);
    pdfMake.addFonts({ [PDF_FONT]: { normal: 'regular.ttf', italics: 'italic.ttf', bold: 'bold.ttf', bolditalics: 'bolditalic.ttf' } });
    return pdfMake;
  })().catch((err) => { pdfMakeReady = null; throw err; });
  return pdfMakeReady;
};

export const renderPdf = async (ms: Manuscript): Promise<Blob> => {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(buildPdfDefinition(ms)).getBlob();
};
