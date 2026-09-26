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
import { Pagination } from './pdfPagination';

// pdfmake não tem tipos para a 0.3; o contrato usado aqui é pequeno.
export type PdfNode = Record<string, unknown>;
export interface PdfDefinition extends PdfNode {
  content: PdfNode[];
}

export const PDF_FONT = 'EBGaramond';

const CM = 72 / 2.54;

/**
 * Tamanho da página. '14x21' (padrão do PDF): o formato mais comum no livro
 * brasileiro. 'a4': a folha do DOCX, com as mesmas margens de lá (mancha de 13,4 cm).
 * Laterais iguais: é PDF de leitura (página simples), e o que é centralizado cai no meio da folha.
 */
export type PageSizeId = '14x21' | 'a4';
const PAGE_SIZES: Record<PageSizeId, { width: number; height: number; margins: number[] }> = {
  '14x21': { width: 14 * CM, height: 21 * CM, margins: [1.9 * CM, 1.8 * CM, 1.9 * CM, 2.2 * CM] }, // esq., topo, dir., base
  a4: { width: 21 * CM, height: 29.7 * CM, margins: [3.8 * CM, 3 * CM, 3.8 * CM, 3 * CM] },
};

interface Geometry {
  width: number;
  height: number;
  margins: number[];
  /** Título de capítulo afundado: o topo do título fica a ~1/3 da altura da página. */
  chapterDrop: number;
  /** Altura útil da página (entre as margens de cima e de baixo). */
  contentHeight: number;
}

export const pageGeometry = (size: PageSizeId = '14x21'): Geometry => {
  const { width, height, margins } = PAGE_SIZES[size] ?? PAGE_SIZES['14x21'];
  return { width, height, margins, chapterDrop: height / 3 - margins[1], contentHeight: height - margins[1] - margins[3] };
};

const BODY_SIZE = 11;
const INDENT = 1.25 * BODY_SIZE; // recuo de primeira linha de livro: 1,25em
const LINE_HEIGHT = 1.32;

/**
 * Estilo de parágrafo. 'book': recuo de primeira linha e nenhum espaço entre
 * parágrafos, sem recuo no primeiro depois de título, cena ou separador.
 * 'blocks': sem recuo, com espaço entre parágrafos.
 */
export type ParagraphStyle = 'book' | 'blocks';
export interface PdfOptions {
  paragraphStyle?: ParagraphStyle;
  /** Controle de viúvas, órfãs e título no pé (padrão: ligado). Desligar serve para comparação. */
  widowControl?: boolean;
  /** Tamanho da página (padrão: 14 × 21 cm). */
  pageSize?: PageSizeId;
}
const BLOCK_GAP = 0.6 * BODY_SIZE;

const runNode = (r: Run): PdfNode => {
  const n: PdfNode = { text: r.text };
  if (r.bold) n.bold = true;
  if (r.italic) n.italics = true;
  if (r.underline) n.decoration = 'underline';
  else if (r.strike) n.decoration = 'lineThrough';
  return n;
};

const runsNode = (runs: Run[]): PdfNode[] | string => (runs.length ? runs.map(runNode) : ' ');

interface BlockOpts {
  bookIndent: boolean;
  defaultAlign: Align;
  style: ParagraphStyle;
  geo: Geometry;
  /** Controle de viúvas, órfãs e título no pé (só no corpo corrido das seções). */
  pagination?: Pagination;
}

/**
 * Blocos do corpo. `bookIndent`: aplica o estilo de parágrafo (fora de lista
 * e citação, que têm recuo próprio).
 */
