-- Migracao de 03/11/2026 para o banco de producao do ScribeFlow.
--
-- Fecha tres furos na cota por conta (secao 10 do supabase_schema.sql):
-- 1. `docs.type` aceitava texto livre de qualquer tamanho, e a cota so somava
--    corpo + metadata: uma conta gravava dezenas de MB fora da conta.
-- 2. titulo e id (escolhido pelo cliente) tambem ficavam fora da soma.
-- 3. sem trava, gravacoes simultaneas contavam cada uma so o que ja estava
--    confirmado: 4 lotes de 15.000 docs em paralelo gravaram 30.000.
--
-- Antes de rodar, confira que nenhuma linha atual tem `type` fora da lista
-- (a resposta tem que ser vazia; senao o CHECK abaixo aborta a migracao):
--   SELECT type, count(*) FROM public.docs
--    WHERE type NOT IN ('text', 'folder', 'research', 'trash', 'front-matter', 'characters', 'places')
--    GROUP BY type;
--
-- Aplicar: Supabase -> SQL Editor, colar este arquivo inteiro e rodar.
-- Pode rodar mais de uma vez.

DO $$
BEGIN
  -- Sem isto, `type` aceitava texto livre de qualquer tamanho, fora da cota.
  ALTER TABLE public.docs ADD CONSTRAINT docs_type_valido
    CHECK (type IN ('text', 'folder', 'research', 'trash', 'front-matter', 'characters', 'places'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Cota por conta: 25 MB e 20.000 documentos.
-- SECURITY INVOKER de proposito: com a RLS, as somas so enxergam os docs de
-- quem grava (e a RLS ja barrou gravacao em projeto de outra conta).
--
-- O que conta: corpo, metadata, titulo, tipo e id (o id e escolhido pelo
-- cliente). Contar so corpo + metadata deixava gravar o resto de graca.
-- parent_id e project_id ficam de fora: repetem um id que ja existe, e assim
-- mover de pasta nunca esbarra na cota.
--
-- Trava por conta (pg_advisory_xact_lock) antes de contar: sem ela, duas
-- gravacoes simultaneas contavam cada uma so o que ja estava confirmado, e as
-- duas passavam (4 lotes de 15.000 docs em paralelo gravaram 30.000).

-- INSERT: uma checagem por comando, depois de gravar. Criar um projeto (9 docs)
-- ou importar centenas de docs custa uma soma so, nao uma por linha.
CREATE OR REPLACE FUNCTION public.scribeflow_limite_docs_lote()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  excedido text;
  dono uuid;
BEGIN
  FOR dono IN
    SELECT DISTINCT p2.owner_id FROM novos n JOIN public.projects p2 ON p2.id = n.project_id ORDER BY 1
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('scribeflow_cota:' || dono::text));
  END LOOP;

  SELECT CASE WHEN t.quantos > 20000 THEN 'docs' ELSE 'espaco' END
    INTO excedido
    FROM (
      SELECT count(*) AS quantos,
             sum(coalesce(pg_column_size(d.content), 0) + coalesce(pg_column_size(d.metadata), 0) + coalesce(pg_column_size(d.title), 0) + coalesce(pg_column_size(d.type), 0) + coalesce(pg_column_size(d.id), 0)) AS usados
        FROM public.docs d
        JOIN public.projects p ON p.id = d.project_id
       WHERE p.owner_id IN (SELECT p2.owner_id FROM novos n JOIN public.projects p2 ON p2.id = n.project_id)
       GROUP BY p.owner_id
    ) t
   WHERE t.quantos > 20000 OR t.usados > 25000000
   LIMIT 1;

  IF excedido IS NOT NULL THEN
    RAISE EXCEPTION 'scribeflow_limite: %', excedido USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS scribeflow_limite_docs_insert ON public.docs;
CREATE TRIGGER scribeflow_limite_docs_insert
  AFTER INSERT ON public.docs
  REFERENCING NEW TABLE AS novos
  FOR EACH STATEMENT EXECUTE FUNCTION public.scribeflow_limite_docs_lote();

-- UPDATE: o autosave grava um doc por vez. So dispara quando muda uma coluna
-- que conta na cota, entao reordenar o Binder (`order`, `parent_id`) nao paga a soma.
-- Roda DEPOIS de gravar para medir tudo pelo tamanho em disco (comprimido),
-- igual ao INSERT. Medir o NEW cru contra as outras linhas comprimidas recusaria
-- uma edicao de 1 caractere em doc grande perto do teto; medir so o crescimento
-- cru deixaria trocar texto repetitivo por aleatorio do mesmo tamanho cru e
-- crescer em disco sem checagem. Linha que nao cresceu em disco sempre passa.
CREATE OR REPLACE FUNCTION public.scribeflow_limite_docs()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  dono uuid;
  usados bigint;
BEGIN
  IF coalesce(pg_column_size(NEW.content), 0) + coalesce(pg_column_size(NEW.metadata), 0) + coalesce(pg_column_size(NEW.title), 0) + coalesce(pg_column_size(NEW.type), 0) + coalesce(pg_column_size(NEW.id), 0)
     <= coalesce(pg_column_size(OLD.content), 0) + coalesce(pg_column_size(OLD.metadata), 0) + coalesce(pg_column_size(OLD.title), 0) + coalesce(pg_column_size(OLD.type), 0) + coalesce(pg_column_size(OLD.id), 0) THEN
    RETURN NULL;
  END IF;

  SELECT owner_id INTO dono FROM public.projects WHERE id = NEW.project_id;
  IF dono IS NULL THEN
    RETURN NULL;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('scribeflow_cota:' || dono::text));

  SELECT coalesce(sum(coalesce(pg_column_size(d.content), 0) + coalesce(pg_column_size(d.metadata), 0) + coalesce(pg_column_size(d.title), 0) + coalesce(pg_column_size(d.type), 0) + coalesce(pg_column_size(d.id), 0)), 0)
    INTO usados
    FROM public.docs d
    JOIN public.projects p ON p.id = d.project_id
   WHERE p.owner_id = dono;

  IF usados > 25000000 THEN
    RAISE EXCEPTION 'scribeflow_limite: espaco' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS scribeflow_limite_docs_update ON public.docs;
CREATE TRIGGER scribeflow_limite_docs_update
  AFTER UPDATE OF content, metadata, title, type, id ON public.docs
  FOR EACH ROW EXECUTE FUNCTION public.scribeflow_limite_docs();

CREATE OR REPLACE FUNCTION public.scribeflow_limite_projetos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('scribeflow_cota:' || NEW.owner_id::text));
  IF (SELECT count(*) FROM public.projects WHERE owner_id = NEW.owner_id) >= 100 THEN
    RAISE EXCEPTION 'scribeflow_limite: projetos' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scribeflow_limite_projetos ON public.projects;
CREATE TRIGGER scribeflow_limite_projetos
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.scribeflow_limite_projetos();
