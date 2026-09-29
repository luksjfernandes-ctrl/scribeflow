import type { SaveStatus } from './persistence';

export interface SaveLabelInput {
  status: SaveStatus;
  online: boolean;
  /** Ultima confirmacao do banco nesta sessao (ou o updated_at do documento). */
  savedAt: Date | null;
  /** Ha edicao ainda nao confirmada pelo banco. */
  unsaved: boolean;
}

export type SaveTone = 'ok' | 'busy' | 'warn' | 'error';

const hhmm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** Texto do indicador de salvamento. Nunca promete o que nao aconteceu: sem
 *  rede, o app NAO guarda no aparelho (so na memoria da aba), entao o aviso diz
 *  para nao fechar a aba em vez de "salvo neste aparelho". */
export function saveLabel({ status, online, savedAt, unsaved }: SaveLabelInput): { text: string; tone: SaveTone } {
  if (!online && unsaved) return { text: 'Sem conexão — não feche esta aba; envio quando a rede voltar', tone: 'warn' };
  if (!online) return { text: savedAt ? `Sem conexão · salvo às ${hhmm(savedAt)}` : 'Sem conexão', tone: 'warn' };
  if (status === 'error') return { text: 'Não salvou ainda — tentando de novo', tone: 'error' };
  if (status === 'pending' || unsaved) return { text: 'Salvando…', tone: 'busy' };
  return { text: savedAt ? `Salvo às ${hhmm(savedAt)}` : 'Salvo', tone: 'ok' };
}