const blocksToNodes = (blocks: Block[], opts: BlockOpts): PdfNode[] => {
  const out: PdfNode[] = [];
  let afterHeading = true;
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph': {
        const align = b.align ?? opts.defaultAlign;
        const book = opts.style === 'book';
        const indent = opts.bookIndent && book && !afterHeading && (align === 'justify' || align === 'left') && b.runs.length > 0;
        const gap = opts.bookIndent && !book ? { margin: [0, 0, 0, BLOCK_GAP] } : {};
        const node: PdfNode = { text: runsNode(b.runs), alignment: align, ...(indent ? { leadingIndent: INDENT } : {}), ...gap };
        const pagination = opts.bookIndent ? opts.pagination : undefined;
        // A continuação (depois de uma viúva) segue sem recuo, com o mesmo alinhamento.
        if (pagination && b.runs.length > 0) out.push(pagination.trackParagraph(node, b.runs, (tail) => ({ text: runsNode(tail), alignment: align, ...gap })));
        // Linha em branco no corpo: some se cair no topo da página.
        else if (pagination) out.push(pagination.trackBlank(node));
        else out.push(node);
        afterHeading = b.runs.length === 0;
        break;
      }
      case 'heading': {
        const size = b.level === 1 ? 15 : b.level === 2 ? 13 : 11.5;
        const heading: PdfNode = {
          text: runsNode(b.runs),
          fontSize: size,
          bold: b.level !== 3,
          italics: b.level === 3,
          alignment: b.align ?? 'left',
          margin: [0, size * 1.1, 0, size * 0.45],
          headlineLevel: b.level,
        };
        out.push(opts.pagination && opts.bookIndent ? opts.pagination.trackHeading(heading) : heading);
        afterHeading = true;
        break;
      }
      case 'list': {
        const items = b.items.map((item) => ({ stack: blocksToNodes(item, { ...opts, bookIndent: false, defaultAlign: 'left' }) }));
        out.push({ [b.ordered ? 'ol' : 'ul']: items, margin: [INDENT, 4, 0, 4] });
        afterHeading = true;
        break;
      }
      case 'blockquote':
        out.push({
          stack: blocksToNodes(b.children, { ...opts, bookIndent: false, defaultAlign: 'justify' }),
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

/**
 * Epígrafe de livro: bloco recuado, itálico, corpo menor, alinhado à esquerda
 * (justificar poucas palavras por linha abre buracos). A atribuição vem em
 * linha própria, à direita, com "— ", em redondo e versalete (smcp da EB Garamond).
 */
export const epigraphNode = (e: Epigraph, geo: Geometry = pageGeometry()): PdfNode => ({
  stack: e.lines.map((line) => {
    if (line.kind === 'attribution') {
      return { text: line.display, italics: false, fontFeatures: ['smcp'], alignment: 'right', margin: [0, 5, 0, 0], fontSize: BODY_SIZE - 1.5 };
    }
    // Linha em branco separa estrofes.
    if (line.kind === 'blank') return { text: '\u00A0', fontSize: (BODY_SIZE - 1.5) / 2 };
    return { text: line.display, italics: true, alignment: 'left' };
  }),
  fontSize: BODY_SIZE - 1.5,
  lineHeight: 1.25,
  margin: [geo.width * 0.25, 0, 0, 30],
  unbreakable: true,
});

/** Tabela de uma célula da altura da página, para centralizar na vertical. */
const NO_LINES = {
  hLineWidth: () => 0, vLineWidth: () => 0,
  paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 0,
};

/** Conteúdo centralizado na vertical numa página própria. */
const verticallyCentered = (stack: PdfNode[], geo: Geometry): PdfNode => ({
  table: {
    widths: ['*'],
    // 1 pt de folga: a célula da altura exata empurraria para a página seguinte.
    heights: [geo.contentHeight - 1],
    body: [[{ stack, verticalAlignment: 'middle' }]],
  },
  layout: NO_LINES,
});

/** Página de Livro/Parte: rótulo, nome e epígrafe centralizados na vertical. */
const partNodes = (item: CompileItem, opts: BlockOpts): PdfNode[] => {
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
    margin: [0, 0, 0, item.epigraph || item.blocks.length ? 28 : 0],
  });
  const stack = [
    ...head,
    ...(item.epigraph ? [epigraphNode(item.epigraph, opts.geo)] : []),
    ...blocksToNodes(item.blocks, opts),
  ];
  return [verticallyCentered(stack, opts.geo)];
};

const chapterNodes = (item: CompileItem, partId: string | null, opts: BlockOpts): PdfNode[] => {
  const head: PdfNode[] = [];
  if (item.title) {
    head.push({
      text: item.title,
      outline: true,
      ...(partId ? { outlineParentId: `part:${partId}` } : {}),
      alignment: 'center',
      fontSize: 20,
      lineHeight: 1.1,
      margin: [0, 0, 0, item.epigraph ? 30 : 40],
    });
  }
  if (item.epigraph) head.push(epigraphNode(item.epigraph, opts.geo));
  const top: PdfNode = { stack: head.length ? head : [{ text: '' }], margin: [0, opts.geo.chapterDrop, 0, 0], pageBreak: 'before' };
  return [opts.pagination ? opts.pagination.markHead(top) : top, ...blocksToNodes(item.blocks, opts)];
};

