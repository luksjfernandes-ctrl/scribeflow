import { useState, useEffect } from 'react';

export interface CompositionPrefs {
  paperWidth: number;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
}

const DEFAULT_PREFS: CompositionPrefs = {
  paperWidth: 680,
  fontSize: 18,
  fontFamily: 'serif',
  lineHeight: 1.8,
};

const STORAGE_KEY = 'scribeflow-composition-prefs';

export function useCompositionPrefs() {
  const [prefs, setPrefs] = useState<CompositionPrefs>(() => {
    // localStorage pode lançar (aba anônima, armazenamento bloqueado)
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_PREFS, ...JSON.parse(saved) } : DEFAULT_PREFS;
    } catch {
      return DEFAULT_PREFS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      // sem armazenamento: os ajustes valem só nesta sessão
    }
  }, [prefs]);

  const updatePrefs = (updates: Partial<CompositionPrefs>) => {
    setPrefs(prev => ({ ...prev, ...updates }));
  };

  return { prefs, updatePrefs };
}
