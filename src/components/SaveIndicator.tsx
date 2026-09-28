import React from 'react';
import { Check, CloudOff, Loader2, AlertTriangle, Save } from 'lucide-react';
import { cn } from '../lib/utils';
import { saveLabel, SaveLabelInput } from '../lib/saveLabel';

interface SaveIndicatorProps extends SaveLabelInput {
  /** Forca o envio imediato do que estiver na fila. */
  onSave: () => Promise<void>;
}

/** Faixa fixa no topo do editor: o salvamento e automatico, mas quem escreve
 *  quer VER que salvou. O botao grava ja e confirma com a hora. */
export function SaveIndicator({ onSave, ...state }: SaveIndicatorProps) {
  const [saving, setSaving] = React.useState(false);
  const { text, tone } = saveLabel(saving ? { ...state, status: 'pending', unsaved: true } : state);
  const Icon = tone === 'ok' ? Check : tone === 'busy' ? Loader2 : tone === 'warn' ? CloudOff : AlertTriangle;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-indicator" data-tone={tone}>
      <span className="save-indicator-status" role="status" aria-live="polite">
        <Icon size={13} className={cn(tone === 'busy' && 'animate-spin')} aria-hidden="true" />
        <span className="truncate">{text}</span>
      </span>
      <button
        type="button"
        className="save-indicator-btn"
        onMouseDown={(e) => e.preventDefault()}
        onClick={save}
        disabled={saving}
        title="Salvar agora (⌘S)"
      >
        <Save size={13} aria-hidden="true" />
        Salvar
      </button>
    </div>
  );
}
