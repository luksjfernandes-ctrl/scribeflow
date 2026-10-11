/**
 * Limites por usuario gravados no banco (supabase_schema.sql, secao 10).
 *
 * O plano gratis do Supabase tem 500 MB para o banco inteiro. Sem teto, uma
 * conta sozinha enche o banco e o app fica somente leitura para todo mundo.
 * Quem barra e o Postgres; aqui ficam os numeros para a mensagem e a
 * classificacao do erro, sem React nem Supabase (tests/limits.test.ts, que
 * tambem confere se os numeros batem com o schema).
 */

export const LIMITS = {
  docContentMB: 2,
  docMetadataMB: 5,
  userTotalMB: 25,
  projectsPerUser: 100,
  docsPerUser: 20000,
  titleChars: 1000,
} as const;

interface DbError {
  code?: string;
  message?: string;
}

/** O banco recusou o conteudo (CHECK ou cota): tentar de novo igual nao adianta.
 *  23514 = check_violation, o mesmo SQLSTATE que os gatilhos de cota usam. */
export const isLimitError = (error: DbError | null | undefined): boolean =>
  !!error && (error.code === '23514' || (error.message ?? '').includes('scribeflow_limite'));

/** Mensagem curta em portugues para o erro de limite; null se for outro erro
 *  (rede, RLS etc.), que segue o tratamento de sempre. Curta porque aparece na
 *  faixa de salvamento, que corta o texto em telas estreitas. */
export const limitMessage = (error: string | null | undefined): string | null => {
  if (!error) return null;
  if (error.includes('docs_content_tamanho')) {
    return `Não salvou: o documento passou de ${LIMITS.docContentMB} MB. Divida o texto.`;
  }
  if (error.includes('docs_metadata_tamanho')) {
    return `Não salvou: as versões guardadas passaram de ${LIMITS.docMetadataMB} MB. Apague snapshots antigos.`;
  }
  if (error.includes('scribeflow_limite: espaco')) {
    return `Não salvou: sua conta chegou a ${LIMITS.userTotalMB} MB. Apague documentos ou snapshots.`;
  }
  if (error.includes('scribeflow_limite: docs')) {
    return `Sua conta chegou ao limite de ${LIMITS.docsPerUser.toLocaleString('pt-BR')} documentos.`;
  }
  if (error.includes('scribeflow_limite: projetos')) {
    return `Sua conta chegou ao limite de ${LIMITS.projectsPerUser} livros.`;
  }
  if (/(docs_title_tamanho|projects_name_tamanho)/.test(error)) return 'O título passou do tamanho máximo.';
  if (error.includes('projects_settings_tamanho')) return 'Os ajustes deste livro passaram do tamanho máximo.';
  return null;
};

/** Erro guardado na fila quando a gravacao casou 0 linhas por falta de sessao
 *  (saiu da conta em outra aba, token expirou): a edicao espera o login. */
export const SESSION_LOST = 'scribeflow_sessao_perdida';

/** Texto para um doc que o banco recusou: o do limite, o da sessao, ou um generico. */
export const refusedMessage = (error: string | null | undefined): string => {
  if (error === SESSION_LOST) return 'Não salvou: a sessão caiu. Entre de novo e aperte ⌘S.';
  return limitMessage(error) ?? 'Não salvou: o banco recusou a última alteração.';
};
