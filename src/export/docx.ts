/**
 * DOCX do manuscrito com a lib `docx`, na mesma estrutura do PDF: folha de
 * rosto, Livro/Parte em página própria, capítulo em página nova com epígrafe,
 * corpo com a formatação do editor. Tudo por estilos nomeados, para quem abrir
 * no Word poder ajustar o livro inteiro mudando um estilo.
 *
 * O DOCX sai em A4 (para editar), com margens de livro: mancha de ~13,4 cm, que
 * dá ~70 caracteres por linha em Palatino 12. O PDF sai em 14 × 21 cm.
 */
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  TextRun,
  type ISectionOptions,
} from 'docx';
import JSZip from 'jszip';
import { blockText, type Align, type Block, type Run } from './html';
import type { CompileItem, Epigraph, Manuscript } from './compile';

/**
 * Palatino, a mesma fonte do editor. A EB Garamond do PDF não vai no DOCX
 * porque quase ninguém a tem instalada (no Mac do Lucas o Pages caiu em Times).
 * Sem Palatino (Windows), o fontTable aponta Palatino Linotype e o panose de
 * uma romana, para o Word achar Palatino Linotype ou Book Antiqua.
 */
export const DOCX_FONT = 'Palatino';
export const DOCX_FONT_ALT = 'Palatino Linotype';

const CM = 567; // twips por centímetro
/** Centímetros em twips inteiros: o OOXML rejeita medida fracionária e o leitor descarta o parágrafo (alinhamento incluso). */
const cm = (n: number): number => Math.round(n * CM);
const PT = 2; // meios-pontos por ponto
const BODY_PT = 12;
/** Entrelinha 1,35 (em 240 avos de linha). */
const LINE = Math.round(240 * 1.35);
/** Recuo de primeira linha: 1,25em = 15 pt = 300 twips (≈ 0,53 cm). */
export const BOOK_INDENT = 1.25 * BODY_PT * 20;

export const STYLE = {
  body: 'Corpo',
  bodyFirst: 'CorpoPrimeiro',
  bookTitle: 'TituloLivro',
  partLabel: 'ParteRotulo',
  partTitle: 'ParteTitulo',
  chapter: 'Heading1',
  section: 'Heading2',
  epigraph: 'Epigrafe',
  attribution: 'EpigrafeAutor',
  quote: 'Citacao',
  rule: 'Separador',
} as const;

const ALIGN: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
  justify: AlignmentType.JUSTIFIED,
};

const textRuns = (runs: Run[]): TextRun[] =>
  runs.flatMap((r) =>
    r.text.split('\n').map((part, i) =>
      new TextRun({
        text: part,
        ...(i > 0 ? { break: 1 } : {}),
        ...(r.bold ? { bold: true } : {}),
        ...(r.italic ? { italics: true } : {}),
        ...(r.underline ? { underline: {} } : {}),
        ...(r.strike ? { strike: true } : {}),
      }),
    ),
  );

interface BodyCtx {
  listCounter: { n: number };
}

const HEADING_BY_LEVEL = [HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4] as const;

const blocksToParagraphs = (blocks: Block[], ctx: BodyCtx, opts: { style: string; list?: { ref: string; instance: number; level: number } }): Paragraph[] => {
  const out: Paragraph[] = [];
  let afterHeading = true;
  for (const b of blocks) {
    switch (b.type) {
      case 'paragraph': {
        // Centralizado e à direita não levam recuo de primeira linha (sairiam tortos).
        const centered = b.align === 'center' || b.align === 'right';
        const style = opts.list || opts.style !== STYLE.body ? opts.style : afterHeading || centered ? STYLE.bodyFirst : STYLE.body;
        out.push(new Paragraph({
          style,
          children: textRuns(b.runs),
          ...(b.align && !opts.list ? { alignment: ALIGN[b.align] } : {}),
          ...(opts.list ? { numbering: { reference: opts.list.ref, instance: opts.list.instance, level: opts.list.level } } : {}),
        }));
        afterHeading = b.runs.length === 0;
        break;
      }
      case 'heading':
        out.push(new Paragraph({ heading: HEADING_BY_LEVEL[b.level - 1], children: textRuns(b.runs), ...(b.align ? { alignment: ALIGN[b.align] } : {}) }));
        afterHeading = true;
        break;
      case 'list': {
        const instance = ++ctx.listCounter.n;
        const level = opts.list ? Math.min(opts.list.level + 1, 2) : 0;
        const ref = b.ordered ? 'sf-numero' : 'sf-marcador';
        for (const item of b.items) {
          // Só o primeiro parágrafo do item leva o marcador; o resto fica recuado.
          const [first, ...rest] = item;
          if (first) out.push(...blocksToParagraphs([first], ctx, { style: STYLE.bodyFirst, list: { ref, instance, level } }));
          if (rest.length) out.push(...blocksToParagraphs(rest, ctx, { style: STYLE.bodyFirst }));
        }
        afterHeading = true;
        break;
      }
      case 'blockquote':
        out.push(...blocksToParagraphs(b.children, ctx, { style: STYLE.quote }));
        afterHeading = true;
        break;
      case 'rule':
        out.push(new Paragraph({ style: STYLE.rule, children: [new TextRun('* * *')] }));
        afterHeading = true;
        break;
    }
  }
  return out;
};

