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
