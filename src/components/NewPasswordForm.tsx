import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { translateAuthError, validateNewPassword, MIN_PASSWORD_LENGTH } from '../lib/password';

interface NewPasswordFormProps {
  /** Chamado depois que o Supabase confirmou a troca. */
  onDone?: () => void;
  submitLabel?: string;
  /** Visual do formulário: escuro da tela de login ou compacto dos Ajustes. */
  variant?: 'auth' | 'settings';
}

/** Nova senha + confirmação, gravada com supabase.auth.updateUser (exige sessão). */
export function NewPasswordForm({ onDone, submitLabel = 'Salvar nova senha', variant = 'auth' }: NewPasswordFormProps) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDone(false);
    const invalid = validateNewPassword(password, confirmation);
    if (invalid) {
      setError(invalid);
      return;
    }
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError(translateAuthError(updateError.message));
      return;
    }
    setPassword('');
    setConfirmation('');
    setDone(true);
    onDone?.();
  };

  const input = variant === 'auth'
    ? 'w-full bg-[#252525] border border-[#333] rounded-xl py-3 px-4 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 placeholder:text-gray-600'
    : 'w-full bg-[#222] border border-[#333] rounded-md px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#5B7A3D] placeholder:text-gray-600';
  const label = variant === 'auth'
    ? 'block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2 ml-1'
    : 'block text-xs text-gray-400 mb-1';
  const button = variant === 'auth'
    ? 'w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 rounded-xl transition-all disabled:opacity-50'
    : 'px-4 py-2 bg-[#333] hover:bg-[#444] text-gray-100 text-sm font-medium rounded-md transition-colors disabled:opacity-50';

  return (
    <form onSubmit={handleSubmit} className={variant === 'auth' ? 'space-y-5' : 'space-y-3'} aria-label="Nova senha">
      <div>
        <label htmlFor={`new-password-${variant}`} className={label}>Nova senha</label>
        <input
          id={`new-password-${variant}`}
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={input}
          placeholder={`Pelo menos ${MIN_PASSWORD_LENGTH} caracteres`}
        />
      </div>
      <div>
        <label htmlFor={`confirm-password-${variant}`} className={label}>Repita a nova senha</label>
        <input
          id={`confirm-password-${variant}`}
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          className={input}
        />
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      {done && <p role="status" className="text-xs text-emerald-400">Senha alterada.</p>}
      <div className={variant === 'settings' ? 'flex justify-end' : ''}>
        <button type="submit" disabled={loading} className={button}>
          {loading ? 'Salvando…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