/** Espaço entre a epígrafe e o corpo. */
const EPIGRAPH_AFTER = cm(1.1);

const epigraphParagraphs = (e: Epigraph): Paragraph[] => [
  ...e.lines.map((line, i) =>
    new Paragraph({
      style: STYLE.epigraph,
      children: [new TextRun(line)],
      // Sem atribuição, o espaço até o corpo fica na última linha da citação.
      ...(!e.attribution && i === e.lines.length - 1 ? { spacing: { after: EPIGRAPH_AFTER } } : {}),
    })),
  ...(e.attribution ? [new Paragraph({ style: STYLE.attribution, children: [new TextRun(`— ${e.attribution}`)] })] : []),
];

const numberedFooter = () =>
  new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 10 * PT })] })] });

const emptyFooter = () => new Footer({ children: [new Paragraph({ children: [] })] });

const PAGE = {
  size: { width: cm(21), height: cm(29.7) },
  margin: { top: cm(3), bottom: cm(3), left: cm(3.8), right: cm(3.8), footer: cm(1.5) },
};

/** Altura útil da página, em twips. */
const CONTENT_HEIGHT = PAGE.size.height - PAGE.margin.top - PAGE.margin.bottom;
/** Altura de uma linha em twips: corpo × 1,2 (entrelinha simples da Palatino) × fator de entrelinha. */
const lineTw = (sizePt: number, factor = LINE / 240) => sizePt * 1.2 * factor * 20;
/** Linhas que um texto ocupa, estimando a largura média do caractere em ~0,45em. */
const wrappedLines = (text: string, sizePt: number, widthTw: number) =>
  Math.max(1, Math.ceil((text.length * sizePt * 0.45 * 20) / widthTw));

/**
 * Espaço antes do primeiro parágrafo para centralizar o bloco na vertical.
 * O `w:vAlign` de seção seria o jeito do Word, mas o LibreOffice e o Pages o
 * ignoram; espaço antes funciona em todos. A altura é estimada (±1 linha).
 */
const centeredBefore = (blockTw: number) => Math.max(0, Math.round((CONTENT_HEIGHT - blockTw) / 2));

const partBlockHeight = (item: CompileItem): number => {
  const width = PAGE.size.width - PAGE.margin.left - PAGE.margin.right;
  let h = 0;
  if (item.label) h += lineTw(12) + cm(0.3);
  h += wrappedLines(item.name || item.title, 28, width) * lineTw(28, 1) + cm(1.2);
  if (item.epigraph) {
    const epWidth = width - cm(5);
    for (const line of item.epigraph.lines) h += wrappedLines(line, 10.5, epWidth) * lineTw(10.5, 276 / 240);
    if (item.epigraph.attribution) h += cm(0.2) + lineTw(10.5);
    h += EPIGRAPH_AFTER;
  }
  for (const b of item.blocks) h += wrappedLines(blockText(b), BODY_PT, width) * lineTw(BODY_PT);
  return h;
};

/**
 * Seções do Word, como no PDF: folha de rosto e cada Livro/Parte numa seção
 * própria, com o bloco centralizado na vertical e sem número; o corpo em seções
 * numeradas. A numeração continua corrida de uma seção para a outra.
 */
const newSection = (children: Paragraph[], kind: 'centered' | 'body', first: boolean): ISectionOptions => ({
  properties: {
    ...(first ? {} : { type: SectionType.NEXT_PAGE }),
    page: PAGE,
  },
  footers: { default: kind === 'centered' ? emptyFooter() : numberedFooter() },
  children,
});

