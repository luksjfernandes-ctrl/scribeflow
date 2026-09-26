import type { ViewMode } from '../types';

/**
 * Estado de interface que sobrevive à recarga: vista, zoom e pastas abertas
 * no Binder. Fica no localStorage deste navegador (não vai para o banco).
 * localStorage pode lançar (aba anônima, armazenamento bloqueado): aí vale só
 * até recarregar.
 */

const VIEW_KEY = 'scribeflow-view-mode';
const ZOOM_KEY = 'scribeflow-zoom';
const expandedKey = (projectId: string) => `scribeflow-expanded:${projectId}`;
const VIEWS: ViewMode[] = ['editor', 'corkboard', 'outliner', 'scrivenings'];

type KV = Pick<Storage, 'getItem' | 'setItem'>;
const store = (): KV | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};
const read = (key: string, s: KV | null = store()): string | null => {
  try {
    return s?.getItem(key) ?? null;
  } catch {
    return null;
  }
};
const write = (key: string, value: string, s: KV | null = store()) => {
  try {
    s?.setItem(key, value);
  } catch {
    /* sem storage */
  }
};

export const readViewMode = (s?: KV | null): ViewMode => {
  const v = read(VIEW_KEY, s === undefined ? store() : s);
  return VIEWS.includes(v as ViewMode) ? (v as ViewMode) : 'editor';
};
export const writeViewMode = (v: ViewMode, s?: KV | null) => write(VIEW_KEY, v, s === undefined ? store() : s);

/** Zoom entre 50 e 200 (os limites do controle do rodapé); fora disso, 100. */
export const readZoom = (s?: KV | null): number => {
  const n = Number(read(ZOOM_KEY, s === undefined ? store() : s));
  return Number.isFinite(n) && n >= 50 && n <= 200 ? Math.round(n) : 100;
};
export const writeZoom = (z: number, s?: KV | null) => write(ZOOM_KEY, String(z), s === undefined ? store() : s);

export const readExpanded = (projectId: string, s?: KV | null): Set<string> => {
  try {
    const arr = JSON.parse(read(expandedKey(projectId), s === undefined ? store() : s) || '[]');
    return new Set(Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
};
export const writeExpanded = (projectId: string, ids: Set<string>, s?: KV | null) =>
  write(expandedKey(projectId), JSON.stringify([...ids]), s === undefined ? store() : s);