const sectionNodes = (item: CompileItem, opts: BlockOpts): PdfNode[] => {
  const out: PdfNode[] = [];
  const top = item.startsPage ? opts.geo.chapterDrop : 18;
  if (item.title) {
    const title: PdfNode = {
      text: item.title,
      alignment: 'center',
      fontSize: item.depth === 1 ? 13.5 : 12,
      italics: item.depth > 1,
      margin: [0, top, 0, item.epigraph ? 12 : 10],
      ...(item.startsPage ? { pageBreak: 'before' } : {}),
    };
    if (!opts.pagination) out.push(title);
    else out.push(item.startsPage ? opts.pagination.markHead(title) : opts.pagination.trackHeading(title));
  } else if (item.startsPage) {
    out.push({ text: '', pageBreak: 'before' });
  }
  if (item.epigraph) {
    const epigraph = epigraphNode(item.epigraph, opts.geo);
    out.push(opts.pagination ? opts.pagination.markHead(epigraph) : epigraph);
  }
  out.push(...blocksToNodes(item.blocks, opts));
  return out;
};

const pageNumber = (currentPage: number): PdfNode => ({ text: String(currentPage), alignment: 'center', fontSize: 9, margin: [0, 0.8 * CM, 0, 0] });

/**
 * Seção do pdfmake: começa em página nova e tem rodapé próprio. Folha de rosto
 * e Livro/Parte vão em seções sem rodapé (sem número de página); o resto, em
 * seções numeradas. A numeração conta todas as páginas, como no livro impresso.
 */
const section = (nodes: PdfNode[], numbered: boolean, pagination?: Pagination): PdfNode => {
  // A seção já abre página nova: a quebra do primeiro nó geraria página em branco.
  // Tira no próprio objeto (uma cópia perderia o rastreamento da paginação).
  if (nodes[0]?.pageBreak === 'before') delete nodes[0].pageBreak;
  const list = nodes.length ? nodes : [{ text: '' }];
  pagination?.attach(list);
  return {
    section: list,
    pageSize: 'inherit',
    pageMargins: 'inherit',
    footer: numbered ? pageNumber : null,
  };
};

export const buildPdfDefinition = (ms: Manuscript, options: PdfOptions = {}): PdfDefinition => {
  const geo = pageGeometry(options.pageSize);
  const pagination = new Pagination(geo.margins[1]);
  const opts: BlockOpts = { bookIndent: true, defaultAlign: 'justify', style: options.paragraphStyle ?? 'book', geo, pagination };
  const content: PdfNode[] = [
    section([verticallyCentered([{ text: ms.title, fontSize: 26, alignment: 'center', lineHeight: 1.1 }], geo)], false),
  ];
  let body: PdfNode[] = [];
  const flush = () => {
    if (body.length) content.push(section(body, true, pagination));
    body = [];
  };
  let partId: string | null = null;
  for (const item of ms.items) {
    if (item.kind === 'part') {
      flush();
      partId = item.id;
      // Página de Livro fica numa célula de tabela: sem controle de viúva ali.
      content.push(section(partNodes(item, { ...opts, pagination: undefined }), false));
    } else if (item.kind === 'chapter') body.push(...chapterNodes(item, partId, opts));
    else body.push(...sectionNodes(item, opts));
  }
  flush();

  return {
    pageSize: { width: geo.width, height: geo.height },
    pageMargins: geo.margins,
    info: { title: ms.title, creator: 'ScribeFlow', producer: 'ScribeFlow' },
    defaultStyle: { font: PDF_FONT, fontSize: BODY_SIZE, lineHeight: LINE_HEIGHT },
    content,
    ...(options.widowControl === false ? {} : { pageBreakBefore: pagination.pageBreakBefore }),
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

export const renderPdf = async (ms: Manuscript, options: PdfOptions = {}): Promise<Blob> => {
  const pdfMake = await loadPdfMake();
  return pdfMake.createPdf(buildPdfDefinition(ms, options)).getBlob();
};
