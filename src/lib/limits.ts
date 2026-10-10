/**
 * Limites por usuario gravados no banco (supabase_schema.sql, secao 10).
 *
 * O plano gratis do Supabase tem 500 MB para o banco inteiro. Sem teto, uma
 * conta sozinha enche o banco e o app fica somente leitura para todo mundo.
 * Quem barra e o Postgres; aqui ficam so os numeros para a mensagem e a
 * traducao do erro, sem React nem Supabase (tests/limits.test.ts).
 */

export const LIMITS = {
  docContentMB: 2,
  docMetadataMB: 5,
  userTotalMB: 25,
  projectsPerUser: 100,
  docsPerUser: 20000,
} as const;

/** Mensagem em portugues quando o erro do banco e um dos limites; null se for
 *  outro erro (rede, RLS etc.), que segue o tratamento de sempre. */
export const limitMessage = (error: string | null | undefined): string | null => {
  if (!error) return null;
  if (error.includes('docs_content_tamanho')) {
    return `Este documento passou de ${LIMITS.docContentMB} MB e não foi salvo. Divida o texto em mais de um documento.`;
  }
  if (error.includes('docs_metadata_tamanho')) {
    return `As notas e versões guardadas deste documento passaram de ${LIMITS.docMetadataMB} MB. Apague versões antigas (snapshots) para voltar a salvar.`;
  }
  if (error.includes('scribeflow_limite: espaco')) {
    return `Sua conta chegou a ${LIMITS.userTotalMB} MB de texto e não salvou a última alteração. Apague documentos ou versões antigas para liberar espaço.`;
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
