# COUNTER_MEASURES.md

**Repositorio:** `scribeflow`
**Origem:** Pre-Mortem IV - Auditoria Adversarial 2026-05-10
**Referencia Notion:** https://www.notion.so/35c2d8a76b8b81cb945efd5a4316ad51
**Atualizado:** 2026-05-10
**Status do repo:** DORM�NCIA PROLONGADA - RECOMENDA��O ADVERSARIAL: DESLIGAR

---

## VEREDICTO DESTE REPOSIT�RIO

- **Apenas branch `main` existe. Zero atividade em 7+ dias.**
- **PM-I H-03 e H-04 marcam scribeflow como pendente** para staging + testes minimos. ABERTO h� 21 dias.
- **Sem dono declarado, sem teste, sem staging, sem proposito atual na operacao.**
- Dormencia de >= 21 dias + zero indicio de retomada planejada + zero usuarios ativos verificados = **arquivar e seguir**.

**Recomendacao adversarial da PM-IV:** DESLIGAR. Se houver razao para manter, ela precisa ser declarada em `STATUS.md` hoje, com prazo de proximo commit, dono e proposito - caso contrario, presume-se que nao h�.

---

## P0 - EXECUTAR EM 48 HORAS (vencimento 2026-05-12)

### CM-A. Decidir destino: MANTER / CONGELAR / DESLIGAR
**Vetor neutralizado:** PM-III CM-20 (vencida 2026-05-10), PM-IV V17
**Posicao default:** DESLIGAR se nao houver justificativa explicita.

**Acao:** `STATUS.md` em main com uma decisao:
- **MANTER** = declarar dono, proposito atual, data do proximo commit (max 14 dias), e CI minimo verde. Aceitar CM-B/CM-C abaixo.
- **CONGELAR** = README com aviso "projeto pausado", credenciais (se houver) rotacionadas e revogadas, dependencias congeladas, Vercel/hosting em pausa ou downgrade para free tier.
- **DESLIGAR (RECOMENDADO)** = backup de tudo que possa ser util (export Notion/db/zip), DNS removido (se houver dominio), repo arquivado via GitHub Settings.

**Aceite:** `STATUS.md` em main com decisao + data + responsavel.

### CM-B. (apenas se MANTER) Declarar proposito e dono
**Acao:**
- `README.md` em main responde:
  - O que e scribeflow?
  - Quem usa hoje?
  - Quem mantem?
  - Qual o proximo milestone com data?
- Se alguma resposta for "nao sei" ou "ninguem", reclassificar para CONGELAR.
**Aceite:** README com 4 respostas explicitas.

### CM-C. (apenas se DESLIGAR) Backup + arquivar
**Acao:**
- Verificar se ha banco de dados, conteudo, ou usuarios ativos. Se sim:
  - Export do banco para `.sql` ou `.csv` armazenado em vault.
  - Notificar usuarios ativos (se identificaveis) com 30 dias de antecedencia.
- DNS removido. Hosting cancelado.
- GitHub repo -> Settings -> Archive this repository.
**Aceite:** repo aparece como "archived" no GitHub. DNS retorna NXDOMAIN. Backup acessivel.

---

## P1 - APENAS SE MANTER (vencimento 2026-05-24)

### CM-D. CI minimo verde (PM-I H-04)
**Acao:** GitHub Action rodando lint + build em cada PR. Status check obrigatorio em main.
**Aceite:** PR com codigo quebrado retorna CI vermelho.

### CM-E. Staging environment (PM-I H-03)
**Acao:** Vercel Preview deploy automatico para qualquer branch. Branch `staging` -> URL fixa.
**Aceite:** push em staging gera URL Vercel distinta da producao.

### CM-F. Testes minimos (PM-I H-04)
**Acao:** Vitest com pelo menos 1 teste por modulo core. Meta inicial 30% no diretorio raiz.
**Aceite:** CI roda testes. Cobertura badge.

---

## P2 - APENAS SE MANTER (vencimento 2026-06-09)

### CM-G. Observabilidade
**Acao:** Sentry + Vercel Log Drain.
**Aceite:** erro 5xx forcado aparece em Sentry < 60s.

---

## ITENS HERDADOS

- PM-I H-03: staging - CM-E.
- PM-I H-04: testes - CM-F.
- PM-III CM-20: STATUS.md - **VENCIDA HOJE** - CM-A acima.

---

## REGRA DE AUDITORIA

- PM-V abre em 2026-05-17.
- Se ate la nao houver `STATUS.md` em main, **PM-V vai recomendar DESLIGAR e arquivar este repo automaticamente** (do ponto de vista do auditor; arquivamento real depende do operador, mas a auditoria deixa de listar o repo como ativo).
- Documento existente apenas em branch claude/* nao conta como executado.

**Proxima revisao:** 2026-05-17
