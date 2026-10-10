import type { DocumentMetadata } from '../types';
import { appendLostToNotes, mergeMetadata, resolveConflict, type DocBase } from './conflict';
import { isLimitError, SESSION_LOST } from './limits';
import { isContestedPayload, type WriteFn, type WriteResult } from './persistence';

/**
 * A gravacao de um doc que a fila (SaveQueue) chama: condicional pela versao de
 * onde a aba partiu, com juncao de tres vias e snapshot quando outra aba gravou
 * no meio. Fora do App para o teste de duas abas (tests/duas-abas.test.ts)
 * rodar este mesmo codigo contra um banco em memoria; o App so liga as
 * dependencias ao Supabase e ao estado do React.
 */

interface DbError {
  code?: string;
  message: string;
}

export interface DbResult<T> {
  data: T | null;
  error: DbError | null;
}

export interface DocRow {
  title: string;
  content: string;
  metadata: DocumentMetadata | null;
  updated_at: unknown;
}

export interface DocWriterDeps {
  /** UPDATE em docs por id e project_id; com expectedAt, so se updated_at bater. */
  update(docId: string, projectId: string, body: Record<string, unknown>, expectedAt?: number): PromiseLike<DbResult<Array<{ id: string }>>>;
  read(docId: string, projectId: string): PromiseLike<DbResult<DocRow>>;
  hasSession(): Promise<boolean>;
  getBase(docId: string): DocBase | undefined;
  setBase(docId: string, base: DocBase): void;
  /** Metadata no estado local (o que a aba tem agora). */
  localMetadata(docId: string): DocumentMetadata | undefined;
  /** Troca o metadata do doc no estado local pelo que `fn` devolver. */
  updateLocalMetadata(docId: string, fn: (local: DocumentMetadata) => DocumentMetadata): void;
  markConfirmed(docId: string): void;
  newId(): string;
  now(): number;
  stamp(): string;
  warn?(message: string): void;
}

export function makeDocWriter(deps: DocWriterDeps): WriteFn {
  return async (docId, projectId, payload): Promise<WriteResult> => {
    // O supabase-js devolve { error } em vez de lancar, e um update barrado
    // por RLS ou com project_id errado casa 0 linhas sem erro nenhum.
    const update = (body: Record<string, unknown>, expectedAt?: number) => deps.update(docId, projectId, body, expectedAt);
    // Limite do banco (lib/limits.ts): a fila guarda a edicao sem reenviar a
    // cada 5 s, porque a mesma gravacao seria recusada de novo.
    const failure = (error: DbError): WriteResult =>
      isLimitError(error) ? { ok: false, hold: true, error: error.message } : { ok: false, retry: true, error: error.message };
    // 0 linhas: doc apagado (descarta) OU sessao perdida, em que a RLS tambem
    // devolve 0 linhas sem erro (saiu da conta em outra aba, token expirou).
    // Sem sessao a edicao fica guardada para depois do login, nao vai fora.
    const zeroRows = async (): Promise<WriteResult> =>
      (await deps.hasSession())
        ? { ok: false, retry: false, error: 'nenhuma linha atualizada' }
        : { ok: false, hold: true, error: SESSION_LOST };

    let base = deps.getBase(docId);
    let body = payload;
    let merged = false;
    // Metadata local na hora do envio: diz o que a aba mudou enquanto esperava.
    const sentMeta = (payload.metadata ?? deps.localMetadata(docId)) as DocumentMetadata | undefined;

    const finish = (): WriteResult => {
      deps.markConfirmed(docId);
      if (base) {
        deps.setBase(docId, {
          updatedAt: typeof body.updated_at === 'number' ? body.updated_at : null,
          title: typeof body.title === 'string' ? body.title : base.title,
          content: typeof body.content === 'string' ? body.content : base.content,
          metadata: (body.metadata as DocumentMetadata | undefined) ?? base.metadata,
        });
      }
      if (merged && body.metadata) {
        // O estado local recebe o que foi juntado, sem desfazer o que a aba
        // mudou durante a gravacao (tres vias de novo: base = o que foi enviado).
        const written = body.metadata as DocumentMetadata;
        deps.updateLocalMetadata(docId, (localMeta) => {
          const local = mergeMetadata(sentMeta, localMeta, written);
          return appendLostToNotes(local.merged, local.lost, deps.stamp()) as DocumentMetadata;
        });
      }
      return { ok: true };
    };

    // Corpo, titulo e metadata: grava so se o banco ainda esta na versao de
    // onde a aba partiu. Se outra aba gravou no meio, junta e tenta de novo.
    const contested = isContestedPayload(payload);
    if (contested && base && base.updatedAt !== null) {
      for (let attempt = 0; attempt < 3 && base.updatedAt !== null; attempt++) {
        const { data, error } = await update(body, base.updatedAt);
        if (error) return failure(error);
        if (data && data.length > 0) return finish();

        const { data: current, error: readError } = await deps.read(docId, projectId);
        if (readError) return { ok: false, retry: true, error: readError.message };
        if (!current) return zeroRows();

        const r = resolveConflict({
          base,
          ours: {
            title: typeof body.title === 'string' ? body.title : undefined,
            content: typeof body.content === 'string' ? body.content : undefined,
            metadata: body.metadata as DocumentMetadata | undefined,
          },
          current,
          snapshotId: deps.newId(),
          now: deps.now(),
          stamp: deps.stamp(),
        });
        body = { ...body, metadata: r.metadata };
        merged = true;
        if (r.snapshot || r.lost.length) {
          deps.warn?.(`[Save] conflito no doc ${docId}: versão de outra aba guardada (${r.snapshot ? 'snapshot do corpo' : ''}${r.snapshot && r.lost.length ? ', ' : ''}${r.lost.map((l) => l.field).join(', ')}).`);
        }
        base = {
          updatedAt: typeof current.updated_at === 'number' ? current.updated_at : null,
          title: current.title,
          content: current.content,
          metadata: current.metadata || {},
        };
      }
    }

    const { data, error } = await update(body);
    if (error) return failure(error);
    if (!data || data.length === 0) return zeroRows();
    // Gravacao sem a disputa (ordem, pasta): a base nao avanca, senao
    // esconderia uma gravacao da outra aba feita no meio.
    if (!contested) {
      deps.markConfirmed(docId);
      return { ok: true };
    }
    return finish();
  };
}
