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

-- 3. Create Docs table
CREATE TABLE IF NOT EXISTS public.docs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    type TEXT NOT NULL, -- 'text', 'folder', 'research', 'characters', 'places', 'front-matter', 'trash'
    parent_id TEXT,
    "order" INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at BIGINT DEFAULT extract(epoch from now()) * 1000,
    updated_at BIGINT DEFAULT extract(epoch from now()) * 1000
);

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

-- 7. Realtime setup (Optional but recommended for the sync logic)
-- Add tables to the 'supabase_realtime' publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.projects;
ALTER PUBLICATION supabase_realtime ADD TABLE public.docs;
