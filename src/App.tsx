/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { z } from 'zod';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { ParagraphFocus } from './extensions/paragraphFocus';
import ProjectsModal from './components/ProjectsModal';
import { 
  Layout, 
  Columns, 
  Grid, 
  FileText, 
  Maximize2, 
  Settings, 
  Save, 
  Plus, 
  FolderPlus,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Info,
  Download,
  Search,
  MoreHorizontal,
  Share,
  PenTool,
  Trash2,
  Edit3,
  Folder,
  File
} from 'lucide-react';
import { Doc, Project, ViewMode, DocumentType, DocumentMetadata } from './types';
import { FOLDER_COLORS, ICONS, LABEL_COLORS } from './constants';
import { Binder } from './components/Binder';
import { Editor } from './components/Editor';
import { arrayMove } from '@dnd-kit/sortable';
import { Inspector } from './components/Inspector';
import { Corkboard } from './components/Corkboard';
import { Outliner } from './components/Outliner';
import { Scrivenings } from './components/Scrivenings';
import { CompositionMode } from './components/CompositionMode';
import { cn } from './lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';
import { MenuBar } from './components/MenuBar';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useStructuralFolders, getStructuralFolder } from './hooks/useStructuralFolders';
import { Auth } from './components/Auth';

const generateInitialDocs = (projectId: string): Partial<Doc>[] => {
  const manuscriptId = crypto.randomUUID();
  const charactersId = crypto.randomUUID();
  const placesId = crypto.randomUUID();
  const researchId = crypto.randomUUID();
  const trashId = crypto.randomUUID();

  const defaultMeta = { section_type: 'Heading', is_include_in_compile: false, created_at: Date.now(), updated_at: Date.now(), status: 'To Do', label: 'none', label_color: 'transparent', synopsis: '', notes: '', target_word_count: 0, keywords: [], custom_metadata: {}, snapshots: [], comments: [], bookmarks: [] };

  return [
    { id: manuscriptId, project_id: projectId, title: 'Manuscript', content: '', type: 'folder', parent_id: null, order: 0, folder_role: 'manuscript', metadata: { ...defaultMeta, is_include_in_compile: true } as DocumentMetadata },
    { id: charactersId, project_id: projectId, title: 'Characters', content: '', type: 'folder', parent_id: null, order: 1, folder_role: 'characters', metadata: { ...defaultMeta, folder_color: '#9B59B6' } as DocumentMetadata },
    { id: placesId, project_id: projectId, title: 'Places', content: '', type: 'folder', parent_id: null, order: 2, folder_role: 'places', metadata: { ...defaultMeta, folder_color: '#27AE60' } as DocumentMetadata },
    { id: researchId, project_id: projectId, title: 'Research', content: '', type: 'folder', parent_id: null, order: 3, folder_role: 'research', metadata: { ...defaultMeta, folder_color: '#3498DB' } as DocumentMetadata },
    { id: trashId, project_id: projectId, title: 'Trash', content: '', type: 'trash', parent_id: null, order: 4, folder_role: 'trash', metadata: { ...defaultMeta, folder_color: '#95A5A6' } as DocumentMetadata },
    { id: crypto.randomUUID(), project_id: projectId, title: 'Chapter 1', content: '', type: 'text', parent_id: manuscriptId, order: 0, metadata: { ...defaultMeta, section_type: 'Scene', is_include_in_compile: true } as DocumentMetadata },
    { id: crypto.randomUUID(), project_id: projectId, title: 'Character Sheet', content: '', type: 'characters', parent_id: charactersId, order: 0, metadata: { ...defaultMeta, section_type: 'Scene' } as DocumentMetadata },
    { id: crypto.randomUUID(), project_id: projectId, title: 'Location Sheet', content: '', type: 'places', parent_id: placesId, order: 0, metadata: { ...defaultMeta, section_type: 'Scene' } as DocumentMetadata },
    { id: crypto.randomUUID(), project_id: projectId, title: 'Notes', content: '', type: 'research', parent_id: researchId, order: 0, metadata: { ...defaultMeta, section_type: 'Scene' } as DocumentMetadata },
  ];
};

