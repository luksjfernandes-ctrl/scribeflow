import type { Doc, DocumentMetadata } from '../types';

/**
 * Camada de persistencia dos documentos, sem React e sem Supabase, para poder
 * ser testada em node (tests/persistence.test.ts).
 *
 * Tres regras que o App antigo quebrava:
 * 1. O que vai para o banco NAO depende de efeito colateral dentro de um updater
 *    do setDocs (o React pode adiar o updater, e o save nunca era enfileirado).
 *    A fila guarda o patch; o metadata completo e montado na hora de gravar.
 * 2. Um eco do realtime nunca sobrescreve campo com edicao pendente ou em voo.
 *    O eco da propria aba e reconhecido pelo `updated_at` que ela mesma gravou.
 * 3. "Salvo" so aparece quando o banco confirmou e nao ha mais nada na fila.
 *    Falha (inclusive update que casou 0 linhas) volta para a fila ou vira erro.
 */

export type SaveStatus = 'saved' | 'pending' | 'error';

/** Campos de primeiro nivel da linha `docs` que a fila sabe gravar. */
export type DocFieldUpdates = Partial<Pick<Doc, 'title' | 'content' | 'parent_id' | 'order'>>;

export interface SaveRequest {
  fields?: DocFieldUpdates;
  metadataPatch?: Partial<DocumentMetadata>;
}

export interface WriteResult {
  ok: boolean;
  /** false = nao adianta tentar de novo (ex.: 0 linhas, doc apagado ou RLS). */
  retry?: boolean;
  error?: string;
}

export type WriteFn = (
  docId: string,
  projectId: string,
  payload: Record<string, unknown>,
) => Promise<WriteResult>;

interface Entry {
  projectId: string;
  fields: DocFieldUpdates;
  metadataPatch: Partial<DocumentMetadata> | null;
  /** Metadata conhecido na hora do enqueue; so e usado se o doc sumir do estado
   *  local antes do flush (ex.: troca de projeto). */
  baseMetadata: DocumentMetadata | null;
}

export interface SaveQueueOptions {
  write: WriteFn;
  /** Le o doc no estado local mais recente (o App passa um ref de `docs`). */
  getDoc: (id: string) => Doc | undefined;
  onStatus?: (status: SaveStatus) => void;
  onError?: (docId: string, error: string) => void;
  delayMs?: number;
  retryMs?: number;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

const OWN_WRITES_KEPT = 20;

const mergeEntry = (older: Entry, newer: Entry): Entry => ({
  projectId: newer.projectId,
  fields: { ...older.fields, ...newer.fields },
  metadataPatch:
    older.metadataPatch || newer.metadataPatch
      ? { ...(older.metadataPatch || {}), ...(newer.metadataPatch || {}) }
      : null,
  baseMetadata: newer.baseMetadata || older.baseMetadata,
});

const entryFieldNames = (entry: Entry | undefined): string[] => {
  if (!entry) return [];
  const names = Object.keys(entry.fields);
  if (entry.metadataPatch) names.push('metadata');
  return names;
};

export class SaveQueue {
  private pending = new Map<string, Entry>();
  private inflight = new Map<string, Entry>();
  private ownWrites = new Map<string, number[]>();
  private timer: unknown = null;
  private chain: Promise<void> = Promise.resolve();
  private failed = false;
  private lastStatus: SaveStatus = 'saved';
  private opts: Required<Omit<SaveQueueOptions, 'onStatus' | 'onError'>> &
    Pick<SaveQueueOptions, 'onStatus' | 'onError'>;

  constructor(options: SaveQueueOptions) {
    this.opts = {
      delayMs: 1500,
      retryMs: 5000,
      now: Date.now,
      setTimer: (fn, ms) => setTimeout(fn, ms),
      clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
      ...options,
    };
  }

  /** Enfileira uma edicao e agenda a gravacao (debounce). */
  enqueue(docId: string, projectId: string, request: SaveRequest): void {
    const current = this.opts.getDoc(docId);
    const entry: Entry = {
      projectId,
      fields: { ...(request.fields || {}) },
      metadataPatch: request.metadataPatch ? { ...request.metadataPatch } : null,
      baseMetadata: current ? current.metadata : null,
    };
    const previous = this.pending.get(docId);
    this.pending.set(docId, previous ? mergeEntry(previous, entry) : entry);
    this.schedule(this.opts.delayMs);
    this.emit();
  }

  /** Grava ja o que estiver pendente. Flushes sao serializados, nunca se cruzam. */
  flush(): Promise<void> {
    this.cancelTimer();
    this.chain = this.chain.then(() => this.runFlush());
    return this.chain;
  }

  /** Ha algo que ainda nao foi confirmado pelo banco? */
  hasUnsaved(): boolean {
    return this.pending.size > 0 || this.inflight.size > 0;
  }

  /** Campos do doc com edicao local ainda nao confirmada (pendente ou em voo). */
  dirtyFields(docId: string): Set<string> {
    return new Set([...entryFieldNames(this.inflight.get(docId)), ...entryFieldNames(this.pending.get(docId))]);
  }

