-- Migracao de 03/11/2026 para o banco de producao do ScribeFlow.
--
-- Aplica a secao 11 do supabase_schema.sql: o banco recusa o parent_id que
-- fecharia um ciclo na arvore (X dentro de Y e Y dentro de X), que fazia a
-- subarvore inteira sumir do Binder e da exportacao.
--
-- Antes de rodar, veja se ja existe ciclo gravado (a resposta deve ser vazia;
-- se nao for, devolva um dos itens para o Manuscrito antes):
--   WITH RECURSIVE sobe(id, atual, passos) AS (
--     SELECT id, parent_id, 1 FROM public.docs WHERE parent_id IS NOT NULL
--     UNION ALL
--     SELECT s.id, d.parent_id, s.passos + 1 FROM sobe s JOIN public.docs d ON d.id = s.atual
--      WHERE s.atual <> s.id AND s.passos < 1000
--   )
--   SELECT DISTINCT id FROM sobe WHERE atual = id;
--
-- Aplicar: Supabase -> SQL Editor, colar este arquivo inteiro e rodar.
-- Pode rodar mais de uma vez.

-- 11. Arvore sem ciclo (03/11/2026)
-- Cada aba confere o arraste so contra o proprio estado. Duas abas (ou uma
-- aba que perdeu eventos do realtime) podiam gravar X dentro de Y e Y dentro
-- de X: a subarvore inteira, texto incluido, sumia do Binder e da exportacao.
-- O banco recusa o parent_id que fecharia um ciclo. A trava por livro faz a
-- segunda gravacao esperar a primeira e enxergar o ciclo.
CREATE OR REPLACE FUNCTION public.scribeflow_sem_ciclo()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  atual text := NEW.parent_id;
  passos int := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.parent_id IS NOT DISTINCT FROM OLD.parent_id THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('scribeflow_arvore:' || coalesce(NEW.project_id, '')));
  WHILE atual IS NOT NULL LOOP
    IF atual = NEW.id THEN
      RAISE EXCEPTION 'scribeflow_ciclo: o item ficaria dentro de si mesmo' USING ERRCODE = 'check_violation';
    END IF;
    passos := passos + 1;
    -- Ciclo antigo mais acima (gravado antes desta regra): nao prende o banco.
    EXIT WHEN passos > 10000;
    SELECT d.parent_id INTO atual FROM public.docs d WHERE d.id = atual;
  END LOOP;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scribeflow_sem_ciclo ON public.docs;
CREATE TRIGGER scribeflow_sem_ciclo
  BEFORE INSERT OR UPDATE OF parent_id ON public.docs
  FOR EACH ROW
  WHEN (NEW.parent_id IS NOT NULL)
  EXECUTE FUNCTION public.scribeflow_sem_ciclo();
