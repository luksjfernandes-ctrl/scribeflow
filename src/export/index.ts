/**
 * Ponto de entrada da exportação. PDF e DOCX carregam as libs só quando
 * pedidos (import dinâmico), para não pesar na abertura do app.
 */
import type { Doc } from '../types';
import { compileManuscript, safeFileName } from './compile';
import { renderRtf, renderTxt } from './text';

export type ExportFormat = 'pdf' | 'docx' | 'rtf' | 'txt' | 'epub';

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

export const exportManuscript = async (format: ExportFormat, docs: Doc[], projectName: string | undefined): Promise<void> => {
  const ms = compileManuscript(docs, projectName || 'Manuscrito');
  if (ms.items.length === 0) throw new NothingToExportError();
  const base = safeFileName(projectName);

  switch (format) {
    case 'pdf': {
      const { renderPdf } = await import('./pdf');
      download(await renderPdf(ms), `${base}.pdf`);
      return;
    }
    case 'docx': {
      const { renderDocx } = await import('./docx');
      download(await renderDocx(ms), `${base}.docx`);
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
