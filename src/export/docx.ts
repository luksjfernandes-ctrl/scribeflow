/**
 * DOCX do manuscrito com a lib `docx`, na mesma estrutura do PDF: folha de
 * rosto, Livro/Parte em página própria, capítulo em página nova com epígrafe,
 * corpo com a formatação do editor. Tudo por estilos nomeados, para quem abrir
 * no Word poder ajustar o livro inteiro mudando um estilo.
 *
 * O DOCX sai em A4, que é o que editora e revisor esperam para editar; o PDF
 * sai em 14 × 21 cm, para ler.
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
import type { Align, Block, Run } from './html';
import type { CompileItem, Epigraph, Manuscript } from './compile';

/** Garamond vem com o Office no Mac e no Windows. */
export const DOCX_FONT = 'Garamond';

const CM = 567; // twips por centímetro
const PT = 2; // meios-pontos por ponto
const BODY_PT = 12;

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

const epigraphParagraphs = (e: Epigraph): Paragraph[] => [
  ...e.lines.map((line) => new Paragraph({ style: STYLE.epigraph, children: [new TextRun(line)] })),
  ...(e.attribution ? [new Paragraph({ style: STYLE.attribution, children: [new TextRun(`— ${e.attribution}`)] })] : []),
];

const numberedFooter = () =>
  new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: 10 * PT })] })] });

const emptyFooter = () => new Footer({ children: [new Paragraph({ children: [] })] });

const PAGE = {
  size: { width: 21 * CM, height: 29.7 * CM },
  margin: { top: 2.5 * CM, bottom: 2.5 * CM, left: 3 * CM, right: 2.5 * CM, footer: 1.2 * CM },
};

/**
 * Cada Livro/Parte abre uma seção nova do Word, com a primeira página sem
 * número (titlePage). Assim a folha de rosto e as páginas de Livro ficam sem
 * número e a numeração continua corrida no resto.
 */
const newSection = (children: Paragraph[], first: boolean): ISectionOptions => ({
  properties: {
    ...(first ? {} : { type: SectionType.NEXT_PAGE }),
    titlePage: true,
    page: PAGE,
  },
  footers: { default: numberedFooter(), first: emptyFooter() },
  children,
});

const itemParagraphs = (item: CompileItem, ctx: BodyCtx): Paragraph[] => {
  const out: Paragraph[] = [];
  if (item.kind === 'part') {
    // A quebra de página vem da própria seção.
    if (item.label) out.push(new Paragraph({ style: STYLE.partLabel, children: [new TextRun(item.label)] }));
    out.push(new Paragraph({ style: STYLE.partTitle, children: [new TextRun(item.name || item.title)] }));
  } else if (item.kind === 'chapter') {
    out.push(new Paragraph({ style: STYLE.chapter, pageBreakBefore: true, children: [new TextRun(item.title)] }));
  } else if (item.title) {
    out.push(new Paragraph({ style: STYLE.section, pageBreakBefore: item.startsPage, children: [new TextRun(item.title)] }));
  } else if (item.startsPage) {
    out.push(new Paragraph({ pageBreakBefore: true, children: [] }));
  }
  if (item.epigraph) out.push(...epigraphParagraphs(item.epigraph));
  out.push(...blocksToParagraphs(item.blocks, ctx, { style: STYLE.body }));
  return out;
};

