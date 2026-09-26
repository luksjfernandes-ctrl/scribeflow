import type { Snapshot } from '../types';

/**
 * Duas abas (ou dois aparelhos) no mesmo documento. A gravação do corpo é
 * condicional à versão (`updated_at`) de onde o texto local partiu. Se outra
 * aba gravou no meio, a nossa gravação ainda vence (a última vale), mas antes a
 * versão da outra aba vira um snapshot do documento: nenhum texto some.
 */

/** Versão do banco de onde o texto local partiu. */
export interface ContentBase {
  updatedAt: number | null;
  content: string;
}

const plain = (html: string | null | undefined) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

/** O que está no banco agora é texto de outra aba, diferente da base e do nosso? */
export const needsConflictSnapshot = (baseContent: string, currentContent: string | null | undefined, ours: string): boolean =>
  plain(currentContent) !== '' && plain(currentContent) !== plain(baseContent) && plain(currentContent) !== plain(ours);

export const conflictSnapshot = (title: string, content: string, id: string, now: number): Snapshot => ({
  id,
  timestamp: now,
  title: `${title || 'Untitled'} (versão de outra aba)`,
  content,
});
