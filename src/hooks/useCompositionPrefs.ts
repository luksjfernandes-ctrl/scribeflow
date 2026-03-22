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
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_PREFS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_PREFS;
      }
    }
    return DEFAULT_PREFS;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const updatePrefs = (updates: Partial<CompositionPrefs>) => {
    setPrefs(prev => ({ ...prev, ...updates }));
  };

  return { prefs, updatePrefs };
}