export const buildDocx = (ms: Manuscript): Document => {
  const ctx: BodyCtx = { listCounter: { n: 0 } };
  const sections: ISectionOptions[] = [];
  let current: Paragraph[] = [new Paragraph({ style: STYLE.bookTitle, children: [new TextRun(ms.title)] })];
  let first = true;

  for (const item of ms.items) {
    if (item.kind === 'part') {
      sections.push(newSection(current, first));
      first = false;
      current = [];
    }
    current.push(...itemParagraphs(item, ctx));
  }
  sections.push(newSection(current, first));

  const serif = { font: DOCX_FONT };
  return new Document({
    title: ms.title,
    creator: 'ScribeFlow',
    styles: {
      default: {
        document: { run: { ...serif, size: BODY_PT * PT }, paragraph: { spacing: { line: 336, before: 0, after: 0 } } },
        heading1: {
          run: { ...serif, size: 22 * PT, bold: false, color: '000000' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 3 * CM, after: 0.9 * CM }, keepNext: true },
        },
        heading2: {
          run: { ...serif, size: 15 * PT, bold: false, color: '000000' },
          paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0.8 * CM, after: 0.4 * CM }, keepNext: true },
        },
        heading3: {
          run: { ...serif, size: 13 * PT, bold: true, color: '000000' },
          paragraph: { spacing: { before: 0.5 * CM, after: 0.2 * CM }, keepNext: true },
        },
        heading4: {
          run: { ...serif, size: BODY_PT * PT, bold: false, italics: true, color: '000000' },
          paragraph: { spacing: { before: 0.4 * CM, after: 0.15 * CM }, keepNext: true },
        },
      },
      paragraphStyles: [
        { id: STYLE.body, name: 'Corpo', basedOn: 'Normal', next: STYLE.body, quickFormat: true, paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 1.25 * CM } } },
        { id: STYLE.bodyFirst, name: 'Corpo (primeiro)', basedOn: STYLE.body, next: STYLE.body, quickFormat: true, paragraph: { indent: { firstLine: 0 } } },
        { id: STYLE.bookTitle, name: 'Título do livro', basedOn: 'Normal', run: { size: 30 * PT }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 8 * CM } } },
        { id: STYLE.partLabel, name: 'Livro/Parte: rótulo', basedOn: 'Normal', next: STYLE.partTitle, run: { size: 12 * PT, allCaps: true, characterSpacing: 60 }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 6.5 * CM, after: 0.3 * CM }, keepNext: true } },
        { id: STYLE.partTitle, name: 'Livro/Parte: título', basedOn: 'Normal', next: STYLE.epigraph, run: { size: 28 * PT }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: 1 * CM }, keepNext: true, outlineLevel: 0 } },
        { id: STYLE.epigraph, name: 'Epígrafe', basedOn: 'Normal', next: STYLE.epigraph, quickFormat: true, run: { italics: true, size: 10.5 * PT }, paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { left: 4 * CM }, spacing: { line: 264 }, keepNext: true, keepLines: true } },
        { id: STYLE.attribution, name: 'Epígrafe: autor', basedOn: 'Normal', next: STYLE.bodyFirst, run: { size: 10 * PT }, paragraph: { alignment: AlignmentType.RIGHT, indent: { left: 4 * CM }, spacing: { before: 0.15 * CM, after: 0.9 * CM }, keepNext: true } },
        { id: STYLE.quote, name: 'Citação', basedOn: 'Normal', next: STYLE.body, quickFormat: true, run: { size: 11 * PT }, paragraph: { alignment: AlignmentType.JUSTIFIED, indent: { left: 2 * CM, right: 1 * CM }, spacing: { before: 0.2 * CM, after: 0.2 * CM, line: 276 } } },
        { id: STYLE.rule, name: 'Separador', basedOn: 'Normal', next: STYLE.bodyFirst, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 0.3 * CM, after: 0.3 * CM } } },
      ],
    },
    numbering: {
      config: [
        {
          reference: 'sf-marcador',
          levels: [0, 1, 2].map((level) => ({ level, format: LevelFormat.BULLET, text: level === 1 ? '◦' : '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: (1.25 + level * 0.75) * CM, hanging: 0.5 * CM } } } })),
        },
        {
          reference: 'sf-numero',
          levels: [0, 1, 2].map((level) => ({ level, format: [LevelFormat.DECIMAL, LevelFormat.LOWER_LETTER, LevelFormat.LOWER_ROMAN][level], text: `%${level + 1}.`, alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: (1.25 + level * 0.75) * CM, hanging: 0.6 * CM } } } })),
        },
      ],
    },
    sections,
  });
};

export const renderDocx = (ms: Manuscript): Promise<Blob> => Packer.toBlob(buildDocx(ms));
