# Segurança · Security

## Como relatar uma falha

Não abra issue pública para falha de segurança. Use o relato privado do GitHub:
aba **Security** → **Report a vulnerability**
([link direto](https://github.com/luksjfernandes-ctrl/scribeflow/security/advisories/new)).

Inclua o que for possível: o caminho afetado, os passos para reproduzir e o
impacto (o que um atacante consegue ler, alterar ou derrubar). A resposta vem em
até 7 dias, e a correção é publicada com crédito para quem relatou, se quiser.

## Reporting a vulnerability

Please do not open a public issue. Use GitHub's private reporting instead:
**Security** tab → **Report a vulnerability**
([direct link](https://github.com/luksjfernandes-ctrl/scribeflow/security/advisories/new)).
Include the affected path, steps to reproduce and the impact. You will get an
answer within 7 days, and fixes are credited to the reporter if they wish.

## Escopo · Scope

- O app publicado em `scribeflow-psi.vercel.app` e o código deste repositório.
- A política de acesso ao banco (`supabase_schema.sql`): cada conta só lê e grava
  os próprios livros, e há limites de tamanho por conta.
- A chave `VITE_SUPABASE_ANON_KEY` que aparece no navegador é pública por
  natureza; quem protege os dados é a RLS do banco, não o sigilo dessa chave.

Fora do escopo: ataques de volume (DDoS) contra a Vercel ou o Supabase,
engenharia social e falhas em dependências sem caminho de exploração no app.
