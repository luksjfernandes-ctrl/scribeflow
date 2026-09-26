import React, { useEffect, useRef, useState } from 'react';

interface InlineNameInputProps {
  initialValue: string;
  onCommit: (value: string) => void;
  onCancel: () => void;
  className?: string;
  ariaLabel?: string;
}

/**
 * Campo de renomear no lugar: Enter (ou sair do campo) confirma, Esc cancela.
 * Nome vazio ou igual ao atual conta como cancelar.
 */
export const InlineNameInput: React.FC<InlineNameInputProps> = ({
  initialValue,
  onCommit,
  onCancel,
  className,
  ariaLabel,
}) => {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  // Evita confirmar duas vezes (Enter seguido do blur que ele provoca).
  const doneRef = useRef(false);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = (commit: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const trimmed = value.trim();
    if (commit && trimmed && trimmed !== initialValue) {
      onCommit(trimmed);
    } else {
      onCancel();
    }
  };

  return (
    <input
      ref={inputRef}
      aria-label={ariaLabel}
      className={className}
      value={value}
      maxLength={200}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          finish(true);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        }
      }}
    />
  );
};
