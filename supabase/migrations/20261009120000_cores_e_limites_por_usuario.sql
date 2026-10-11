-- Migracao de 09/10/2026 para o banco de producao do ScribeFlow.
--
-- Producao estava sem a secao 9 do supabase_schema.sql (validacao das cores,
-- defesa contra XSS via SVG inline) e ainda nao tem a secao 10 (limites por
-- usuario). Este arquivo aplica as duas, e pode rodar mais de uma vez.
-- Conferido em 09/10: nenhuma linha atual viola os novos CHECKs (cores
-- validas, maior doc 12 KB, maior conta 77 KB).
--
-- Aplicar: Supabase -> SQL Editor, colar este arquivo inteiro e rodar.

-- 9. Validacao das cores no servidor (defesa contra XSS via SVG inline)
-- Aceita apenas #RGB / #RRGGBB / #RRGGBBAA ou nomes simples de cor.
-- Envolvido em DO/EXCEPTION porque ADD CONSTRAINT nao aceita IF NOT EXISTS:
-- sem isso, reexecutar o schema (como o README instrui) abortaria aqui.
DO $$
BEGIN
  ALTER TABLE public.docs
    ADD CONSTRAINT docs_metadata_folder_color_safe
    CHECK (
      metadata->>'folder_color' IS NULL
      OR metadata->>'folder_color' ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$'
      OR metadata->>'folder_color' ~ '^[a-zA-Z]{3,20}$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.docs
    ADD CONSTRAINT docs_metadata_label_color_safe
    CHECK (
      metadata->>'label_color' IS NULL
      OR metadata->>'label_color' = 'transparent'
      OR metadata->>'label_color' ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$'
      OR metadata->>'label_color' ~ '^[a-zA-Z]{3,20}$'
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 10. Limites por usuario (09/10/2026)
-- O plano gratis do Supabase tem 500 MB para o banco inteiro. Sem teto, uma
-- conta sozinha enche o banco e o app fica somente leitura para todo mundo.
-- Em 09/10 o maior doc tinha 12 KB e a maior conta 77 KB: os tetos ficam
-- centenas de vezes acima do uso real. Os mesmos numeros estao em
-- src/lib/limits.ts, que traduz o erro para quem escreve.
DO $$
BEGIN
  ALTER TABLE public.docs ADD CONSTRAINT docs_content_tamanho CHECK (octet_length(content) <= 2000000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- O metadata guarda as versoes (snapshots) do texto, por isso o teto e maior.
  ALTER TABLE public.docs ADD CONSTRAINT docs_metadata_tamanho CHECK (pg_column_size(metadata) <= 5000000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.docs ADD CONSTRAINT docs_title_tamanho CHECK (char_length(title) <= 1000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.projects ADD CONSTRAINT projects_name_tamanho CHECK (char_length(name) <= 500);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.projects ADD CONSTRAINT projects_settings_tamanho CHECK (pg_column_size(settings) <= 256000);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Usado pelas politicas de RLS (auth.uid() = owner_id) e pelas cotas abaixo.
CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);

-- Cota por conta: 25 MB de texto + metadata e 20.000 documentos.
-- SECURITY INVOKER de proposito: com a RLS, as somas so enxergam os docs de
-- quem grava (e a RLS ja barrou gravacao em projeto de outra conta).

-- INSERT: uma checagem por comando, depois de gravar. Criar um projeto (9 docs)
-- ou importar centenas de docs custa uma soma so, nao uma por linha.
CREATE OR REPLACE FUNCTION public.scribeflow_limite_docs_lote()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  excedido text;
BEGIN
  SELECT CASE WHEN t.quantos > 20000 THEN 'docs' ELSE 'espaco' END
    INTO excedido
    FROM (
      SELECT count(*) AS quantos,
             sum(coalesce(pg_column_size(d.content), 0) + coalesce(pg_column_size(d.metadata), 0)) AS usados
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

-- UPDATE: o autosave grava um doc por vez. So dispara quando corpo ou metadata
-- mudam, entao reordenar o Binder (`order`, `parent_id`) nao paga a soma.
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
  IF coalesce(pg_column_size(NEW.content), 0) + coalesce(pg_column_size(NEW.metadata), 0)
     <= coalesce(pg_column_size(OLD.content), 0) + coalesce(pg_column_size(OLD.metadata), 0) THEN
    RETURN NULL;
  END IF;

  SELECT owner_id INTO dono FROM public.projects WHERE id = NEW.project_id;
  IF dono IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(sum(coalesce(pg_column_size(d.content), 0) + coalesce(pg_column_size(d.metadata), 0)), 0)
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
  AFTER UPDATE OF content, metadata ON public.docs
  FOR EACH ROW EXECUTE FUNCTION public.scribeflow_limite_docs();

CREATE OR REPLACE FUNCTION public.scribeflow_limite_projetos()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (SELECT count(*) FROM public.projects WHERE owner_id = NEW.owner_id) >= 100 THEN
    RAISE EXCEPTION 'scribeflow_limite: projetos' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS scribeflow_limite_projetos ON public.projects;
CREATE TRIGGER scribeflow_limite_projetos
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.scribeflow_limite_projetos();
