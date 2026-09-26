/**
 * Limpa uma variável de ambiente. Colada no painel da Vercel com `echo`, a
 * chave ganhou um "\n" no fim: o REST não sente (o fetch apara o header), mas o
 * realtime manda a chave na URL do WebSocket (`%0A`) e o gateway recusa.
 * Vazia ou só espaços vira undefined, para cair no erro de configuração ausente.
 */
export const cleanEnv = (value: string | undefined | null): string | undefined => {
  const v = value?.trim();
  return v ? v : undefined;
};