export default function App() {
  // Auth State
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Supabase Auth Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const project = useMemo(() => projects.find(p => p.id === activeProjectId) || projects[0] || null, [projects, activeProjectId]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isBinderOpen, setIsBinderOpen] = useState(true);
  const [isCompositionMode, setIsCompositionMode] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([]));
  const saveDocTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatesRef = React.useRef<Record<string, Partial<Doc> | any>>({});
  const [saveStatus, setSaveStatus] = useState<'saved' | 'pending' | 'error'>('saved');

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (saveDocTimerRef.current) {
        clearTimeout(saveDocTimerRef.current);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);
  
  // Panel Widths
  const [binderWidth, setBinderWidth] = useState(240);
  const [inspectorWidth, setInspectorWidth] = useState(280);
  const [zoom, setZoom] = useState(100);

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  // Split View State
  const [isSplit, setIsSplit] = useState(false);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  const handleExport = async (format: string) => {
    // 1. Filter documents marked for compile
    const compileDocs = docs
      .filter(d => d.type === 'text' && d.metadata.is_include_in_compile)
      .sort((a, b) => a.order - b.order);
    
    if (compileDocs.length === 0) {
      alert("No documents are marked for inclusion in compile. Please check 'Include in Compile' in the Inspector for the documents you want to export.");
      return;
    }

    const safeTitle = project?.name?.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'scribeflow';

    const downloadBlob = (blob: Blob, filename: string) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    try {
      if (format === 'txt') {
        const content = compileDocs.map(d => `${d.title.toUpperCase()}\n\n${d.content.replace(/<[^>]*>/g, '')}`).join('\n\n' + '='.repeat(40) + '\n\n');
        const blob = new Blob([content], { type: 'text/plain' });
        downloadBlob(blob, `${safeTitle}_export.txt`);
      } 
      else if (format === 'pdf') {
        const doc = new jsPDF();
        let yOffset = 20;
        
        doc.setFontSize(24);
        doc.text(project?.name || 'Manuscript', 105, yOffset, { align: 'center' });
        yOffset += 20;
        
        doc.setFontSize(12);
        
        compileDocs.forEach((d, index) => {
          if (index > 0) {
            doc.addPage();
            yOffset = 20;
          }
          
          doc.setFontSize(16);
          doc.setFont("times", "bold");
          doc.text(d.title, 20, yOffset);
          yOffset += 15;
          
          doc.setFontSize(12);
          doc.setFont("times", "normal");
          
          const cleanText = d.content.replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
          const lines = doc.splitTextToSize(cleanText, 170);
          
          for (let i = 0; i < lines.length; i++) {
            if (yOffset > 270) {
              doc.addPage();
              yOffset = 20;
            }
            doc.text(lines[i], 20, yOffset);
            yOffset += 7;
          }
        });
        
        doc.save(`${safeTitle}_export.pdf`);
      }
      else if (format === 'docx') {
        const children: Paragraph[] = [];
        
        // Title page
        children.push(new Paragraph({ text: project?.name || 'Manuscript', heading: HeadingLevel.TITLE, spacing: { after: 400 } }));
        
        compileDocs.forEach(d => {
          children.push(new Paragraph({ text: d.title, heading: HeadingLevel.HEADING_1, pageBreakBefore: true, spacing: { after: 200 } }));
          
          const cleanText = d.content.replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
          const paragraphs = cleanText.split('\n').filter((p: string) => p.trim());
          
          paragraphs.forEach((p: string) => {
            children.push(new Paragraph({
              children: [new TextRun(p)],
              spacing: { after: 120 }
            }));
          });
        });

        const docxDoc = new Document({ sections: [{ properties: {}, children }] });
        const blob = await Packer.toBlob(docxDoc);
        downloadBlob(blob, `${safeTitle}_export.docx`);
      }
      else if (format === 'rtf') {
        let rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\deflang1033{\\fonttbl{\\f0\\fnil\\fcharset0 Times New Roman;}}\n`;
        rtf += `{\\*\n\\title ${project?.name || 'Manuscript'}}\n`;
        rtf += `\\qc\\b\\fs48 ${project?.name || 'Manuscript'}\\par\\par\\b0\\fs24\\ql\n`;
        
        compileDocs.forEach(d => {
          rtf += `\\page\\b\\fs32 ${d.title}\\par\\b0\\fs24\\par\n`;
          const cleanText = d.content.replace(/<p[^>]*>/g, '').replace(/<\/p>/g, '\\par\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
          rtf += cleanText + `\\par\n`;
        });
        
        rtf += `}`;
        const blob = new Blob([rtf], { type: 'application/rtf' });
        downloadBlob(blob, `${safeTitle}_export.rtf`);
      }
      else if (format === 'epub') {
        alert("EPUB exporter is currently in development. Please use DOCX or PDF for right now.");
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert("Failed to export document.");
    }

    setIsExportOpen(false);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    alert('URL do projeto copiada para a área de transferência!');
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProjects([]);
      setActiveProjectId(null);
      setDocs([]);
      setSelectedDocId(null);
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  const handleSave = () => {
    setLastSaved(new Date());
    setShowSaveIndicator(true);
    setTimeout(() => setShowSaveIndicator(false), 2000);
  };

  const menus = [
    {
      label: 'File',
      items: [
        { label: 'New Text', shortcut: '⌘N', onClick: () => handleAddDoc(null, 'text') },
        { label: 'New Folder', shortcut: '⇧⌘N', onClick: () => handleAddDoc(null, 'folder') },
        { divider: true },
        { label: 'Save', shortcut: '⌘S', onClick: handleSave },
        { label: 'Export Draft...', shortcut: '⇧⌘E', onClick: () => setIsExportOpen(true) },
        { divider: true },
        { label: 'Print...', shortcut: '⌘P', onClick: () => window.print() },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: '⌘Z', onClick: () => console.log('Undo (handled by TipTap)') },
        { label: 'Redo', shortcut: '⇧⌘Z', onClick: () => console.log('Redo (handled by TipTap)') },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Editor', shortcut: '⌘1', onClick: () => setViewMode('editor') },
        { label: 'Corkboard', shortcut: '⌘2', onClick: () => setViewMode('corkboard') },
        { label: 'Outliner', shortcut: '⌘3', onClick: () => setViewMode('outliner') },
        { label: 'Scrivenings', shortcut: '⌘4', onClick: () => setViewMode('scrivenings') },
        { divider: true },
        { label: 'Toggle Binder', shortcut: '⌥⌘B', onClick: () => setIsBinderOpen(!isBinderOpen) },
        { label: 'Toggle Inspector', shortcut: '⌥⌘I', onClick: () => setIsInspectorOpen(!isInspectorOpen) },
        { divider: true },
        { label: 'Enter Composition Mode', shortcut: '⌥⌘F', onClick: () => setIsCompositionMode(true) },
      ]
    },
    {
      label: 'ScribeFlow',
      items: [
        { label: 'Sobre o ScribeFlow...', onClick: () => setIsAboutOpen(true) },
        { divider: true },
        { label: 'Sair do Sistema', onClick: handleLogout },
      ]
    },
    {
      label: 'Project',
      items: [
        { label: 'My Projects...', shortcut: '⌘P', onClick: () => setIsProjectsModalOpen(true) },
        { label: 'New Project...', shortcut: '⇧⌘P', onClick: () => handleCreateProject('New Project') },
        { divider: true },
        { label: 'Project Settings...', shortcut: '⌥⌘,', onClick: () => setIsSettingsOpen(true) },
        { divider: true },
        { label: 'New Character Sketch', onClick: () => handleAddDoc(null, 'characters') },
        { label: 'New Setting Sketch', onClick: () => handleAddDoc(null, 'places') },
      ]
    }
  ];

  const startResizingSplit = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const container = document.querySelector('.editor-split-container');
    if (!container) return;
    const containerWidth = container.getBoundingClientRect().width;
    const startRatio = splitRatio;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newRatio = Math.max(0.2, Math.min(0.8, startRatio + deltaX / containerWidth));
      setSplitRatio(newRatio);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Navigation History
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const navigateTo = (id: string | null) => {
    if (id === selectedDocId) return;
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(id || '');
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setSelectedDocId(id);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setSelectedDocId(history[newIndex] || null);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setSelectedDocId(history[newIndex] || null);
    }
  };

  // Resizing logic
  const startResizingBinder = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = binderWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(150, Math.min(400, startWidth + (moveEvent.clientX - startX)));
      setBinderWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const startResizingInspector = (e: React.MouseEvent) => {
    const startX = e.clientX;
    const startWidth = inspectorWidth;
    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(500, startWidth - (moveEvent.clientX - startX)));
      setInspectorWidth(newWidth);
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Supabase Data Sync
  useEffect(() => {
    if (!isAuthReady) return;

    if (user) {
      const fetchProjects = async () => {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('owner_id', user.id)
          .order('updated_at', { ascending: false });

        if (error) {
          console.error('[Supabase] Error fetching projects:', error.message);
        }

        if (data && data.length > 0) {
          setProjects(data as Project[]);
          if (!activeProjectId) {
            const lastProjectId = localStorage.getItem('scribeflow-last-project');
            const matchProject = data.find(p => p.id === lastProjectId);
            
            if (matchProject) {
              setActiveProjectId(matchProject.id);
            } else {
              setActiveProjectId(data[0].id);
              setIsProjectsModalOpen(true);
            }
          }
        } else if (!error) {
          console.log('[Supabase] No projects found, creating initial via RPC...');
          const userProjectId = crypto.randomUUID();
          const initialProject: Partial<Project> = { 
            id: userProjectId,
            name: "Meu Novo Livro",
            owner_id: user.id,
            settings: {
              target_word_count: 50000,
              session_target: 1000,
              deadline: null,
              composition_theme: 'sepia',
              theme: 'traditional',
              paper_width: 800,
              background_opacity: 0.9,
            }
          };
          
          await supabase.from('projects').insert(initialProject);
          const initialDocs = generateInitialDocs(userProjectId);
          await supabase.from('docs').insert(initialDocs);
          
          setProjects([initialProject as Project]);
          setActiveProjectId(userProjectId);
        }
      };

      fetchProjects();

      const projectsChannel = supabase.channel(`projects-list-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `owner_id=eq.${user.id}` }, 
          () => fetchProjects())
        .subscribe();

      return () => {
        projectsChannel.unsubscribe();
      };
    } else {
      setProjects([]);
    }
  }, [user, isAuthReady]); // Active project omission is acceptable since projectsChannel triggers data refresh, not setActiveProjectId reassignment unless it is null.

  // Sync docs for the active project
  useEffect(() => {
    if (!user || !activeProjectId) {
      setDocs([]);
      return;
    }

    const fetchDocs = async () => {
      const { data, error } = await supabase
        .from('docs')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('order', { ascending: true });

      if (error) {
        console.error('[Supabase] Error fetching docs:', error.message);
      }

      setDocs(data || [] as Doc[]);
    };

    fetchDocs();

    const docsChannel = supabase.channel(`docs-list-${activeProjectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: `project_id=eq.${activeProjectId}` }, 
        () => fetchDocs())
      .subscribe();

    return () => {
      docsChannel.unsubscribe();
    };
  }, [user, activeProjectId]);

  const { manuscript: manuscriptFolder, trash: trashFolder, characters: charactersFolder, places: placesFolder, research: researchFolder } = useStructuralFolders(docs);

  // Derived State
  const selectedDoc = useMemo(() => 
    docs.find(d => d.id === selectedDocId) || null
  , [docs, selectedDocId]);

  const currentFolderDocs = useMemo(() => {
    if (!selectedDoc) return [];
    const folderTypes: DocumentType[] = ['folder', 'research', 'characters', 'places', 'front-matter', 'trash'] as DocumentType[];
    if (folderTypes.includes(selectedDoc.type)) {
      return docs.filter(d => d.parent_id === selectedDoc.id).sort((a, b) => a.order - b.order);
    }
    return [selectedDoc];
  }, [docs, selectedDoc]);

  // Auth Handlers are now managed by Auth.tsx and top-level session check.
  // handleLogin is retired in favor of the specialized sanctuary gateway.



  /**
   * Zod Schemas for Data Validation (Security Hardening)
   */
  const projectSchema = z.object({
    title: z.string().min(1, "O título é obrigatório").max(200, "Título muito longo"),
  });

  const documentSchema = z.object({
    id: z.string().uuid(),
    title: z.string().min(1).max(200),
    type: z.enum(['text', 'folder', 'trash', 'characters', 'places', 'research'] as const),
    parent_id: z.string().uuid().nullable(),
    folder_role: z.string().nullable().optional(),
  });

  const updateDocumentSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    metadata: z.any().optional(), // Could be deeper but keeping partial context
  }).partial();

  // Handlers
  const handleAddDoc = async (parent_id: string | null, type: DocumentType) => {
    let final_parent_id = parent_id;
    if (!final_parent_id) {
      if (type === 'characters') final_parent_id = charactersFolder?.id || null;
      else if (type === 'places') final_parent_id = placesFolder?.id || null;
      else if (type === 'research') final_parent_id = researchFolder?.id || null;
      else if (type === 'text') final_parent_id = manuscriptFolder?.id || null;
    }

    const newId = crypto.randomUUID();
    const newDoc: Doc = {
      id: newId,
      title: type === 'folder' ? 'New Folder' : 
             type === 'characters' ? 'New Character' : 
             type === 'places' ? 'New Setting' : 'New Document',
      content: '',
      type,
      parent_id: final_parent_id,
      order: docs.filter(d => d.parent_id === final_parent_id).length,
      metadata: {
        status: 'To Do',
        label: 'none',
        label_color: 'transparent',
        synopsis: '',
        notes: '',
        target_word_count: 0,
        is_include_in_compile: true,
        section_type: type === 'folder' ? 'Heading' : 'Scene',
        created_at: Date.now(),
        updated_at: Date.now(),
        keywords: [],
        custom_metadata: {},
        snapshots: [],
        comments: [],
        bookmarks: [],
      },
    };

    // Validate using Zod
    try {
      documentSchema.parse({
        id: newDoc.id,
        title: newDoc.title,
        type: newDoc.type,
        parent_id: newDoc.parent_id,
        folder_role: newDoc.folder_role
      });
    } catch (err) {
      console.error('Zod Validation Error (Add Doc):', err);
      return;
    }

    if (user && activeProjectId) {
      try {
        const docWithProjectId = { ...newDoc, project_id: activeProjectId };
        await supabase.from('docs').insert(docWithProjectId);
      } catch (e) {
        console.error('Error adding doc:', e);
      }
    } else if (!user) {
      setDocs([...docs, newDoc]);
    }
    
    setSelectedDocId(newDoc.id);
    if (parent_id) {
      const newExpanded = new Set(expandedFolders);
      newExpanded.add(parent_id);
      setExpandedFolders(newExpanded);
    }
  };

  const getAllChildrenIds = (folderId: string, currentDocs: Doc[]): string[] => {
    const childrenIds = currentDocs.filter(d => d.parent_id === folderId).map(d => d.id);
    let allIds = [...childrenIds];
    childrenIds.forEach(childId => {
      allIds = [...allIds, ...getAllChildrenIds(childId, currentDocs)];
    });
    return allIds;
  };

  const handleDeleteDoc = async (id: string) => {
    const targetDoc = docs.find(d => d.id === id);
    if (!targetDoc || targetDoc.folder_role) return; // Cannot delete structural folders
    
    let isInTrash = targetDoc.parent_id === trashFolder?.id;
    let parent = docs.find(d => d.id === targetDoc.parent_id);
    while (!isInTrash && parent) {
      if (parent.id === trashFolder?.id) isInTrash = true;
      parent = docs.find(d => d.id === parent?.parent_id);
    }

    if (isInTrash) {
      if (window.confirm('Tem certeza de que deseja excluir permanentemente este item? Esta ação não pode ser desfeita.')) {
        const idsToDelete = [id, ...getAllChildrenIds(id, docs)];
        if (user && activeProjectId) {
          try {
            await supabase.from('docs').delete().in('id', idsToDelete);
          } catch(e) { console.error('Delete error', e); }
        }
        setDocs(curr => curr.filter(d => !idsToDelete.includes(d.id)));
        if (idsToDelete.includes(selectedDocId || '')) setSelectedDocId(null);
      }
    } else if (trashFolder) {
      const updatedMetadata = targetDoc.metadata.is_include_in_compile
        ? { ...targetDoc.metadata, is_include_in_compile: false }
        : targetDoc.metadata;
      if (user && activeProjectId) {
        await supabase.from('docs').update({ parent_id: trashFolder.id, metadata: updatedMetadata }).eq('id', id);
        if (targetDoc.type === 'folder') {
          const childIds = getAllChildrenIds(id, docs);
          if (childIds.length > 0) {
            await supabase.from('docs').update({ parent_id: trashFolder.id }).in('id', childIds);
          }
        }
      }
      setDocs(curr => curr.map(d => {
        if (d.id === id) return { ...d, parent_id: trashFolder.id, metadata: updatedMetadata };
        if (targetDoc.type === 'folder' && getAllChildrenIds(id, docs).includes(d.id)) return { ...d, parent_id: trashFolder.id };
        return d;
      }));
      if (selectedDocId === id) setSelectedDocId(null);
    }
  };

  const handleEmptyTrash = async () => {
    if (!trashFolder) return;
    const itemsInTrash = docs.filter(d => d.parent_id === trashFolder.id);
    if (itemsInTrash.length === 0) return;
    
    if (window.confirm('Tem certeza de que deseja ESVAZIAR A LIXEIRA? Esta ação não pode ser desfeita e deletará todos os documentos dentro da lixeira.')) {
      let idsToDelete: string[] = [];
      itemsInTrash.forEach(item => {
        idsToDelete.push(item.id);
        idsToDelete = [...idsToDelete, ...getAllChildrenIds(item.id, docs)];
      });
      
      if (user && activeProjectId && idsToDelete.length > 0) {
        try {
          await supabase.from('docs').delete().in('id', idsToDelete);
        } catch(e) { console.error('Empty trash error', e); }
      }
      setDocs(curr => curr.filter(d => !idsToDelete.includes(d.id)));
      if (idsToDelete.includes(selectedDocId || '')) setSelectedDocId(null);
    }
  };

  const handleCreateProject = async (name: string) => {
    if (!user) return;
    
    // Validate Project Title
    try {
      projectSchema.parse({ title: name });
    } catch (err: unknown) {
      const errorMessage = err instanceof z.ZodError 
        ? err.issues[0]?.message 
        : "Erro de validação";
      alert(errorMessage);
      return;
    }

    const newProjectId = crypto.randomUUID();
    
    const { data: insertedData, error } = await supabase.from('projects').insert({
      id: newProjectId,
      name,
      owner_id: user.id,
      settings: {
        target_word_count: 50000,
        session_target: 1000,
        deadline: null,
        composition_theme: 'sepia',
        theme: 'traditional',
        paper_width: 800,
        background_opacity: 0.9,
      }
    }).select();

    if (!error && insertedData && insertedData.length > 0) {
      const createdProject = insertedData[0] as Project;
      setProjects([createdProject, ...projects]);
      try {
        const initialDocs = generateInitialDocs(newProjectId);
        await supabase.from('docs').insert(initialDocs);
        
        setActiveProjectId(newProjectId);
        localStorage.setItem('scribeflow-last-project', newProjectId);
      } catch (e) {
        console.error('Failed to initialize project docs', e);
        // Fallback to active project even if docs fail
        setActiveProjectId(newProjectId);
      }
    } else {
      console.error('[Supabase] Error creating project:', error);
      alert('Failed to create project. Error: ' + (error?.message || 'Unknown response'));
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!user || projects.length <= 1) return;
    
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (!error) {
      const remainingProjects = projects.filter(p => p.id !== id);
      setProjects(remainingProjects);
      if (activeProjectId === id) {
        setActiveProjectId(remainingProjects[0].id);
      }
    }
  };

  const handleSwitchProject = (id: string) => {
    setActiveProjectId(id);
    setSelectedDocId(null); // Reset selection
    localStorage.setItem('scribeflow-last-project', id);
  };

  const handleMoveDoc = async (docId: string, newParentId: string) => {
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;
    
    // Prevenir mover pasta para dentro de si mesma ou de seus filhos
    if (doc.type === 'folder') {
      const childIds = getAllChildrenIds(docId, docs);
      if (childIds.includes(newParentId) || docId === newParentId) return;
    }

    const newOrder = docs.filter(d => d.parent_id === newParentId).length;
    
    if (user && activeProjectId) {
      await supabase.from('docs').update({ parent_id: newParentId, order: newOrder }).eq('id', docId);
    }
    
    setDocs(curr => curr.map(d => d.id === docId 
      ? { ...d, parent_id: newParentId, order: newOrder } 
      : d
    ));
  };

  const debouncedSaveDoc = React.useCallback((id: string, updates: any) => {
    setSaveStatus('pending');
    
    pendingUpdatesRef.current[id] = {
      ...(pendingUpdatesRef.current[id] || {}),
      ...updates
    };

    if (saveDocTimerRef.current) clearTimeout(saveDocTimerRef.current);
    saveDocTimerRef.current = setTimeout(async () => {
      const docsToSave = { ...pendingUpdatesRef.current };
      pendingUpdatesRef.current = {};
      
      let allSuccess = true;
      for (const [docId, mergedUpdates] of Object.entries(docsToSave)) {
         try {
           await supabase.from('docs').update({ ...mergedUpdates, updated_at: Date.now() }).eq('id', docId).eq('project_id', activeProjectId);
         } catch (e) {
           allSuccess = false;
           console.error("Debounced save error:", e);
         }
      }
      setSaveStatus(allSuccess ? 'saved' : 'error');
      saveDocTimerRef.current = null;
    }, 1500);
  }, [activeProjectId]);

  const handleUpdateDoc = async (id: string, updates: Partial<Doc>) => {
    // Validate Updates
    try {
      updateDocumentSchema.parse(updates);
    } catch (err) {
      console.error('Zod Validation Error (Update Doc):', err);
      return;
    }

    const updated_at = Date.now();
    setDocs(curr => curr.map(d => d.id === id ? { ...d, ...updates, updated_at } : d));

    if (user && activeProjectId) {
      debouncedSaveDoc(id, updates);
    }
  };

  // Global Editor instance for shared focus mode (Hardening/Refactor)
  const globalEditor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
      ParagraphFocus,
    ],
    onUpdate: ({ editor }) => {
      if (selectedDoc) {
        handleUpdateDoc(selectedDoc.id, { content: editor.getHTML() });
      }
    },
  });

  // Sync Global Editor with Selected Doc
  useEffect(() => {
    if (globalEditor && selectedDoc && selectedDoc.type !== 'folder') {
      const currentContent = globalEditor.getHTML();
      if (selectedDoc.content !== currentContent) {
        globalEditor.commands.setContent(selectedDoc.content);
      }
    }
  }, [selectedDoc?.id, globalEditor]);

  // Global Shortcuts (Composition Mode, etc.)
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      // F11 or Cmd+Shift+F
      if (e.key === 'F11' || (e.key === 'f' && e.shiftKey && (e.metaKey || e.ctrlKey))) {
        if (selectedDoc && selectedDoc.type === 'text') {
          e.preventDefault();
          setIsCompositionMode(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  }, [selectedDoc]);

  const handleUpdateMetadata = async (id: string, metadata_updates: Partial<DocumentMetadata>) => {
    const updated_at = Date.now();
    let newMetadata: DocumentMetadata | null = null;
    setDocs(curr => {
      const updatedDocs = curr.map(d => {
        if (d.id === id) {
          const m = { ...d.metadata, ...metadata_updates, updated_at };
          newMetadata = m;
          return { ...d, metadata: m, updated_at };
        }
        return d;
      });
      return updatedDocs;
    });

    if (user && activeProjectId && newMetadata) {
      debouncedSaveDoc(id, { metadata: newMetadata });
    }
  };

  const toggleFolder = (id: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
  };

  const handleRenameDoc = (id: string, newTitle: string) => {
    handleUpdateDoc(id, { title: newTitle });
  };

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, id });
  };

  const closeContextMenu = () => setContextMenu(null);

  useEffect(() => {
    window.addEventListener('click', closeContextMenu);
    return () => window.removeEventListener('click', closeContextMenu);
  }, []);

  const handleReorderDocs = (activeId: string, overId: string) => {
    const activeDoc = docs.find(d => d.id === activeId);
    const overDoc = docs.find(d => d.id === overId);

    if (!activeDoc || !overDoc || activeDoc.parent_id !== overDoc.parent_id) return;

    const sameLevelDocs = docs
      .filter(d => d.parent_id === activeDoc.parent_id)
      .sort((a, b) => a.order - b.order);

    const oldIndex = sameLevelDocs.findIndex(d => d.id === activeId);
    const newIndex = sameLevelDocs.findIndex(d => d.id === overId);

    const reorderedLevel = arrayMove(sameLevelDocs, oldIndex, newIndex);

    const updatedDocs = docs.map(d => {
      const reorderedIndex = reorderedLevel.findIndex(rd => rd.id === d.id);
      if (reorderedIndex !== -1) {
        return { ...d, order: reorderedIndex };
      }
      return d;
    });

    setDocs(updatedDocs);
  };

  // 1. Initial Auth Loading
  if (!isAuthReady) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#121212]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-gray-400 font-serif italic tracking-wide">Invocando seu santuário...</p>
        </div>
      </div>
    );
  }

  // 2. Redirect to Login if no Session
  if (!user) {
    return <Auth />;
  }

  // 3. Optional: Initial Workspace Loading (if user is authenticated but project metadata is still pending)
  if (projects.length === 0) {
    // If user has no projects, the projects sync will eventually create one
    // or the projects modal can be forced open. 
    // We show a minimal valid shell rather than a full blocker if possible
    // but a loader is fine while first project is being created by syncProjects effect
    return (
      <div className="flex h-screen items-center justify-center bg-[#121212]">
        <div className="flex flex-col items-center gap-4 text-center p-8">
          <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-2">
            <BookOpen className="text-blue-500 w-8 h-8 animate-pulse" />
          </div>
          <h2 className="text-white text-lg font-serif italic">Preparando seu primeiro manuscrito...</h2>
          <p className="text-gray-500 text-sm max-w-xs">Isso deve levar apenas um momento.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-screen bg-surface-background overflow-hidden font-sans text-on-surface select-none",
      (project?.settings?.theme || 'traditional') === 'dark' && "dark-theme"
    )}>
      {/* macOS Menu Bar */}
      <MenuBar menus={menus} />

      <AnimatePresence>
        {showSaveIndicator && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-8 right-8 bg-[#5B7A3D] text-white px-4 py-2 rounded-lg shadow-lg z-[10000] text-xs font-bold flex items-center gap-2"
          >
            <Save size={14} />
            Project Saved
          </motion.div>
        )}
      </AnimatePresence>

      {/* macOS Toolbar */}
      <header className="macos-toolbar">
        {/* Binder Toggle */}
        <button 
          onClick={() => setIsBinderOpen(!isBinderOpen)}
          className={cn("toolbar-btn-binder-toggle", isBinderOpen && "bg-black/10")}
          title="Toggle Binder"
        >
          <Layout size={18} />
        </button>

        <div className="toolbar-sep" />

        {/* Navigation History */}
        <div className="toolbar-nav-group">
          <button 
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="toolbar-nav-btn"
          >
            <ChevronLeft size={18} />
          </button>
          <button 
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="toolbar-nav-btn"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <div className="toolbar-sep" />

        {/* View Mode Segmented Control */}
        <div className="toolbar-view-group">
          <button 
            onClick={() => setViewMode('editor')}
            className={cn("toolbar-view-btn", viewMode === 'editor' && "active")}
            title="Document Mode"
          >
            <FileText size={14} />
          </button>
          <button 
            onClick={() => setViewMode('corkboard')}
            className={cn("toolbar-view-btn", viewMode === 'corkboard' && "active")}
            title="Corkboard Mode"
          >
            <Grid size={14} />
          </button>
          <button 
            onClick={() => setViewMode('outliner')}
            className={cn("toolbar-view-btn", viewMode === 'outliner' && "active")}
            title="Outliner Mode"
          >
            <Columns size={14} />
          </button>
          <button 
            onClick={() => setViewMode('scrivenings')}
            className={cn("toolbar-view-btn", viewMode === 'scrivenings' && "active")}
            title="Scrivenings Mode"
          >
            <PenTool size={14} />
          </button>
        </div>

        <button 
          onClick={() => setIsSplit(!isSplit)}
          className={cn("macos-btn", isSplit && "bg-black/10")}
          title="Toggle Split View"
        >
          <Columns size={16} />
        </button>

        <div className="toolbar-sep" />

        <div className="toolbar-spacer" />

        {/* Search Field */}
        <div className="relative flex items-center">
          <input 
            type="text" 
            placeholder="Search Project" 
            className="toolbar-search"
          />
          <Search size={12} className="absolute left-2 text-[#8A877F]" />
        </div>

        <div className="toolbar-spacer" />

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={() => setIsCompositionMode(true)}
            className="composition-btn mr-2 flex items-center gap-1.5"
          >
            <PenTool size={14} />
            Compose
          </button>
          
          <button onClick={() => setIsExportOpen(true)} className="macos-btn" title="Export Manuscript">
            <Download size={16} />
          </button>
          
          <button onClick={() => setIsSettingsOpen(true)} className="macos-btn" title="Project Settings">
            <Settings size={16} />
          </button>

          <div className="toolbar-sep" />

          <button 
            onClick={() => setIsInspectorOpen(!isInspectorOpen)}
            className={cn("macos-btn", isInspectorOpen && "bg-black/10")}
            title="Toggle Inspector"
          >
            <Info size={16} />
          </button>

          {user && (
            <button onClick={handleLogout} className="macos-btn" title={`Signed in as ${user.user_metadata?.full_name || user.email}`}>
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={16} />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden relative">
        {/* Binder Sidebar */}
        {isBinderOpen && (
          <div style={{ width: binderWidth }} className="flex shrink-0">
            <Binder 
              docs={docs}
              activeProjectId={activeProjectId}
              projectName={project?.name || 'Projeto sem nome'}
              onOpenProjects={() => setIsProjectsModalOpen(true)}
              selectedDocId={selectedDocId}
              onSelectDoc={navigateTo}
              onAddDoc={handleAddDoc}
              onUpdateDoc={handleUpdateDoc}
              onDeleteDoc={handleDeleteDoc}
              onRenameDoc={handleRenameDoc}
              onReorderDocs={handleReorderDocs}
              onMoveDoc={handleMoveDoc}
              onToggleFolder={toggleFolder}
              expandedFolders={expandedFolders}
              onContextMenu={handleContextMenu}
              renamingId={renamingId}
              onRenameComplete={() => setRenamingId(null)}
            />
            <div 
              onMouseDown={startResizingBinder}
              className="splitter"
            />
          </div>
        )}

        {/* Center Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#F0EDE7]">
          <div className="editor-split-container">
            {/* Main Pane */}
            <div 
              className="editor-pane"
              style={{ flex: isSplit ? splitRatio : 1 }}
            >
              {selectedDoc ? (
                <>
                  {viewMode === 'editor' && (
                    selectedDoc.type === 'folder' || selectedDoc.type === 'research' ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-on-surface-variant">
                        <Folder size={80} className="mb-6 opacity-10" />
                        <h3 className="text-3xl font-serif italic mb-3 text-primary">{selectedDoc.title}</h3>
                        <p className="max-w-md text-sm leading-relaxed opacity-70">This is a folder. Switch to Corkboard or Outliner view to see its contents, or select a document inside it to start writing.</p>
                      </div>
                    ) : (
                      <Editor 
                        content={selectedDoc.content}
                        onChange={(content) => handleUpdateDoc(selectedDoc.id, { content })}
                        title={selectedDoc.title}
                        onTitleChange={(title) => handleUpdateDoc(selectedDoc.id, { title })}
                        onSubtitleChange={(subtitle) => handleUpdateMetadata(selectedDoc.id, { subtitle })}
                        doc={selectedDoc}
                        zoom={zoom}
                        onZoomChange={setZoom}
                        externalEditor={globalEditor}
                      />
                    )
                  )}
                  {viewMode === 'scrivenings' && (
                    <Scrivenings docs={currentFolderDocs} />
                  )}
                  {viewMode === 'corkboard' && (
                    <Corkboard 
                      docs={currentFolderDocs}
                      onSelectDoc={navigateTo}
                      onUpdateSynopsis={(id, synopsis) => handleUpdateMetadata(id, { synopsis })}
                    />
                  )}
                  {viewMode === 'outliner' && (
                    <Outliner 
                      docs={currentFolderDocs}
                      onSelectDoc={navigateTo}
                      onUpdateMetadata={handleUpdateMetadata}
                    />
                  )}
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-on-surface-variant">
                  <BookOpen size={80} className="mb-6 opacity-10" />
                  <h3 className="text-4xl font-serif italic mb-4 text-primary">Welcome to ScribeFlow</h3>
                  <p className="max-w-md text-sm leading-relaxed opacity-70">Select a document from the binder to begin writing, or create a new one to start your next masterpiece.</p>
                </div>
              )}
            </div>

            {/* Split Pane (Corkboard by default when split) */}
            {isSplit && (
              <>
                <div 
                  className="editor-splitter" 
                  onMouseDown={startResizingSplit}
                />
                <div 
                  className="editor-pane"
                  style={{ flex: 1 - splitRatio }}
                >
                  <Corkboard 
                    docs={currentFolderDocs}
                    onSelectDoc={navigateTo}
                    onUpdateSynopsis={(id, synopsis) => handleUpdateMetadata(id, { synopsis })}
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Inspector Sidebar */}
        {isInspectorOpen && (
          <div style={{ width: inspectorWidth }} className="flex shrink-0">
            {/* Splitter */}
            <div 
              onMouseDown={startResizingInspector}
              className="splitter"
            />
            <Inspector 
              doc={selectedDoc}
              onUpdateMetadata={handleUpdateMetadata}
            />
          </div>
        )}
      </main>

      {/* Composition Mode Overlay */}
      <AnimatePresence>
        {isCompositionMode && selectedDoc && selectedDoc.type === 'text' && (
          <CompositionMode 
            key="compose-mode"
            editor={globalEditor}
            title={selectedDoc.title}
            onExit={() => setIsCompositionMode(false)}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={project?.settings || { target_word_count: 50000, session_target: 1000, deadline: null, composition_theme: 'sepia', theme: 'traditional', paper_width: 800, background_opacity: 0.9 }}
        onUpdateSettings={async (settings) => {
          if (!project) return;
          const updatedSettings = { ...project.settings, ...settings };
          setProjects(prev => prev.map(p => p.id === project.id ? { ...p, settings: updatedSettings } : p));
          if (user) {
            await supabase.from('projects').update({ settings: updatedSettings }).eq('id', project.id);
          }
        }}
      />
      <ExportModal 
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        onExport={handleExport}
      />

      <ProjectsModal
        isOpen={isProjectsModalOpen}
        onClose={() => setIsProjectsModalOpen(false)}
        projects={projects}
        activeProjectId={activeProjectId}
        onSelect={(id) => {
          handleSwitchProject(id);
          setIsProjectsModalOpen(false);
        }}
        onCreate={(name) => {
          handleCreateProject(name);
          setIsProjectsModalOpen(false);
        }}
        onDelete={handleDeleteProject}
      />

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => handleAddDoc(contextMenu.id, 'text')}>
            <div className="context-menu-icon"><File size={14} /></div>
            New Text
            <span className="context-menu-shortcut">⌘N</span>
          </div>
          <div className="context-menu-item" onClick={() => handleAddDoc(contextMenu.id, 'folder')}>
            <div className="context-menu-icon"><Folder size={14} /></div>
            New Folder
            <span className="context-menu-shortcut">⇧⌘N</span>
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { setRenamingId(contextMenu.id); setContextMenu(null); }}>
            <div className="context-menu-icon"><Edit3 size={14} /></div>
            Rename
            <span className="context-menu-shortcut">↩</span>
          </div>
          {contextMenu && contextMenu.id === trashFolder?.id ? (
            <div className="context-menu-item" onClick={() => { handleEmptyTrash(); setContextMenu(null); }} style={{ color: '#E74C3C' }}>
              <div className="context-menu-icon"><Trash2 size={14} /></div>
              Esvaziar Lixeira
            </div>
          ) : contextMenu.id !== trashFolder?.id && (
            <div className="context-menu-item" onClick={() => { handleDeleteDoc(contextMenu.id); setContextMenu(null); }}>
              <div className="context-menu-icon"><Trash2 size={14} /></div>
              {docs.find(d => d.id === contextMenu.id)?.parent_id === trashFolder?.id ? 'Deletar Permanentemente' : 'Move to Trash'}
              <span className="context-menu-shortcut">⌘⌫</span>
            </div>
          )}
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { handleShare(); setContextMenu(null); }}>
            <div className="context-menu-icon"><Share size={14} /></div>
            Compartilhar Link
          </div>
          {contextMenu && docs.find(d => d.id === contextMenu.id)?.type === 'folder' && (
            <>
              <div className="context-menu-separator" />
              <div className="px-3 py-1 text-xs text-gray-500 font-bold tracking-wide">Alterar Cor</div>
              <div className="flex gap-2 px-3 py-2 flex-wrap w-40">
                {['#E74C3C', '#E67E22', '#F1C40F', '#27AE60', '#3498DB', '#9B59B6', '#95A5A6', '#1ABC9C', 'transparent'].map(color => (
                  <div
                    key={color}
                    onClick={() => {
                        (async () => {
                          const targetId = contextMenu.id;
                          const folder_color = color === 'transparent' ? undefined : color;
                          const targetDoc = docs.find(d => d.id === targetId);
                          if (!targetDoc) return;
                          
                          const newMetadata = { ...targetDoc.metadata, folder_color, updated_at: Date.now() };
                          
                          if (user && activeProjectId) {
                            await supabase.from('docs').update({ metadata: newMetadata }).eq('id', targetId);
                          }
                          
                          setDocs(curr => curr.map(d => d.id === targetId ? { ...d, metadata: newMetadata } : d));
                          setContextMenu(null);
                        })();
                    }}
                    className="w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-sm"
                    style={{ 
                      backgroundColor: color === 'transparent' ? '#efefef' : color,
                      border: color === 'transparent' ? '1px dashed #999' : 'none'
                    }}
                    title={color === 'transparent' ? 'Padrão' : undefined}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Global Footer */}
      <footer className="h-[22px] bg-gradient-to-b from-[#E0DDD5] to-[#D5D2CA] border-t border-[#B5B2AA] flex items-center justify-between px-3 text-[10px] font-mono tracking-wider text-[#6A6760] uppercase">
        <div className="flex items-center">
          <span className="opacity-70">PROJECT: <span className="font-bold text-[#436127]">{project?.name || 'Loading...'}</span></span>
          <div className="w-[1px] h-3 bg-[#C0BDB5] mx-3" />
          <span className="opacity-70">WORDS: <span className="font-bold text-[#436127]">{docs.reduce((acc, doc) => acc + (doc.content?.replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length || 0), 0)}</span></span>
        </div>
        <div className="flex items-center">
          <span className="opacity-70">{selectedDoc ? `SELECTED: ${selectedDoc.title}` : 'NO SELECTION'}</span>
          <div className="w-[1px] h-3 bg-[#C0BDB5] mx-3" />
          <div className="flex items-center gap-2">
            <div className={cn(
              "w-[7px] h-[7px] rounded-full shadow-[0_0_4px_currentColor]", 
              !user ? "bg-[#755a24] text-[#755a24]" : 
              saveStatus === 'pending' ? "bg-amber-400 text-amber-400 animate-pulse" : 
              saveStatus === 'error' ? "bg-red-500 text-red-500" : 
              "bg-[#5B7A3D] text-[#5B7A3D]"
            )} />
            <span className="font-bold">{!user ? 'LOCAL STORAGE ACTIVE' : saveStatus === 'pending' ? 'SAVING...' : saveStatus === 'error' ? 'SYNC ERROR' : 'CLOUD SYNC ACTIVE'}</span>
          </div>
        </div>
      </footer>

      {/* About Modal */}
      <AnimatePresence>
        {isAboutOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md" onClick={() => setIsAboutOpen(false)}>
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#1A1A1A] border border-[#333] rounded-2xl shadow-2xl p-10 max-w-md w-full relative overflow-hidden text-center"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 to-emerald-600" />
              <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-600/20">
                <PenTool className="text-white w-10 h-10" />
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight mb-2">ScribeFlow</h2>
              <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-6">Versão 2.1.0-AoR</p>
              
              <div className="space-y-4 text-gray-400 text-sm font-serif italic leading-relaxed">
                <p>"O que criamos é o que nos tornamos."</p>
                <p>O ScribeFlow é o seu santuário transcendental para a criação e organização intelectual.</p>
              </div>

              <div className="mt-10 pt-8 border-t border-[#333] flex flex-col gap-3">
                <a 
                  href="https://github.com/luksjfernandes-ctrl/scribeflow" 
                  target="_blank" 
                  className="bg-[#333] hover:bg-[#444] text-white py-3 rounded-xl transition-all flex items-center justify-center gap-2 font-bold text-sm"
                >
                  Ver no GitHub
                </a>
                <button 
                  onClick={() => setIsAboutOpen(false)}
                  className="text-gray-500 hover:text-white py-2 transition-colors text-xs font-medium"
                >
                  Fechar Santuário
                </button>
              </div>
              <p className="mt-8 text-[9px] uppercase tracking-widest text-gray-600 font-bold">Built with Supabase + React</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
