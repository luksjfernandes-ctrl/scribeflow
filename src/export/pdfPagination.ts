/**
 * Viúvas, órfãs e título sozinho no pé da página, para o PDF do pdfmake.
 *
 * O pdfmake não tem esse controle, mas chama `pageBreakBefore` para cada nó
 * depois de paginar e refaz a paginação quando a função devolve true. Aqui:
 * - cada parágrafo do corpo é "rastreado": um setter em `positions` (uma
 *   posição por linha, que o pdfmake grava no próprio nó) e em `_inlines` (as
 *   palavras que faltam) diz em que página caiu cada linha e que texto ela levou;
 * - órfã (1 linha no pé) ou parágrafo curto (menos de 4 linhas) partido:
 *   o parágrafo inteiro vai para a página seguinte;
 * - viúva (1 linha no topo): o parágrafo é limitado com `maxHeight` para
 *   deixar 2 linhas para a página seguinte, e o resto entra como continuação
 *   em página nova. O `maxHeight` mantém a última linha da página justificada;
 * - título (de cena ou do corpo) só fica no pé se vierem pelo menos 2 linhas
 *   do parágrafo seguinte; senão desce junto.
 * Cada correção muda só dali para a frente, e cada nó é avaliado uma vez.
 */
import type { Run } from './html';

type PdfNode = Record<string, unknown>;
interface Position { pageNumber: number; top: number }
interface NodeInfo { id?: string; pageNumbers?: number[] }
type Helpers = { getFollowingNodesOnPage: () => unknown[] };

interface Tracked {
  node: PdfNode;
  runs: Run[];
  /** Texto que o pdfmake mediu (junção das palavras). */
  measured: string;
  /** Tamanho do texto ainda não colocado depois de cada linha. */
  remainingAfterLine: number[];
  positions: Position[];
  /** Array onde o nó está (seção), para inserir a continuação. */
  parent?: PdfNode[];
  /** Monta o nó da continuação com as mesmas propriedades. */
  makeContinuation: (runs: Run[]) => PdfNode;
}

interface Heading { node: PdfNode; positions: Position[]; next?: PdfNode }

const hidden = (node: PdfNode, key: string, get: () => unknown, set: (v: never) => void) =>
  Object.defineProperty(node, key, { get, set, configurable: true, enumerable: false });

/** Corta os runs a partir do caractere `offset`. */
export const sliceRuns = (runs: Run[], offset: number): Run[] => {
  const out: Run[] = [];
  let pos = 0;
  for (const r of runs) {
    const end = pos + r.text.length;
    if (end > offset) out.push({ ...r, text: r.text.slice(Math.max(0, offset - pos)) });
    pos = end;
  }
  return out.filter((r) => r.text.length > 0);
};

export class Pagination {
  private seq = 0;
  private readonly paragraphs = new Map<string, Tracked>();
  private readonly headings = new Map<string, Heading>();
  private readonly byNode = new WeakMap<PdfNode, Tracked | Heading>();

  /** Passa a acompanhar um parágrafo do corpo. */
  trackParagraph(node: PdfNode, runs: Run[], makeContinuation: (runs: Run[]) => PdfNode): PdfNode {
    const id = `sf-p${++this.seq}`;
    const t: Tracked = { node, runs, measured: '', remainingAfterLine: [], positions: [], makeContinuation };
    let inlines: { text: string }[] | undefined;
    hidden(node, '_inlines', () => inlines, (v: { text: string }[] | undefined) => {
      inlines = v;
      t.measured = (v ?? []).map((i) => i.text).join('');
    });
    hidden(node, 'positions', () => t.positions, (v: Position[]) => {
      t.positions = v;
      t.remainingAfterLine = [];
      const push = v.push.bind(v);
      v.push = (...items: Position[]) => {
        const n = push(...items);
        t.remainingAfterLine.push((inlines ?? []).reduce((sum, i) => sum + i.text.length, 0));
        return n;
      };
    });
    node.id = id;
    this.paragraphs.set(id, t);
    this.byNode.set(node, t);
    return node;
  }

  /** Título que não pode ficar sozinho no pé da página. */
  trackHeading(node: PdfNode): PdfNode {
    const id = `sf-h${++this.seq}`;
    const h: Heading = { node, positions: [] };
    hidden(node, 'positions', () => h.positions, (v: Position[]) => { h.positions = v; });
    node.id = id;
    this.headings.set(id, h);
    this.byNode.set(node, h);
    return node;
  }

  /** Liga cada nó ao array da seção e cada título ao nó seguinte. */
  attach(list: PdfNode[]): void {
    list.forEach((node, i) => {
      const entry = this.byNode.get(node);
      if (!entry) return;
      if ('runs' in entry) entry.parent = list;
      else entry.next = list[i + 1];
    });
  }

  private linesPerPage(positions: Position[]): { first: number; last: number; total: number; pages: number } {
    const pages = [...new Set(positions.map((p) => p.pageNumber))];
    const first = positions.filter((p) => p.pageNumber === pages[0]).length;
    const last = positions.filter((p) => p.pageNumber === pages[pages.length - 1]).length;
    return { first, last, total: positions.length, pages: pages.length };
  }

  private fixParagraph(t: Tracked): boolean {
    const { first, last, total, pages } = this.linesPerPage(t.positions);
    if (pages < 2) return false;
    // Curto demais para dividir 2 + 2, ou órfã: vai inteiro para a próxima página.
    if (total < 4 || first < 2) return true;
    if (last >= 2) return false;
    // Viúva: a primeira parte fica com total - 2 linhas; as 2 últimas descem juntas.
    const keep = total - 2;
    const pitch = t.positions[1].top - t.positions[0].top;
    const consumed = t.measured.length - (t.remainingAfterLine[keep - 1] ?? -1);
    const runsText = t.runs.map((r) => r.text).join('');
    // Só divide quando o texto medido bate com o nosso (senão, move o parágrafo inteiro).
    if (!t.parent || pitch <= 0 || runsText !== t.measured || consumed <= 0 || consumed >= runsText.length) return true;
    const tail = sliceRuns(t.runs, consumed);
    const continuation = t.makeContinuation(tail);
    continuation.pageBreak = 'before';
    t.node.maxHeight = (keep + 0.5) * pitch;
    // O pdfmake grava pageBreak = 'before' no nó que devolveu true; este fica onde está.
    hidden(t.node, 'pageBreak', () => undefined, () => {});
    t.parent.splice(t.parent.indexOf(t.node) + 1, 0, continuation);
    return true;
  }

  private fixHeading(h: Heading, helpers: Helpers): boolean {
    const page = h.positions[h.positions.length - 1]?.pageNumber;
    if (page === undefined) return false;
    const next = h.next ? this.byNode.get(h.next) : undefined;
    if (next && 'runs' in next && next.positions.length) {
      const onPage = next.positions.filter((p) => p.pageNumber === page).length;
      return onPage < Math.min(2, next.positions.length);
    }
    return helpers.getFollowingNodesOnPage().length === 0 && !!h.next;
  }

  /** Para `pageBreakBefore` do pdfmake. */
  readonly pageBreakBefore = (info: NodeInfo, helpers: Helpers): boolean => {
    if (!info.id) return false;
    const t = this.paragraphs.get(info.id);
    if (t) return this.fixParagraph(t);
    const h = this.headings.get(info.id);
    if (h) return this.fixHeading(h, helpers);
    return false;
  };
}