/** `atSectionStart`: a seção já abre página nova; a quebra do capítulo geraria página em branco. */
const itemParagraphs = (item: CompileItem, ctx: BodyCtx, atSectionStart: boolean): Paragraph[] => {
  const out: Paragraph[] = [];
  const brk = !atSectionStart;
  if (item.kind === 'part') {
    // Bloco que ocupa quase a página toda (corpo longo) começa no alto, sem centralizar.
    const height = partBlockHeight(item);
    const before = height < CONTENT_HEIGHT * 0.8 ? centeredBefore(height) : 0;
    const top = before ? { spacing: { before } } : {};
    if (item.label) out.push(new Paragraph({ style: STYLE.partLabel, ...top, children: [new TextRun(item.label)] }));
    out.push(new Paragraph({ style: STYLE.partTitle, ...(item.label ? {} : top), children: [new TextRun(item.name || item.title)] }));
  } else if (item.kind === 'chapter') {
    out.push(new Paragraph({ style: STYLE.chapter, pageBreakBefore: brk, children: [new TextRun(item.title)] }));
  } else if (item.title) {
    out.push(new Paragraph({ style: STYLE.section, pageBreakBefore: item.startsPage && brk, children: [new TextRun(item.title)] }));
  } else if (item.startsPage && brk) {
    out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  }
  if (item.epigraph) out.push(...epigraphParagraphs(item.epigraph));
  out.push(...blocksToParagraphs(item.blocks, ctx, { style: STYLE.body }));
  return out;
};

/**
 * 'book': recuo de primeira linha de 1,25em e nenhum espaço entre parágrafos
 * (o primeiro depois de título, cena ou separador usa CorpoPrimeiro, sem recuo).
 * 'blocks': sem recuo e com espaço depois de cada parágrafo.
 */
export type ParagraphStyle = 'book' | 'blocks';
export interface DocxOptions { paragraphStyle?: ParagraphStyle }

