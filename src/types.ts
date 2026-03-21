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
  labelColor: string;
  synopsis: string;
  notes: string;
  targetWordCount: number;
  isIncludeInCompile: boolean;
  sectionType: string;
  createdAt: number;
  updatedAt: number;
  keywords: Keyword[];
  customMetadata: Record<string, string>;
  snapshots: Snapshot[];
  comments: Comment[];
  bookmarks: Bookmark[];
}

export interface Doc {
  id: string;
  title: string;
  content: string;
  type: DocumentType;
  parentId: string | null;
  order: number;
  metadata: DocumentMetadata;
  isExpanded?: boolean;
}

export interface ProjectSettings {
  targetWordCount: number;
  sessionTarget: number;
  deadline: number | null;
  compositionTheme: 'dark' | 'sepia' | 'green' | 'custom';
  theme: 'traditional' | 'dark';
  paperWidth: number;
  backgroundOpacity: number;
}

export interface Project {
  id: string;
  name: string;
  ownerId: string;
  createdAt: number;
  updatedAt: number;
  settings: ProjectSettings;
}
