/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { INITIAL_PROJECT, INITIAL_DOCS } from './constants';
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
  const [selectedDocId, setSelectedDocId] = useState<string | null>(INITIAL_DOCS[0].id);
  const [viewMode, setViewMode] = useState<ViewMode>('editor');
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isBinderOpen, setIsBinderOpen] = useState(true);
  const [isCompositionMode, setIsCompositionMode] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['manuscript', 'part1', 'characters', 'places', 'research', 'front-matter']));
  
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

  const handleExport = (format: string) => {
    // 1. Filter documents marked for compile
    const compileDocs = docs
      .filter(d => d.type === 'text' && d.metadata.is_include_in_compile)
      .sort((a, b) => a.order - b.order);
    
    if (compileDocs.length === 0) {
      alert("No documents are marked for inclusion in compile. Please check 'Include in Compile' in the Inspector for the documents you want to export.");
      return;
    }

    let content = '';
    let mimeType = 'text/plain';
    let extension = '.txt';

    switch (format) {
      case 'txt':
        content = compileDocs.map(d => `${d.title.toUpperCase()}\n\n${d.content.replace(/<[^>]*>/g, '')}`).join('\n\n' + '='.repeat(40) + '\n\n');
        mimeType = 'text/plain';
        extension = '.txt';
        break;
      case 'pdf':
      case 'docx':
      case 'rtf':
      case 'epub':
        // For these formats in a client-side only app without heavy libraries, 
        // we'll export as HTML which can be opened/converted easily.
        // In a real production app, we'd use libraries like jspdf or docx.js
        content = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>${project.name}</title>
            <style>
              body { font-family: "Palatino", "Georgia", serif; line-height: 1.6; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
              h1 { text-align: center; margin-bottom: 50px; text-transform: uppercase; letter-spacing: 2px; }
              h2 { margin-top: 40px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
              .chapter { page-break-after: always; }
              .metadata { font-size: 0.8em; color: #666; text-align: center; margin-bottom: 100px; }
            </style>
          </head>
          <body>
            <h1>${project.name}</h1>
            <div class="metadata">Compiled on ${new Date().toLocaleDateString()}</div>
            ${compileDocs.map(d => `
              <div class="chapter">
                <h2>${d.title}</h2>
                <div>${d.content}</div>
              </div>
            `).join('')}
          </body>
          </html>
        `;
        mimeType = 'text/html';
        extension = '.html';
        break;
      default:
        content = compileDocs.map(d => d.content).join('\n\n');
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${project.name.replace(/\s+/g, '_')}_export${extension}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setIsExportOpen(false);
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
        { label: 'Page Setup...', onClick: () => console.log('Page Setup') },
        { label: 'Print...', shortcut: '⌘P', onClick: () => window.print() },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: '⌘Z', onClick: () => console.log('Undo') },
        { label: 'Redo', shortcut: '⇧⌘Z', onClick: () => console.log('Redo') },
        { divider: true },
        { label: 'Cut', shortcut: '⌘X', onClick: () => document.execCommand('cut') },
        { label: 'Copy', shortcut: '⌘C', onClick: () => document.execCommand('copy') },
        { label: 'Paste', shortcut: '⌘V', onClick: () => document.execCommand('paste') },
        { divider: true },
        { label: 'Select All', shortcut: '⌘A', onClick: () => document.execCommand('selectAll') },
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
      label: 'Project',
      items: [
        { label: 'My Projects...', shortcut: '⌘P', onClick: () => setIsProjectsModalOpen(true) },
        { label: 'New Project...', shortcut: '⇧⌘P', onClick: () => handleCreateProject('New Project') },
        { divider: true },
        { label: 'Project Settings...', shortcut: '⌥⌘,', onClick: () => setIsSettingsOpen(true) },
        { label: 'Project Statistics', shortcut: '⌥⌘S', onClick: () => console.log('Stats') },
        { divider: true },
        { label: 'New Character Sketch', onClick: () => handleAddDoc(null, 'characters') },
        { label: 'New Setting Sketch', onClick: () => handleAddDoc(null, 'places') },
      ]
    },
    {
      label: 'Format',
      items: [
        { label: 'Font...', shortcut: '⌘T', onClick: () => console.log('Font') },
        { label: 'Bold', shortcut: '⌘B', onClick: () => console.log('Bold') },
        { label: 'Italic', shortcut: '⌘I', onClick: () => console.log('Italic') },
        { label: 'Underline', shortcut: '⌘U', onClick: () => console.log('Underline') },
        { divider: true },
        { label: 'Alignment', onClick: () => console.log('Align') },
        { label: 'Line Spacing', onClick: () => console.log('Spacing') },
      ]
    },
    {
      label: 'Window',
      items: [
        { label: 'Minimize', shortcut: '⌘M', onClick: () => console.log('Minimize') },
        { label: 'Zoom', onClick: () => console.log('Zoom') },
        { divider: true },
        { label: 'Bring All to Front', onClick: () => console.log('Front') },
      ]
    },
    {
      label: 'Help',
      items: [
        { label: 'Search', shortcut: '⇧⌘/', onClick: () => console.log('Help Search') },
        { divider: true },
        { label: 'ScribeFlow Help', onClick: () => console.log('Help') },
        { label: 'Tutorial', onClick: () => console.log('Tutorial') },
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
      // Fetch all user projects
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
          // Default to the most recently updated project if none selected
          if (!activeProjectId) {
            setActiveProjectId(data[0].id);
          }
        } else if (!error) {
          // Initialize first project if none exist
          console.log('[Supabase] No projects found, creating initial one...');
          const userProjectId = `project-${user.id}-${Date.now()}`;
          const initialProject = { ...INITIAL_PROJECT, owner_id: user.id, id: userProjectId };
          const { error: insertError } = await supabase.from('projects').insert(initialProject);
          if (insertError) {
            console.error('[Supabase] Error creating initial project:', insertError.message);
          } else {
            setProjects([initialProject]);
            setActiveProjectId(userProjectId);
          }
        }
      };

      fetchProjects();

      // Subscription for projects list
      const projectsChannel = supabase.channel(`projects-list-${user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `owner_id=eq.${user.id}` }, 
          () => fetchProjects())
        .subscribe();

      return () => {
        projectsChannel.unsubscribe();
      };
    } else {
      // Fallback to LocalStorage when not logged in
      const savedProject = localStorage.getItem('scribeflow-project');
      const savedDocs = localStorage.getItem('scribeflow-docs');
      
      if (savedProject) {
        try {
          const p = JSON.parse(savedProject);
          // Merging with INITIAL_PROJECT to ensure settings and other fields exist
          const validatedProject = { 
            ...INITIAL_PROJECT, 
            ...p, 
            settings: { ...INITIAL_PROJECT.settings, ...(p.settings || {}) } 
          };
          setProjects([validatedProject]);
          setActiveProjectId(validatedProject.id);
        } catch (e) {
          console.error('[LocalStorage] Error parsing project:', e);
        }
      }
      
      if (savedDocs) {
        try {
          setDocs(JSON.parse(savedDocs));
        } catch (e) {}
      }
    }
  }, [user, isAuthReady]);

  // Sync docs for the active project
  useEffect(() => {
    if (!user || !activeProjectId) return;

    const fetchDocs = async () => {
      const { data, error } = await supabase
        .from('docs')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('order', { ascending: true });

      if (error) {
        console.error('[Supabase] Error fetching docs:', error.message);
      }

      if (data && data.length > 0) {
        setDocs(data as Doc[]);
      } else if (!error) {
        // Initialize docs if empty for this project
        console.log('[Supabase] No docs found for project, initializing defaults...');
        
        // Map old IDs to new IDs to maintain hierarchy
        const idMapping: Record<string, string> = {};
        INITIAL_DOCS.forEach(d => {
          idMapping[d.id] = `${d.type}-${activeProjectId}-${Math.random().toString(36).substr(2, 9)}`;
        });

        const docsWithProjectId = INITIAL_DOCS.map(d => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { is_expanded, ...docWithoutUIState } = d;
          return { 
            ...docWithoutUIState, 
            id: idMapping[d.id],
            project_id: activeProjectId,
            parent_id: d.parent_id ? idMapping[d.parent_id] : null
          };
        });

        const { error: insertError } = await supabase.from('docs').insert(docsWithProjectId);
        if (insertError) {
          console.error('[Supabase] Error initializing docs:', insertError.message);
        } else {
          setDocs(docsWithProjectId as Doc[]);
        }
      }
    };

    fetchDocs();

    // Subscribe to docs for this specific project
    const docsChannel = supabase.channel(`docs-${activeProjectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: `project_id=eq.${activeProjectId}` }, 
        () => fetchDocs())
      .subscribe();

    return () => {
      docsChannel.unsubscribe();
    };
  }, [activeProjectId, user]);

  // Persistence for non-logged in users
  useEffect(() => {
    if (!user) {
      localStorage.setItem('scribeflow-project', JSON.stringify(project));
      localStorage.setItem('scribeflow-docs', JSON.stringify(docs));
    }
  }, [project, docs, user]);

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

  // Auth Handlers
  const handleLogin = async () => {
    try {
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
    } catch (e) {
      console.error('Login failed:', e);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      // Clear local state on logout
      setProjects([]);
      setActiveProjectId(null);
      setDocs(INITIAL_DOCS);
      setSelectedDocId(INITIAL_DOCS[0].id);
    } catch (e) {
      console.error('Logout failed:', e);
    }
  };

  // Handlers
  const handleAddDoc = async (parent_id: string | null, type: DocumentType) => {
    const newId = crypto.randomUUID();
    const newDoc: Doc = {
      id: newId,
      title: type === 'folder' ? 'New Folder' : 
             type === 'characters' ? 'New Character' : 
             type === 'places' ? 'New Setting' : 'New Document',
      content: '',
      type,
      parent_id,
      order: docs.filter(d => d.parent_id === parent_id).length,
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

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleDeleteDoc = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    
    if (user && activeProjectId) {
      try {
        await supabase.from('docs').delete().eq('id', deleteConfirmId).eq('project_id', activeProjectId);
      } catch (e) {
        console.error('Error deleting doc:', e);
      }
    } else {
      setDocs(docs.filter(d => d.id !== deleteConfirmId && d.parent_id !== deleteConfirmId));
    }

    if (selectedDocId === deleteConfirmId) setSelectedDocId(null);
    setDeleteConfirmId(null);
  };

  const handleCreateProject = async (name: string) => {
    if (!user) return;
    const newProjectId = `project-${user.id}-${Date.now()}`;
    const newProject: Project = {
      ...INITIAL_PROJECT,
      id: newProjectId,
      name,
      owner_id: user.id,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    const { data: insertedData, error } = await supabase.from('projects').insert(newProject).select();
    if (!error && insertedData && insertedData.length > 0) {
      const createdProject = insertedData[0] as Project;
      setProjects([createdProject, ...projects]);
      setActiveProjectId(newProjectId);

      try {
        const idMapping: Record<string, string> = {};
        INITIAL_DOCS.forEach(d => {
          idMapping[d.id] = `${d.type}-${newProjectId}-${Math.random().toString(36).substring(2, 11)}`;
        });

        const docsWithProjectId = INITIAL_DOCS.map(d => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { is_expanded, ...docWithoutUIState } = d as any;
          return { 
            ...docWithoutUIState, 
            id: idMapping[d.id],
            project_id: newProjectId,
            parent_id: d.parent_id ? idMapping[d.parent_id] : null
          };
        });

        const { error: docError } = await supabase.from('docs').insert(docsWithProjectId);
        if (docError) {
          console.error('[Supabase] Error creating initial docs:', docError.message);
        }
      } catch (e) {
        console.error('Failed to initialize project docs', e);
      }
      
    } else {
      console.error('[Supabase] Error creating project:', error);
      alert('Failed to create project. Please verify permissions. Error: ' + (error?.message || 'Unknown response'));
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
  };

  const handleUpdateDoc = async (id: string, updates: Partial<Doc>) => {
    const updated_at = Date.now();
    if (user && activeProjectId) {
      try {
        await supabase.from('docs').update({ ...updates, updated_at: updated_at }).eq('id', id).eq('project_id', activeProjectId);
      } catch (e) {
        console.error('Error updating doc:', e);
      }
    } else {
      setDocs(docs.map(d => d.id === id ? { ...d, ...updates, updated_at } : d));
    }
  };

  const handleUpdateMetadata = async (id: string, metadata_updates: Partial<DocumentMetadata>) => {
    const updated_at = Date.now();
    const docToUpdate = docs.find(d => d.id === id);
    if (!docToUpdate) return;

    const newMetadata: DocumentMetadata = {
      ...docToUpdate.metadata,
      ...metadata_updates,
      updated_at // Always update this
    };

    if (user && activeProjectId) {
      try {
        await supabase.from('docs').update({
          metadata: newMetadata,
          updated_at: updated_at
        }).eq('id', id).eq('project_id', activeProjectId);
      } catch (e) {
        console.error('Error updating metadata:', e);
      }
    } else {
      setDocs(docs.map(d => d.id === id ? {
        ...d,
        metadata: newMetadata,
        updated_at
      } : d));
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

  if (!isAuthReady || (user && projects.length === 0 && !project)) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#1a1a1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-400 font-serif italic tracking-wide">Invocando seu santuário...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "flex flex-col h-screen bg-surface-background overflow-hidden font-sans text-on-surface select-none",
      (project?.settings?.theme || INITIAL_PROJECT.settings.theme) === 'dark' && "dark-theme"
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

          {user ? (
            <button onClick={handleLogout} className="macos-btn" title={`Signed in as ${user.user_metadata?.full_name || user.email}`}>
              {user.user_metadata?.avatar_url ? (
                <img src={user.user_metadata.avatar_url} className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon size={16} />
              )}
            </button>
          ) : (
            <button onClick={handleLogin} className="macos-btn" title="Sign In">
              <LogIn size={16} />
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
                        doc={selectedDoc}
                        zoom={zoom}
                        onZoomChange={setZoom}
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
            content={selectedDoc.content}
            title={selectedDoc.title}
            onChange={(content) => handleUpdateDoc(selectedDoc.id, { content })}
            onExit={() => setIsCompositionMode(false)}
          />
        )}
      </AnimatePresence>

      {/* Modals */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={project?.settings || INITIAL_PROJECT.settings}
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
          <div className="context-menu-item" onClick={() => handleDeleteDoc(contextMenu.id)}>
            <div className="context-menu-icon"><Trash2 size={14} /></div>
            Move to Trash
            <span className="context-menu-shortcut">⌘⌫</span>
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item">
            <div className="context-menu-icon"><Share size={14} /></div>
            Share...
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-on-surface/20 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-[6px] shadow-xl p-8 max-w-sm w-full border border-[#C5C2BA]"
            >
              <h3 className="text-xl font-serif font-bold text-primary mb-3">Confirm Delete</h3>
              <p className="text-sm text-on-surface-variant mb-8 leading-relaxed">
                Are you sure you want to delete this document? This action cannot be undone and will remove it from your sanctuary.
              </p>
              <div className="flex justify-end gap-4">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="px-5 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container-high rounded-sm transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-800 hover:bg-red-900 rounded-[6px] transition-colors shadow-sm"
                >
                  Delete Document
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
            <div className={cn("w-[7px] h-[7px] rounded-full", user ? "bg-[#5B7A3D] shadow-[0_0_4px_rgba(91,122,61,0.4)]" : "bg-[#755a24]")} />
            <span className="font-bold">{user ? 'CLOUD SYNC ACTIVE' : 'LOCAL STORAGE ACTIVE'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
