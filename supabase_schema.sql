-- Final Scribeflow Supabase Schema
-- Run this in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Projects table
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    settings JSONB DEFAULT '{}'::jsonb
);

-- 3. Create Folder Role Enum Type (or use TEXT to maintain simplicity w/ current schema, matching `type` enum check)
-- We will use TEXT with a CHECK constraint here to avoid dropping DB Types on redeploy
-- folder_role IN ('manuscript', 'characters', 'places', 'research', 'trash')

-- 4. Create Docs table
CREATE TABLE IF NOT EXISTS public.docs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    type TEXT NOT NULL, -- 'text', 'folder', 'research', 'characters', 'places', 'front-matter', 'trash'
    parent_id TEXT REFERENCES public.docs(id) ON DELETE CASCADE,
    "order" INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    folder_role TEXT DEFAULT NULL CHECK (folder_role IN ('manuscript', 'characters', 'places', 'research', 'trash')),
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    CONSTRAINT unique_folder_role_per_project UNIQUE (project_id, folder_role)
);

CREATE INDEX IF NOT EXISTS idx_documents_project_id ON public.docs(project_id);
CREATE INDEX IF NOT EXISTS idx_documents_parent_id ON public.docs(parent_id);
CREATE INDEX IF NOT EXISTS idx_documents_folder_role ON public.docs(project_id, folder_role) WHERE folder_role IS NOT NULL;


-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

-- 5. Create Policies for Projects
-- Policies are dropped first so this script is idempotent and can be safely
-- re-run (e.g. when restoring a paused Supabase project).
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
CREATE POLICY "Users can view their own projects"
ON public.projects FOR SELECT
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can insert their own projects" ON public.projects;
CREATE POLICY "Users can insert their own projects"
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = owner_id);

-- 6. Create Policies for Docs
-- Note: We check if the user owns the project this doc belongs to
DROP POLICY IF EXISTS "Users can view docs in their projects" ON public.docs;
CREATE POLICY "Users can view docs in their projects"
ON public.docs FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE public.projects.id = public.docs.project_id 
        AND public.projects.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can insert docs in their projects" ON public.docs;
CREATE POLICY "Users can insert docs in their projects"
ON public.docs FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE public.projects.id = public.docs.project_id 
        AND public.projects.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can update docs in their projects" ON public.docs;
CREATE POLICY "Users can update docs in their projects"
ON public.docs FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE public.projects.id = public.docs.project_id 
        AND public.projects.owner_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Users can delete docs in their projects" ON public.docs;
CREATE POLICY "Users can delete docs in their projects"
ON public.docs FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE public.projects.id = public.docs.project_id 
        AND public.projects.owner_id = auth.uid()
    )
);

-- 7. Realtime setup
-- Wrapped so re-running the script doesn't error when the tables are already
-- members of the publication.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.docs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 8. Remoção da RPC create_project_structure (issue #7)
-- A função era SECURITY DEFINER e aceitava qualquer p_project_id sem checar
-- ownership (auth.uid() = projects.owner_id), contornando a RLS de docs.
-- O cliente nunca a chama (a estrutura inicial é gerada em generateInitialDocs,
-- no App.tsx), então a superfície de ataque é removida em vez de corrigida.
DROP FUNCTION IF EXISTS public.create_project_structure(TEXT);

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