  /** O evento do realtime e o eco de uma gravacao desta propria aba? */
  isOwnEcho(docId: string, updatedAt: unknown): boolean {
    if (typeof updatedAt !== 'number') return false;
    return (this.ownWrites.get(docId) || []).includes(updatedAt);
  }

  status(): SaveStatus {
    if (this.failed) return 'error';
    return this.hasUnsaved() ? 'pending' : 'saved';
  }

  private emit() {
    const next = this.status();
    if (next !== this.lastStatus) {
      this.lastStatus = next;
      this.opts.onStatus?.(next);
    }
  }

  private schedule(ms: number) {
    this.cancelTimer();
    this.timer = this.opts.setTimer(() => {
      this.timer = null;
      void this.flush();
    }, ms);
  }

  private cancelTimer() {
    if (this.timer !== null) {
      this.opts.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private buildPayload(docId: string, entry: Entry, updatedAt: number): Record<string, unknown> {
    const payload: Record<string, unknown> = { ...entry.fields, updated_at: updatedAt };
    if (entry.metadataPatch) {
      // O estado local ja contem o patch quando o updater do setDocs rodou; se
      // ainda nao rodou, aplicar o patch de novo por cima da o mesmo resultado.
      const base = this.opts.getDoc(docId)?.metadata || entry.baseMetadata || ({} as DocumentMetadata);
      payload.metadata = { ...base, ...entry.metadataPatch };
    }
    return payload;
  }

  private rememberOwnWrite(docId: string, updatedAt: number) {
    const list = this.ownWrites.get(docId) || [];
    list.push(updatedAt);
    if (list.length > OWN_WRITES_KEPT) list.shift();
    this.ownWrites.set(docId, list);
  }

  private async runFlush(): Promise<void> {
    if (this.pending.size === 0) {
      this.emit();
      return;
    }
    const batch = new Map(this.pending);
    this.pending.clear();
    batch.forEach((entry, id) => this.inflight.set(id, entry));
    this.emit();

    let anyFailure = false;
    let anyRetry = false;
    for (const [docId, entry] of batch) {
      // updated_at unico por gravacao: e a "assinatura" que identifica o eco.
      let updatedAt = this.opts.now();
      const previous = this.ownWrites.get(docId);
      if (previous && previous.length && previous[previous.length - 1] >= updatedAt) {
        updatedAt = previous[previous.length - 1] + 1;
      }
      this.rememberOwnWrite(docId, updatedAt);

      let result: WriteResult;
      try {
        result = await this.opts.write(docId, entry.projectId, this.buildPayload(docId, entry, updatedAt));
      } catch (e) {
        result = { ok: false, retry: true, error: e instanceof Error ? e.message : String(e) };
      }
      this.inflight.delete(docId);

      if (!result.ok) {
        anyFailure = true;
        this.opts.onError?.(docId, result.error || 'erro desconhecido');
        if (result.retry !== false) {
          anyRetry = true;
          // Volta para a fila SEM passar por cima de edicoes feitas durante o await.
          const newer = this.pending.get(docId);
          this.pending.set(docId, newer ? mergeEntry(entry, newer) : entry);
        }
      }
    }

    if (anyFailure) {
      this.failed = true;
    } else if (this.pending.size === 0) {
      this.failed = false;
    }

    if (this.pending.size > 0 && this.timer === null) {
      this.schedule(anyRetry ? this.opts.retryMs : this.opts.delayMs);
    }
    this.emit();
  }
}

/**
 * Junta a lista vinda do banco com o estado local. O banco manda em quais docs
 * existem e nos campos sem edicao local; campo com edicao pendente ou em voo
 * fica com o valor local (senao o textarea controlado "volta sozinho").
 */
export function mergeServerDocs(
  local: Doc[],
  server: Doc[],
  dirtyFields: (docId: string) => Set<string>,
): Doc[] {
  const localById = new Map(local.map((d) => [d.id, d]));
  return server.map((serverDoc) => {
    const localDoc = localById.get(serverDoc.id);
    if (!localDoc) return serverDoc;
    const dirty = dirtyFields(serverDoc.id);
    if (dirty.size === 0) return serverDoc;
    const merged: Record<string, unknown> = { ...serverDoc };
    dirty.forEach((field) => {
      merged[field] = (localDoc as unknown as Record<string, unknown>)[field];
    });
    return merged as unknown as Doc;
  });
}

export interface RealtimeDocPayload {
  eventType?: string;
  new?: { id?: unknown; updated_at?: unknown } | null;
}

/** Decide se um evento do realtime de `docs` pede um refetch. */
export function shouldRefetchOnRealtime(
  payload: RealtimeDocPayload,
  isOwnEcho: (docId: string, updatedAt: unknown) => boolean,
): boolean {
  if (payload.eventType === 'UPDATE' && payload.new && typeof payload.new.id === 'string') {
    return !isOwnEcho(payload.new.id, payload.new.updated_at);
  }
  return true;
}
