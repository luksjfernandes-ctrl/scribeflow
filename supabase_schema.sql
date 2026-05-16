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
CREATE POLICY "Users can view their own projects" 
ON public.projects FOR SELECT 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can insert their own projects" 
ON public.projects FOR INSERT 
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own projects" 
ON public.projects FOR UPDATE 
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own projects" 
ON public.projects FOR DELETE 
USING (auth.uid() = owner_id);

-- 6. Create Policies for Docs
-- Note: We check if the user owns the project this doc belongs to
CREATE POLICY "Users can view docs in their projects" 
ON public.docs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE public.projects.id = public.docs.project_id 
        AND public.projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can insert docs in their projects" 
ON public.docs FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE public.projects.id = public.docs.project_id 
        AND public.projects.owner_id = auth.uid()
    )
);

CREATE POLICY "Users can update docs in their projects" 
ON public.docs FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.projects 
        WHERE public.projects.id = public.docs.project_id 
        AND public.projects.owner_id = auth.uid()
    )
);

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
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.docs;

-- 7.1 Validate metadata.folder_color server-side (defense against XSS in SVG icons).
-- Accept only #RGB / #RRGGBB / #RRGGBBAA hex strings or simple named colors.
ALTER TABLE public.docs
  ADD CONSTRAINT docs_metadata_folder_color_safe
  CHECK (
    metadata->>'folder_color' IS NULL
    OR metadata->>'folder_color' ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$'
    OR metadata->>'folder_color' ~ '^[a-zA-Z]{3,20}$'
  );

ALTER TABLE public.docs
  ADD CONSTRAINT docs_metadata_label_color_safe
  CHECK (
    metadata->>'label_color' IS NULL
    OR metadata->>'label_color' = 'transparent'
    OR metadata->>'label_color' ~ '^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?([0-9A-Fa-f]{2})?$'
    OR metadata->>'label_color' ~ '^[a-zA-Z]{3,20}$'
  );

-- 8. Stored Procedure for new project structural generation
CREATE OR REPLACE FUNCTION create_project_structure(p_project_id TEXT)
RETURNS void AS $$
DECLARE
  v_manuscript_id TEXT;
  v_characters_id TEXT;
  v_places_id TEXT;
  v_research_id TEXT;
  v_trash_id TEXT;
BEGIN
  -- Criar pasta Manuscript
  INSERT INTO public.docs (project_id, title, type, parent_id, "order", folder_role)
  VALUES (p_project_id, 'Manuscript', 'folder', NULL, 0, 'manuscript')
  RETURNING id INTO v_manuscript_id;

  -- Criar pastas estruturais restantes
  INSERT INTO public.docs (project_id, title, type, parent_id, "order", folder_role) VALUES
    (p_project_id, 'Characters', 'folder', NULL, 1, 'characters'),
    (p_project_id, 'Places',     'folder', NULL, 2, 'places'),
    (p_project_id, 'Research',   'folder', NULL, 3, 'research'),
    (p_project_id, 'Trash',      'folder', NULL, 4, 'trash');
    
  -- Criar primeiro capítulo dentro de Manuscript
  INSERT INTO public.docs (project_id, title, type, parent_id, "order", content)
  VALUES (p_project_id, 'Meeting at Orson Lake', 'text', v_manuscript_id, 0, '<h1>The Meeting at Orson Lake</h1><p>Start writing here...</p>');

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
