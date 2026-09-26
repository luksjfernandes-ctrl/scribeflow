/**
 * Regras da troca de senha, fora dos componentes para testar sem React nem
 * Supabase. O servidor continua sendo quem decide; aqui só se evita a ida e
 * volta em erro óbvio e se traduz o que o Supabase responde em inglês.
 */

/** Mínimo padrão do Supabase Auth. */
export const MIN_PASSWORD_LENGTH = 6;

export const validateNewPassword = (password: string, confirmation: string): string | null => {
  if (password.length < MIN_PASSWORD_LENGTH) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (password !== confirmation) return 'As duas senhas não são iguais.';
  return null;
};

/** Mensagens do Supabase Auth em português; o resto passa como veio. */
export const translateAuthError = (message: string): string => {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('only request this after')) {
    return 'Muitos pedidos em pouco tempo. Espere alguns minutos e tente de novo.';
  }
  if (m.includes('should be different from the old password')) return 'A nova senha precisa ser diferente da atual.';
  if (m.includes('password should be at least')) return `A senha precisa ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  if (m.includes('weak password') || m.includes('password is known to be weak')) return 'Essa senha é fraca demais. Escolha outra.';
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'Confirme o seu e-mail antes de entrar (veja a caixa de entrada).';
  if (m.includes('auth session missing') || m.includes('session_not_found') || m.includes('jwt expired')) {
    return 'O link expirou ou já foi usado. Peça um novo em "Esqueci a senha".';
  }
  return message;
};

/** Link de recuperação (fluxo implicit): o hash traz type=recovery. */
export const isRecoveryUrl = (hash: string): boolean => /(?:^|[#&])type=recovery(?:&|$)/.test(hash);

/** Erro devolvido no hash do link (ex.: link expirado), já em português; null se não houver. */
export const recoveryLinkError = (hash: string): string | null => {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const code = params.get('error_code');
  if (!params.get('error') && !code) return null;
  if (code === 'otp_expired') return 'O link de nova senha expirou ou já foi usado. Peça outro em "Esqueci a senha".';
  return translateAuthError(params.get('error_description') ?? 'Não foi possível usar o link.');
};