export const buildDocx = (ms: Manuscript, options: DocxOptions = {}): Document => {
  const book = (options.paragraphStyle ?? 'book') === 'book';
  const bodyParagraph = book
    ? { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: BOOK_INDENT }, spacing: { after: 0 } }
    : { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 0 }, spacing: { after: 0.6 * BODY_PT * 20 } };
  const ctx: BodyCtx = { listCounter: { n: 0 } };
  const sections: ISectionOptions[] = [
    newSection([new Paragraph({
      style: STYLE.bookTitle,
      spacing: { before: centeredBefore(lineTw(30, 1)) },
      children: [new TextRun(ms.title)],
    })], 'centered', true),
  ];
  let body: Paragraph[] = [];
  const flush = () => {
    if (body.length) sections.push(newSection(body, 'body', false));
    body = [];
  };
  for (const item of ms.items) {
    if (item.kind === 'part') {
      flush();
      sections.push(newSection(itemParagraphs(item, ctx, true), 'centered', false));
    } else {
      body.push(...itemParagraphs(item, ctx, body.length === 0));
    }
  }
  flush();

  const serif = { font: DOCX_FONT };
  return new Document({
    title: ms.title,
    creator: 'ScribeFlow',
    styles: {
      default: {
        document: { run: { ...serif, size: BODY_PT * PT }, paragraph: { spacing: { line: LINE, before: 0, after: 0 } } },
        heading1: {
          // Capítulo afundado ~1/3 da página: 3 cm de margem + 6,9 cm antes = 9,9 cm (29,7 / 3).
          run: { ...serif, size: 22 * PT, bold: false, color: '000000' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: cm(6.9), after: cm(1.6), line: 240 }, keepNext: true },
        },
        heading2: {
          run: { ...serif, size: 14 * PT, bold: false, color: '000000' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: cm(0.9), after: cm(0.5) }, keepNext: true },
        },
        heading3: {
          run: { ...serif, size: 13 * PT, bold: true, color: '000000' },
          paragraph: { spacing: { before: cm(0.6), after: cm(0.25) }, keepNext: true },
        },
        heading4: {
          run: { ...serif, size: BODY_PT * PT, bold: false, italics: true, color: '000000' },
          paragraph: { spacing: { before: cm(0.45), after: cm(0.2) }, keepNext: true },
        },
      },
      paragraphStyles: [
        { id: STYLE.body, name: 'Corpo', basedOn: 'Normal', next: STYLE.body, quickFormat: true, paragraph: bodyParagraph },
        { id: STYLE.bodyFirst, name: 'Corpo (primeiro)', basedOn: STYLE.body, next: STYLE.body, quickFormat: true, paragraph: { indent: { firstLine: 0 } } },
        { id: STYLE.bookTitle, name: 'Título do livro', basedOn: 'Normal', run: { size: 30 * PT }, paragraph: { alignment: AlignmentType.CENTER, spacing: { line: 240 } } },
        { id: STYLE.partLabel, name: 'Livro/Parte: rótulo', basedOn: 'Normal', next: STYLE.partTitle, run: { size: 12 * PT, allCaps: true, characterSpacing: 60 }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: cm(0.3) }, keepNext: true } },
        { id: STYLE.partTitle, name: 'Livro/Parte: título', basedOn: 'Normal', next: STYLE.epigraph, run: { size: 28 * PT }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: cm(1.2), line: 240 }, keepNext: true, outlineLevel: 0 } },
        // Epígrafe: bloco recuado, alinhado à esquerda (justificar poucas palavras abre buracos), corpo menor.
        { id: STYLE.epigraph, name: 'Epígrafe', basedOn: 'Normal', next: STYLE.epigraph, quickFormat: true, run: { italics: true, size: 10.5 * PT }, paragraph: { alignment: AlignmentType.LEFT, indent: { left: cm(5) }, spacing: { line: 276 }, keepNext: true, keepLines: true } },
        { id: STYLE.attribution, name: 'Epígrafe: autor', basedOn: 'Normal', next: STYLE.bodyFirst, run: { size: 10.5 * PT, italics: false, smallCaps: true }, paragraph: { alignment: AlignmentType.RIGHT, indent: { left: cm(5) }, spacing: { before: cm(0.2), after: EPIGRAPH_AFTER }, keepNext: true } },
        { id: STYLE.quote, name: 'Citação', basedOn: 'Normal', next: STYLE.body, quickFormat: true, run: { size: 11 * PT }, paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { left: cm(1.5), right: cm(1) }, spacing: { before: cm(0.25), after: cm(0.25), line: 288 } } },
        { id: STYLE.rule, name: 'Separador', basedOn: 'Normal', next: STYLE.bodyFirst, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: cm(0.35), after: cm(0.35) } } },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'sf-marcador',
          levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.BULLET, text: level === 1 ? '◦' : '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: cm(0.9 + level * 0.7), hanging: cm(0.45) } } } })),
        },
        {
          reference: 'sf-numero',
          levels: [0, 1, 2].map((level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level], text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: cm(0.9 + level * 0.7), hanging: cm(0.55) } } } })),
        },
      ],
    },
    sections,
  });
};

/** Declaração da Palatino no fontTable: nome alternativo e panose de romana, para a substituição cair numa serifada parecida. */
const PALATINO_FONT_XML =
  `<w:font w:name="${DOCX_FONT}"><w:altName w:val="${DOCX_FONT_ALT}"/><w:panose1 w:val="02040502050505030304"/>` +
  '<w:charset w:val="00"/><w:family w:val="roman"/><w:pitch w:val="variable"/></w:font>';

/** Acrescenta a Palatino ao word/fontTable.xml gerado pela lib (que só lista fontes embutidas). */
export const withFontTable = async (docx: Uint8Array | ArrayBuffer): Promise<JSZip> => {
  const zip = await JSZip.loadAsync(docx);
  const path = 'word/fontTable.xml';
  const xml = await zip.file(path)?.async('string');
  if (xml && !xml.includes(`w:name="${DOCX_FONT}"`)) {
    const patched = /<w:fonts[^>]*\/>/.test(xml)
      ? xml.replace(/<w:fonts([^>]*)\/>/, `<w:fonts$1>${PALATINO_FONT_XML}</w:fonts>`)
      : xml.replace('</w:fonts>', `${PALATINO_FONT_XML}</w:fonts>`);
    zip.file(path, patched);
  }
  return zip;
};

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export const renderDocx = async (ms: Manuscript, options: DocxOptions = {}): Promise<Blob> => {
  const raw = await Packer.toArrayBuffer(buildDocx(ms, options));
  const zip = await withFontTable(raw);
  return zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
};
