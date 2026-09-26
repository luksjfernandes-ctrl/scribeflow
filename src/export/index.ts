/**
 * Ponto de entrada da exportação. PDF e DOCX carregam as libs só quando
 * pedidos (import dinâmico), para não pesar na abertura do app.
 */
import type { Doc } from '../types';
import { compileManuscript, safeFileName } from './compile';
import { renderRtf, renderTxt } from './text';

export type ExportFormat = 'pdf' | 'docx' | 'rtf' | 'txt' | 'epub';
/** Tamanho da página do PDF e do DOCX. Sem valor: cada formato usa o seu (PDF 14 × 21, DOCX A4). */
export type ExportPageSize = '14x21' | 'a4';

export interface ExportOptions {
  /** Estilo de parágrafo: 'book' (padrão, recuo de primeira linha) ou 'blocks'.
   *  Vem de `project.settings.paragraph_style`, a opção de Ajustes do editor. */
  paragraphStyle?: 'book' | 'blocks';
  /** Escolha do diálogo de exportação; RTF e TXT não têm página. */
  pageSize?: ExportPageSize;
}

export class NothingToExportError extends Error {
  constructor() {
    super('Nenhum documento do Manuscript está marcado para compilar.');
  }
}

const download = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // O Safari cancela o download se a URL for revogada no mesmo tique.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportManuscript = async (
  format: ExportFormat,
  docs: Doc[],
  projectName: string | undefined,
  options: ExportOptions = {},
): Promise<void> => {
  const ms = compileManuscript(docs, projectName || 'Manuscrito');
  if (ms.items.length === 0) throw new NothingToExportError();
  const base = safeFileName(projectName);

  switch (format) {
    case 'pdf': {
      const { renderPdf } = await import('./pdf');
      download(await renderPdf(ms, options), `${base}.pdf`);
      return;
    }
    case 'docx': {
      const { renderDocx } = await import('./docx');
      download(await renderDocx(ms, options), `${base}.docx`);
      return;
    }
    case 'rtf':
      download(new Blob([renderRtf(ms)], { type: 'application/rtf' }), `${base}.rtf`);
      return;
    case 'txt':
      download(new Blob([renderTxt(ms)], { type: 'text/plain;charset=utf-8' }), `${base}.txt`);
      return;
    case 'epub':
      throw new Error('EPUB ainda não está disponível. Use PDF ou DOCX por enquanto.');
  }
};
