export type DocumentType = 'text' | 'folder' | 'research' | 'trash' | 'front-matter' | 'characters' | 'places';

export type ViewMode = 'scrivenings' | 'corkboard' | 'outliner' | 'editor';

export interface Snapshot {
  id: string;
  timestamp: number;
  title: string;
  content: string;
}

export interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: number;
  range?: { from: number; to: number };
  quote?: string;
  color: string;
}

export interface Bookmark {
  id: string;
  title: string;
  url?: string;
  docId?: string;
}

export interface Keyword {
  text: string;
  color: string;
}

export interface DocumentMetadata {
  status: string;
  label: string;
  label_color: string;
  synopsis: string;
  notes: string;
  target_word_count: number;
  is_include_in_compile: boolean;
  section_type: string;
  created_at: number;
  updated_at: number;
  keywords: Keyword[];
  custom_metadata: Record<string, string>;
  snapshots: Snapshot[];
  comments: Comment[];
  bookmarks: Bookmark[];
}

export interface Doc {
  id: string;
  title: string;
  content: string;
  type: DocumentType;
  parent_id: string | null;
  order: number;
  metadata: DocumentMetadata;
  is_expanded?: boolean;
}

export interface ProjectSettings {
  target_word_count: number;
  session_target: number;
  deadline: number | null;
  composition_theme: 'dark' | 'sepia' | 'green' | 'custom';
  theme: 'traditional' | 'dark';
  paper_width: number;
  background_opacity: number;
}

export interface Project {
  id: string;
  name: string;
  owner_id: string;
  created_at: number;
  updated_at: number;
  settings: ProjectSettings;
}
