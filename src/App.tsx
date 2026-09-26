/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { z } from 'zod';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { ParagraphFocus } from './extensions/paragraphFocus';
import { CommentMark } from './extensions/commentMark';
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
  File,
  Target,
  BarChart3,
  RotateCcw,
  BookMarked
} from 'lucide-react';
import { Doc, Project, ViewMode, DocumentType, DocumentMetadata, Snapshot, Comment } from './types';
import { FOLDER_COLORS, ICONS, LABEL_COLORS } from './constants';
import { Binder } from './components/Binder';
import { Editor } from './components/Editor';
import { DropPosition, OrderUpdate, applyOrderUpdates, isContainer, isPart, nextOrder, planDrop } from './lib/binderOrder';
import { Inspector, InspectorTab } from './components/Inspector';
import { Corkboard } from './components/Corkboard';
import { Outliner } from './components/Outliner';
import { Scrivenings } from './components/Scrivenings';
import { CompositionMode } from './components/CompositionMode';
import { QuickSearch } from './components/QuickSearch';
import { TargetsModal } from './components/TargetsModal';
import { StatisticsModal } from './components/StatisticsModal';
import { cn } from './lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { supabase, supabaseUrl, supabaseAnonKey } from './lib/supabase';
import { SaveQueue, SaveStatus, DocFieldUpdates, mergeServerDocs, shouldRefetchOnRealtime } from './lib/persistence';
import { User } from '@supabase/supabase-js';
import { MenuBar } from './components/MenuBar';
import { SettingsModal } from './components/SettingsModal';
import { ExportModal } from './components/ExportModal';
import { exportManuscript, ExportFormat, NothingToExportError } from './export';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { useStructuralFolders, getStructuralFolder } from './hooks/useStructuralFolders';
import { TrashOrigin, isInTrash, restoreParentId, withoutTrash } from './lib/trash';
import { Auth } from './components/Auth';
import { isRecoveryUrl } from './lib/password';

/** Lido no carregamento, antes de o supabase-js consumir o hash do link de recuperação. */
const OPENED_FROM_RECOVERY_LINK = typeof window !== 'undefined' && isRecoveryUrl(window.location.hash);

const generateInitialDocs = (projectId: string): Partial<Doc>[] => {
  const manuscriptId = crypto.randomUUID();
  const charactersId = crypto.randomUUID();
  const placesId = crypto.randomUUID();
  const researchId = crypto.randomUUID();
  const trashId = crypto.randomUUID();

  const defaultMeta = { section_type: 'Heading', is_include_in_compile: false, created_at: Date.now(), updated_at: Date.now(), status: 'To Do', label: 'none', label_color: 'transparent', synopsis: '', notes: '', target_word_count: 0, keywords: [], custom_metadata: {}, snapshots: [], comments: [], bookmarks: [] };

  return [
    { id: manuscriptId, project_id: projectId, title: 'Manuscript', content: '', type: 'folder', parent_id: null, order: 0, metadata: { ...defaultMeta, is_include_in_compile: true, folder_role: 'manuscript' } as DocumentMetadata },
    { id: charactersId, project_id: projectId, title: 'Characters', content: '', type: 'folder', parent_id: null, order: 1, metadata: { ...defaultMeta, folder_color: '#9B59B6', folder_role: 'characters' } as DocumentMetadata },
    { id: placesId, project_id: projectId, title: 'Places', content: '', type: 'folder', parent_id: null, order: 2, metadata: { ...defaultMeta, folder_color: '#27AE60', folder_role: 'places' } as DocumentMetadata },
    { id: researchId, project_id: projectId, title: 'Research', content: '', type: 'folder', parent_id: null, order: 3, metadata: { ...defaultMeta, folder_color: '#3498DB', folder_role: 'research' } as DocumentMetadata },
    { id: trashId, project_id: projectId, title: 'Trash', content: '', type: 'trash', parent_id: null, order: 4, metadata: { ...defaultMeta, folder_color: '#95A5A6', folder_role: 'trash' } as DocumentMetadata },
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
  /** Entrou pelo link de "Esqueci a senha": pede a nova senha antes de abrir o app. */
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(OPENED_FROM_RECOVERY_LINK);
  /** Token da sessao em memoria, para o envio sincrono do pagehide. */
  const accessTokenRef = React.useRef<string | null>(null);

  // Supabase Auth Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Link de recuperação inválido ou expirado: não há sessão, volta ao login comum.
      if (!session) setIsPasswordRecovery(false);
      accessTokenRef.current = session?.access_token ?? null;
      setUser(session?.user ?? null);
      setIsAuthReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      if (event === 'SIGNED_OUT') setIsPasswordRecovery(false);
      accessTokenRef.current = session?.access_token ?? null;
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
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isTargetsOpen, setIsTargetsOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('notes');
  const sessionBaselineRef = React.useRef<number | null>(null);
  const [isProjectsModalOpen, setIsProjectsModalOpen] = useState(false);
  const [isBinderOpen, setIsBinderOpen] = useState(true);
  /** 'closing' existe porque o AnimatePresence mantem o overlay montado durante
   *  a animacao de saida. Enquanto ele nao desmontar de fato, ele segue dono do
   *  view.dom do TipTap e o editor principal NAO pode remontar o seu
   *  EditorContent — senao inicializa vazio. */
  const [composeState, setComposeState] = useState<'closed' | 'open' | 'closing'>('closed');
  const isCompositionMode = composeState === 'open';
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSaveIndicator, setShowSaveIndicator] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set([]));
  const isLocalOperationRef = React.useRef<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  /** Ultimo `docs` renderizado. A fila de salvamento le daqui o metadata na hora
   *  de gravar, em vez de depender de um efeito colateral dentro do updater. */
  const docsRef = React.useRef<Doc[]>([]);
  docsRef.current = docs;
  const [saveQueue] = useState(() => new SaveQueue({
    getDoc: (id) => docsRef.current.find(d => d.id === id),
    write: async (docId, projectId, payload) => {
      // O supabase-js devolve { error } em vez de lancar, e um update barrado
      // por RLS ou com project_id errado casa 0 linhas sem erro nenhum.
      const { data, error } = await supabase
        .from('docs')
        .update(payload)
        .eq('id', docId)
        .eq('project_id', projectId)
        .select('id');
      if (error) return { ok: false, retry: true, error: error.message };
      if (!data || data.length === 0) return { ok: false, retry: false, error: 'nenhuma linha atualizada' };
      return { ok: true };
    },
    onStatus: setSaveStatus,
    onError: (docId, error) => console.error(`[Save] falha ao gravar o doc ${docId}:`, error),
  }));

  useEffect(() => {
    // Antes o beforeunload CANCELAVA o timer e jogava fora a ultima edicao.
    // Agora grava o que estiver pendente e, se ainda nao confirmou, pede para
    // o navegador avisar antes de sair.
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!saveQueue.hasUnsaved()) return;
      void saveQueue.flush();
      e.preventDefault();
      e.returnValue = '';
    };
    const flushNow = () => { if (saveQueue.hasUnsaved()) void saveQueue.flush(); };
    const handleVisibility = () => { if (document.visibilityState === 'hidden') flushNow(); };
    // Na descarga, o fetch do flush acima e abortado pelo navegador. O que ainda
    // nao foi confirmado vai por fetch com keepalive, que sobrevive a pagina.
    // O keepalive aceita no maximo 64 KB somados; o que passar disso fica so
    // com o aviso do beforeunload.
    const handlePageHide = () => {
      const token = accessTokenRef.current;
      if (!saveQueue.hasUnsaved() || !token) return;
      let budget = 60_000;
      saveQueue.drainForUnload((docId, projectId, payload) => {
        const body = JSON.stringify(payload);
        const size = new TextEncoder().encode(body).length;
        if (size > budget) return false;
        try {
          void fetch(`${supabaseUrl}/rest/v1/docs?id=eq.${encodeURIComponent(docId)}&project_id=eq.${encodeURIComponent(projectId)}`, {
            method: 'PATCH',
            keepalive: true,
            headers: {
              apikey: supabaseAnonKey,
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              Prefer: 'return=minimal',
            },
            body,
          }).catch(() => {});
        } catch {
          return false;
        }
        budget -= size;
        return true;
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [saveQueue]);
  
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
    // A montagem (árvore do binder, lixeira, compilação) e os formatos ficam em src/export.
    try {
      await exportManuscript(format as ExportFormat, docs, project?.name);
    } catch (err) {
      if (err instanceof NothingToExportError) {
        alert("Nenhum documento do Manuscript está marcado para compilar. Marque 'Include in Compile' no Inspector dos documentos que devem sair.");
      } else {
        console.error('Export failed:', err);
        alert(err instanceof Error && format === 'epub' ? err.message : 'Não foi possível exportar o documento.');
      }
    }

    setIsExportOpen(false);
  };

  const handleLogout = async () => {
    try {
      // Sem sessao, o RLS barraria o que ainda estiver na fila.
      if (saveQueue.hasUnsaved()) await saveQueue.flush();
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

  const [saveMessage, setSaveMessage] = useState<{ ok: boolean; text: string }>({ ok: true, text: 'Project Saved' });

  // ⌘S grava de fato o que estiver na fila e só diz "salvo" se o banco confirmou.
  const handleSave = async () => {
    if (saveQueue.hasUnsaved()) await saveQueue.flush();
    const ok = !saveQueue.hasUnsaved();
    if (ok) setLastSaved(new Date());
    setSaveMessage(ok ? { ok, text: 'Project Saved' } : { ok, text: 'Não foi possível salvar: veja a conexão' });
    setShowSaveIndicator(true);
    setTimeout(() => setShowSaveIndicator(false), 2000);
  };

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

  // O canal realtime de projects chama fetchProjects com o closure do efeito,
  // em que activeProjectId ainda e null. Sem este ref, qualquer gravacao em
  // projects (um ajuste, renomear o livro) era tratada como primeiro acesso:
  // trocava o projeto ativo pelo atualizado mais recentemente e reabria
  // "Meus Projetos" sempre que o ultimo projeto nao estava no localStorage.
  const activeProjectIdRef = React.useRef<string | null>(null);
  activeProjectIdRef.current = activeProjectId;

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
          if (!activeProjectIdRef.current) {
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
          console.log('[Supabase] No projects found, creating the initial project...');
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
          
          isLocalOperationRef.current = true;
          const { data: createdDocs, error: docsError } = await supabase.from('docs').insert(initialDocs).select();
          
          if (docsError) {
            console.error('AUTO-INIT TEMPLATE ERROR:', docsError);
          } else if (createdDocs) {
            setDocs(createdDocs as Doc[]);
          }
          
          setProjects([initialProject as Project]);
          setActiveProjectId(userProjectId);
          setTimeout(() => { isLocalOperationRef.current = false; }, 2000);
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

    // Descarta a resposta de um fetch que foi ultrapassado por outro mais novo.
    let fetchSeq = 0;
    let cancelled = false;
    const fetchDocs = async () => {
      const seq = ++fetchSeq;
      const { data, error } = await supabase
        .from('docs')
        .select('*')
        .eq('project_id', activeProjectId)
        .order('order', { ascending: true });

      if (cancelled || seq !== fetchSeq) return;
      if (error) {
        console.error('[Supabase] Error fetching docs:', error.message);
        // Na carga inicial do projeto nao ha estado local valido; num refetch,
        // manter o que ja esta na tela e melhor que trocar por lista vazia.
        if (seq === 1) setDocs([]);
        return;
      }

      // Campo com edicao ainda nao confirmada pelo banco fica com o valor local.
      setDocs(curr => mergeServerDocs(curr, (data || []) as Doc[], id => saveQueue.dirtyFields(id)));
    };

    fetchDocs();

    const docsChannel = supabase.channel(`docs-list-${activeProjectId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter: `project_id=eq.${activeProjectId}` },
        (payload) => {
          if (isLocalOperationRef.current) return;
          // O eco da propria gravacao nao precisa de refetch: o estado local ja e o mais novo.
          if (shouldRefetchOnRealtime(payload, (id, at) => saveQueue.isOwnEcho(id, at))) fetchDocs();
        })
      .subscribe();

    return () => {
      cancelled = true;
      docsChannel.unsubscribe();
    };
  }, [user, activeProjectId, saveQueue]);

  const { manuscript: manuscriptFolder, trash: trashFolder, characters: charactersFolder, places: placesFolder, research: researchFolder } = useStructuralFolders(docs);

  // Derived State
  const selectedDoc = useMemo(() =>
    docs.find(d => d.id === selectedDocId) || null
  , [docs, selectedDocId]);

  // Total manuscript word count across all documents in the project.
  const projectWordCount = useMemo(
    () =>
      withoutTrash(docs).reduce(
        (acc, doc) =>
          acc + (doc.content?.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length || 0),
        0
      ),
    [docs]
  );

  // Reset the session baseline whenever the active project changes.
  useEffect(() => {
    sessionBaselineRef.current = null;
  }, [activeProjectId]);

  // Capture the baseline once documents for the current project have loaded.
  useEffect(() => {
    if (sessionBaselineRef.current === null && docs.length > 0) {
      sessionBaselineRef.current = projectWordCount;
    }
  }, [docs.length, projectWordCount]);

  const sessionWords =
    sessionBaselineRef.current === null ? 0 : Math.max(0, projectWordCount - sessionBaselineRef.current);

  const currentFolderDocs = useMemo(() => {
    if (!selectedDoc) return [];
    const folderTypes: DocumentType[] = ['folder', 'research', 'characters', 'places', 'front-matter', 'trash'] as DocumentType[];
    if (folderTypes.includes(selectedDoc.type) || (isPart(selectedDoc) && docs.some(d => d.parent_id === selectedDoc.id))) {
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
  });

  const updateDocumentSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    content: z.string().optional(),
    parent_id: z.string().uuid().nullable().optional(),
    metadata: z.any().optional(), // Could be deeper but keeping partial context
  }).partial();

  // Handlers
  const handleAddDoc = async (
    parent_id: string | null,
    type: DocumentType,
    opts: { asPart?: boolean; afterId?: string | null } = {},
  ) => {
    // Texto não tem filhos visíveis no fluxo normal: "New Text" sobre um texto
    // cria o novo item logo DEPOIS dele, como irmão, e não escondido dentro.
    // `afterId` pede isso explicitamente (Novo Livro/Parte: mesmo nível, logo depois).
    const clickedDoc = parent_id ? docs.find(d => d.id === parent_id) : undefined;
    const afterDoc = opts.afterId ? docs.find(d => d.id === opts.afterId && !d.metadata.folder_role) : undefined;
    const siblingOf = afterDoc ?? (clickedDoc && !isContainer(clickedDoc) ? clickedDoc : undefined);
    if (siblingOf) parent_id = siblingOf.parent_id;
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
      title: opts.asPart ? 'Novo Livro' :
             type === 'folder' ? 'New Folder' : 
             type === 'characters' ? 'New Character' : 
             type === 'places' ? 'New Setting' : 'New Document',
      content: '',
      type,
      parent_id: final_parent_id,
      order: nextOrder(docs, final_parent_id),
      metadata: {
        status: 'To Do',
        label: 'none',
        label_color: 'transparent',
        synopsis: '',
        notes: '',
        target_word_count: 0,
        is_include_in_compile: true,
        section_type: opts.asPart ? 'Part' : type === 'folder' ? 'Heading' : 'Scene',
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
      });
    } catch (err) {
      console.error('Zod Validation Error (Add Doc):', err);
      return;
    }

    if (user && activeProjectId) {
      isLocalOperationRef.current = true;
      try {
        const docWithProjectId = { ...newDoc, project_id: activeProjectId };
        const { error } = await supabase.from('docs').insert(docWithProjectId);
        if (error) throw error;
        const withNew = [...docs, docWithProjectId as Doc];
        const reorder = siblingOf ? planDrop(withNew, newId, siblingOf.id, 'after') : null;
        setDocs(curr => {
          const next = [...curr, docWithProjectId as Doc];
          return reorder ? applyOrderUpdates(next, reorder) : next;
        });
        if (reorder) persistOrderUpdates(reorder);
      } catch (e) {
        console.error('Error adding doc:', e);
      }
      setTimeout(() => { isLocalOperationRef.current = false; }, 2000);
    } else if (!user) {
      setDocs(curr => [...curr, newDoc]);
    }
    
    setSelectedDocId(newDoc.id);
    if (parent_id) {
      const newExpanded = new Set(expandedFolders);
      newExpanded.add(parent_id);
      setExpandedFolders(newExpanded);
    }
  };

  /** Novo Livro/Parte: no mesmo nível do item escolhido, logo depois dele.
   *  Sobre uma pasta estrutural (ou sem seleção), entra no fim dela / do Manuscript. */
  const handleAddPart = (anchorId: string | null) => {
    const anchor = anchorId ? docs.find(d => d.id === anchorId) : undefined;
    if (anchor && !anchor.metadata.folder_role) {
      void handleAddDoc(anchor.parent_id, 'text', { asPart: true, afterId: anchor.id });
    } else {
      void handleAddDoc(anchor?.id ?? null, 'text', { asPart: true });
    }
  };

  /** Converte um documento de texto em Livro/Parte, ou de volta em cena. */
  const handleTogglePart = (id: string) => {
    const target = docs.find(d => d.id === id);
    if (!target || target.type !== 'text') return;
    handleUpdateMetadata(id, { section_type: isPart(target) ? 'Scene' : 'Part' });
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
    if (!targetDoc || targetDoc.metadata.folder_role) return; // Cannot delete structural folders
    
    if (isInTrash(docs, id)) {
      if (window.confirm('Tem certeza de que deseja excluir permanentemente este item? Esta ação não pode ser desfeita.')) {
        const idsToDelete = [id, ...getAllChildrenIds(id, docs)];
        if (user && activeProjectId) {
          isLocalOperationRef.current = true;
          try {
            await supabase.from('docs').delete().in('id', idsToDelete);
          } catch(e) { console.error('Delete error', e); }
        }
        setDocs(curr => curr.filter(d => !idsToDelete.includes(d.id)));
        setTimeout(() => { isLocalOperationRef.current = false; }, 2000);
        if (idsToDelete.includes(selectedDocId || '')) setSelectedDocId(null);
      }
    } else if (trashFolder) {
      // Move só o item: os filhos de uma pasta vão junto porque continuam
      // apontando para ela. Antes cada filho ia solto para a raiz da lixeira
      // (a estrutura se perdia) e seguia marcado para compilar.
      const trash_origin: TrashOrigin = {
        parent_id: targetDoc.parent_id,
        order: targetDoc.order,
        is_include_in_compile: targetDoc.metadata.is_include_in_compile,
      };
      const fields = { parent_id: trashFolder.id, order: nextOrder(docs, trashFolder.id) };
      const metadataPatch = { is_include_in_compile: false, trash_origin, updated_at: Date.now() };
      setDocs(curr => curr.map(d => d.id === id ? { ...d, ...fields, metadata: { ...d.metadata, ...metadataPatch } } : d));
      if (user && activeProjectId) saveQueue.enqueue(id, activeProjectId, { fields, metadataPatch });
      if (selectedDocId === id || getAllChildrenIds(id, docs).includes(selectedDocId || '')) setSelectedDocId(null);
    }
  };

  /** Devolve um item da lixeira (com tudo que estiver dentro dele) para onde estava. */
  const handleRestoreDoc = (id: string) => {
    const targetDoc = docs.find(d => d.id === id);
    if (!targetDoc || !trashFolder || targetDoc.parent_id !== trashFolder.id) return;
    const origin = targetDoc.metadata.trash_origin;
    const parent_id = restoreParentId(docs, origin);
    const fields = { parent_id, order: nextOrder(docs, parent_id) };
    const metadataPatch = {
      // Item apagado antes desta versão não tem origem: volta marcado para compilar
      // só se for texto, que é o padrão de um documento novo.
      is_include_in_compile: origin ? origin.is_include_in_compile : targetDoc.type === 'text',
      trash_origin: undefined,
      updated_at: Date.now(),
    };
    setDocs(curr => curr.map(d => d.id === id ? { ...d, ...fields, metadata: { ...d.metadata, ...metadataPatch } } : d));
    if (user && activeProjectId) saveQueue.enqueue(id, activeProjectId, { fields, metadataPatch });
    if (parent_id) setExpandedFolders(prev => new Set(prev).add(parent_id));
    setSelectedDocId(id);
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
        
        isLocalOperationRef.current = true;
        const { data: createdDocs, error: docsError } = await supabase
          .from('docs')
          .insert(initialDocs)
          .select();

        if (docsError) {
          console.error('TEMPLATE INSERT ERROR:', docsError);
          alert('Erro ao criar estrutura do projeto: ' + docsError.message);
        } else if (createdDocs) {
          setDocs(createdDocs as Doc[]);
        }
        
        setActiveProjectId(newProjectId);
        localStorage.setItem('scribeflow-last-project', newProjectId);
        setTimeout(() => { isLocalOperationRef.current = false; }, 2000);
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

  // Fila das gravações de ordem: arrastes rápidos gravam na sequência em que
  // aconteceram, sem uma resposta atrasada sobrescrever um arraste mais novo.
  const orderSaveQueueRef = React.useRef<Promise<void>>(Promise.resolve());
  const pendingOrderSavesRef = React.useRef(0);

  const persistOrderUpdates = (updates: OrderUpdate[]) => {
    if (!user || !activeProjectId || updates.length === 0) return;
    const projectId = activeProjectId;
    pendingOrderSavesRef.current += 1;
    // Cada linha gravada dispara um evento realtime; sem isto, o primeiro eco
    // recarregaria a lista com metade das linhas ainda na ordem antiga.
    isLocalOperationRef.current = true;
    setSaveStatus('pending');

    orderSaveQueueRef.current = orderSaveQueueRef.current.then(async () => {
      const results = await Promise.all(updates.map(u =>
        supabase
          .from('docs')
          .update({ parent_id: u.parent_id, order: u.order })
          .eq('id', u.id)
          .eq('project_id', projectId)
          .then(r => r, (error: unknown) => ({ error })) // rede caída conta como erro
      ));
      const failed = results.find(r => r.error);
      if (failed) {
        console.error('[Supabase] Erro ao gravar a ordem do binder:', failed.error);
        setSaveStatus('error');
        // Volta para o que o banco tem de fato (parte das linhas pode ter gravado).
        try {
          const { data } = await supabase
            .from('docs')
            .select('id, parent_id, order')
            .eq('project_id', projectId)
            .in('id', updates.map(u => u.id));
          if (data) setDocs(curr => applyOrderUpdates(curr, data as OrderUpdate[]));
        } catch (e) {
          console.error('[Supabase] Erro ao reler a ordem do binder:', e);
        }
      } else {
        setSaveStatus('saved');
      }
    }).finally(() => {
      pendingOrderSavesRef.current -= 1;
      setTimeout(() => {
        if (pendingOrderSavesRef.current === 0) isLocalOperationRef.current = false;
      }, 2000);
    });
  };

  const handleDropDoc = (activeId: string, targetId: string, position: DropPosition) => {
    const updates = planDrop(docs, activeId, targetId, position);
    if (!updates || updates.length === 0) return;

    setDocs(curr => applyOrderUpdates(curr, updates));
    if (position === 'inside') {
      setExpandedFolders(prev => new Set(prev).add(targetId));
    }
    persistOrderUpdates(updates);
  };

  const handleRenameProject = async (id: string, name: string) => {
    const trimmed = name.trim();
    try {
      projectSchema.parse({ title: trimmed });
    } catch (err: unknown) {
      alert(err instanceof z.ZodError ? err.issues[0]?.message : 'Erro de validação');
      return;
    }
    const previous = projects.find(p => p.id === id);
    if (!previous || previous.name === trimmed) return;

    const updated_at = Date.now();
    setProjects(prev => prev.map(p => (p.id === id ? { ...p, name: trimmed, updated_at } : p)));
    if (!user) return;

    const { error } = await supabase.from('projects').update({ name: trimmed, updated_at }).eq('id', id);
    if (error) {
      console.error('[Supabase] Erro ao renomear o projeto:', error);
      setProjects(prev => prev.map(p => (p.id === id ? { ...p, name: previous.name, updated_at: previous.updated_at } : p)));
      alert('Não foi possível renomear o livro: ' + error.message);
    }
  };

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
      const { metadata, ...fields } = updates;
      saveQueue.enqueue(id, activeProjectId, { fields: fields as DocFieldUpdates, metadataPatch: metadata });
    }
  };

  // Global Editor instance for shared focus mode (Hardening/Refactor)
  const globalEditor = useEditor({
    extensions: [
      StarterKit, // ja inclui Underline no TipTap v3
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
      ParagraphFocus,
      CommentMark,
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
        // emitUpdate: false — no TipTap v3 o setContent dispara onUpdate por
        // padrao, e cada troca de capitulo virava uma gravacao do HTML normalizado.
        globalEditor.commands.setContent(selectedDoc.content, { emitUpdate: false });
      }
    }
  }, [selectedDoc?.id, globalEditor]);

  const canCompose = selectedDoc?.type === 'text';
  const openCompose = () => { if (canCompose) setComposeState('open'); };

  const handleNewProject = () => {
    const name = window.prompt('Nome do novo projeto:', '');
    if (name && name.trim()) handleCreateProject(name.trim());
  };

  // Desfazer/Refazer do menu agem no editor de texto; os atalhos ⌘Z/⇧⌘Z já
  // funcionam dentro dele pelo próprio TipTap.
  const canUndo = viewMode === 'editor' && canCompose && !!globalEditor?.can().undo();
  const canRedo = viewMode === 'editor' && canCompose && !!globalEditor?.can().redo();

  // Atalho anunciado aqui tem que existir no listener global (ou no TipTap).
  // Atalhos que o navegador reserva (⌘N, ⌘1-4, ⌥⌘I...) ficam sem rótulo.
  const menus = [
    {
      label: 'File',
      items: [
        { label: 'New Text', onClick: () => handleAddDoc(null, 'text') },
        { label: 'New Folder', onClick: () => handleAddDoc(null, 'folder') },
        { label: 'Novo Livro / Parte', onClick: () => handleAddPart(selectedDocId) },
        { divider: true },
        { label: 'Save', shortcut: '⌘S', onClick: handleSave },
        { label: 'Export Draft...', shortcut: '⇧⌘E', onClick: () => setIsExportOpen(true) },
      ]
    },
    {
      label: 'Edit',
      items: [
        { label: 'Undo', shortcut: '⌘Z', disabled: !canUndo, onClick: () => globalEditor?.chain().focus().undo().run() },
        { label: 'Redo', shortcut: '⇧⌘Z', disabled: !canRedo, onClick: () => globalEditor?.chain().focus().redo().run() },
        { divider: true },
        { label: 'Go to Document...', shortcut: '⌘O', onClick: () => setIsQuickSearchOpen(true) },
      ]
    },
    {
      label: 'View',
      items: [
        { label: 'Editor', onClick: () => setViewMode('editor') },
        { label: 'Corkboard', onClick: () => setViewMode('corkboard') },
        { label: 'Outliner', onClick: () => setViewMode('outliner') },
        { label: 'Scrivenings', onClick: () => setViewMode('scrivenings') },
        { divider: true },
        { label: 'Toggle Binder', onClick: () => setIsBinderOpen(!isBinderOpen) },
        { label: 'Toggle Inspector', onClick: () => setIsInspectorOpen(!isInspectorOpen) },
        { divider: true },
        { label: 'Enter Composition Mode', shortcut: '⇧⌘F', disabled: !canCompose, onClick: openCompose },
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
        { label: 'New Project...', onClick: handleNewProject },
        { divider: true },
        { label: 'Project Settings...', shortcut: '⌥⌘,', onClick: () => setIsSettingsOpen(true) },
        { divider: true },
        { label: 'New Character Sketch', onClick: () => handleAddDoc(null, 'characters') },
        { label: 'New Setting Sketch', onClick: () => handleAddDoc(null, 'places') },
      ]
    }
  ];

  // Atalhos globais: cada um corresponde a um rótulo do menu.
  useEffect(() => {
    const handleGlobalShortcuts = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      // ⌘S vale em qualquer lugar, inclusive no Compose: nunca abre o "salvar página" do navegador.
      if (mod && !e.shiftKey && !e.altKey && key === 's') {
        e.preventDefault();
        void handleSave();
        return;
      }
      if (composeState !== 'closed') return;
      // F11 ou ⇧⌘F — Compose
      if (e.key === 'F11' || (mod && e.shiftKey && !e.altKey && key === 'f')) {
        if (canCompose) {
          e.preventDefault();
          setComposeState('open');
        }
        return;
      }
      // ⌘O — Quick Search
      if (mod && !e.shiftKey && !e.altKey && key === 'o') {
        e.preventDefault();
        setIsQuickSearchOpen((prev) => !prev);
        return;
      }
      // ⇧⌘E — Exportar
      if (mod && e.shiftKey && !e.altKey && key === 'e') {
        e.preventDefault();
        setIsExportOpen(true);
        return;
      }
      // ⌘P — Meus projetos (no lugar do "imprimir" do navegador)
      if (mod && !e.shiftKey && !e.altKey && key === 'p') {
        e.preventDefault();
        setIsProjectsModalOpen(true);
        return;
      }
      // ⌥⌘, — Ajustes do projeto (e.code: no Mac o ⌥ troca o caractere da tecla)
      if (mod && e.altKey && e.code === 'Comma') {
        e.preventDefault();
        setIsSettingsOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcuts);
    return () => window.removeEventListener('keydown', handleGlobalShortcuts);
  });

  const handleUpdateMetadata = async (id: string, metadata_updates: Partial<DocumentMetadata>) => {
    const updated_at = Date.now();
    const patch = { ...metadata_updates, updated_at };
    setDocs(curr => curr.map(d => d.id === id ? { ...d, metadata: { ...d.metadata, ...patch }, updated_at } : d));

    // Antes o metadata completo era capturado DENTRO do updater acima; quando o
    // React adiava o updater (ex.: outro setDocs no mesmo evento), a variavel
    // ficava null e o save nunca era enfileirado. A fila guarda so o patch.
    if (user && activeProjectId) {
      saveQueue.enqueue(id, activeProjectId, { metadataPatch: patch });
    }
  };

  const handleRestoreSnapshot = (snapshot: Snapshot) => {
    if (!selectedDoc) return;
    // Push the snapshot content straight into the live editor; the sync effect
    // only runs on doc.id changes, so restoring the same doc needs this.
    if (globalEditor) {
      globalEditor.commands.setContent(snapshot.content);
    }
    handleUpdateDoc(selectedDoc.id, { title: snapshot.title, content: snapshot.content });
  };

  const handleAddComment = (id: string, quote: string) => {
    if (!selectedDoc) return;
    const comment: Comment = {
      id,
      author: user?.user_metadata?.full_name || user?.email || 'You',
      text: '',
      timestamp: Date.now(),
      quote,
      color: '#FFD66B',
    };
    const comments = [...(selectedDoc.metadata.comments || []), comment];
    handleUpdateMetadata(selectedDoc.id, { comments });
    setInspectorTab('comments');
    setIsInspectorOpen(true);
  };

  const handleUpdateComment = (id: string, text: string) => {
    if (!selectedDoc) return;
    const comments = (selectedDoc.metadata.comments || []).map((c) =>
      c.id === id ? { ...c, text } : c
    );
    handleUpdateMetadata(selectedDoc.id, { comments });
  };

  const handleDeleteComment = (id: string) => {
    if (!selectedDoc) return;
    if (globalEditor) {
      globalEditor.chain().focus().removeComment(id).run();
    }
    const comments = (selectedDoc.metadata.comments || []).filter((c) => c.id !== id);
    handleUpdateMetadata(selectedDoc.id, { comments });
  };

  const handleSelectComment = (id: string) => {
    if (!globalEditor) return;
    const { state } = globalEditor;
    const markType = state.schema.marks.comment;
    if (!markType) return;
    let range: { from: number; to: number } | null = null;
    state.doc.descendants((node, pos) => {
      if (range || !node.isText) return;
      if (node.marks.some((m) => m.type === markType && m.attrs.commentId === id)) {
        range = { from: pos, to: pos + node.nodeSize };
      }
    });
    if (range) {
      globalEditor.chain().focus().setTextSelection(range).scrollIntoView().run();
    }
  };

  const handleUpdateSettings = async (settings: Partial<Project['settings']>) => {
    if (!project) return;
    const updatedSettings = { ...project.settings, ...settings };
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, settings: updatedSettings } : p)));
    if (user) {
      // O supabase-js devolve { error } em vez de lancar.
      const { error } = await supabase.from('projects').update({ settings: updatedSettings }).eq('id', project.id);
      if (error) {
        console.error('[Supabase] Erro ao gravar os ajustes do projeto:', error.message);
        setSaveStatus('error');
      }
    }
  };

  // Estilo de paragrafo do texto (editor, Scrivenings e Compose leem o atributo no <html>).
  const paragraphStyle = project?.settings?.paragraph_style === 'blocks' ? 'blocks' : 'book';
  useEffect(() => {
    document.documentElement.dataset.paragraphStyle = paragraphStyle;
  }, [paragraphStyle]);

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
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeContextMenu(); };
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

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

  // 2b. Link de recuperação: a sessão já existe, mas falta definir a nova senha.
  if (isPasswordRecovery) {
    return <Auth recovery onRecoveryDone={() => setIsPasswordRecovery(false)} />;
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
            className={cn("fixed top-8 right-8 text-white px-4 py-2 rounded-lg shadow-lg z-[10000] text-xs font-bold flex items-center gap-2", saveMessage.ok ? "bg-[#5B7A3D]" : "bg-red-600")}
          >
            <Save size={14} />
            {saveMessage.text}
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

        {/* Search Field — opens Quick Search (⌘O) */}
        <div className="relative flex items-center">
          <input
            type="text"
            placeholder="Search Project (⌘O)"
            className="toolbar-search cursor-pointer"
            readOnly
            onFocus={() => setIsQuickSearchOpen(true)}
            onClick={() => setIsQuickSearchOpen(true)}
          />
          <Search size={12} className="absolute left-2 text-[#8A877F]" />
        </div>

        <div className="toolbar-spacer" />

        {/* Action Buttons */}
        <div className="flex items-center gap-1">
          <button 
            onClick={openCompose}
            disabled={!canCompose}
            title={canCompose ? 'Compose (F11 / ⇧⌘F)' : 'Selecione um documento de texto'}
            className="composition-btn mr-2 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <PenTool size={14} />
            Compose
          </button>
          
          <button onClick={() => setIsExportOpen(true)} className="macos-btn" title="Export Manuscript">
            <Download size={16} />
          </button>
          
          <button onClick={() => setIsTargetsOpen(true)} className="macos-btn" title="Project Targets">
            <Target size={16} />
          </button>

          <button onClick={() => setIsStatsOpen(true)} className="macos-btn" title="Project Statistics">
            <BarChart3 size={16} />
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
            <button
              onClick={() => { if (window.confirm(`Sair da conta ${user.email}?`)) void handleLogout(); }}
              className="macos-btn"
              title={`Signed in as ${user.user_metadata?.full_name || user.email} — clique para sair`}
            >
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
              onAddPart={() => handleAddPart(selectedDocId)}
              onUpdateDoc={handleUpdateDoc}
              onDeleteDoc={handleDeleteDoc}
              onRenameDoc={handleRenameDoc}
              onDropDoc={handleDropDoc}
              onRenameProject={(name) => activeProjectId && handleRenameProject(activeProjectId, name)}
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
                    (selectedDoc.type === 'folder' || selectedDoc.type === 'research' || selectedDoc.type === 'characters' || selectedDoc.type === 'places' || selectedDoc.type === 'front-matter' || selectedDoc.type === 'trash') ? (
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
                        onAddComment={handleAddComment}
                        suspendEditorContent={composeState !== 'closed'}
                        onConvertToPart={() => handleTogglePart(selectedDoc.id)}
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
              tab={inspectorTab}
              onTabChange={setInspectorTab}
              onUpdateMetadata={handleUpdateMetadata}
              onRestoreSnapshot={handleRestoreSnapshot}
              onUpdateComment={handleUpdateComment}
              onDeleteComment={handleDeleteComment}
              onSelectComment={handleSelectComment}
              onTogglePart={handleTogglePart}
            />
          </div>
        )}
      </main>

      {/* Composition Mode Overlay */}
      <AnimatePresence onExitComplete={() => setComposeState('closed')}>
        {isCompositionMode && selectedDoc && selectedDoc.type === 'text' && (
          <CompositionMode 
            key="compose-mode"
            editor={globalEditor}
            title={selectedDoc.title}
            onExit={() => setComposeState('closing')}
          />
        )}
      </AnimatePresence>

      {/* Quick Search / Go to document (⌘O) */}
      {isQuickSearchOpen && (
        <QuickSearch
          docs={docs}
          onSelect={navigateTo}
          onClose={() => setIsQuickSearchOpen(false)}
        />
      )}

      {/* Project Statistics */}
      <StatisticsModal isOpen={isStatsOpen} onClose={() => setIsStatsOpen(false)} docs={docs} />

      {/* Project Targets */}
      <TargetsModal
        isOpen={isTargetsOpen}
        onClose={() => setIsTargetsOpen(false)}
        settings={project?.settings || { target_word_count: 50000, session_target: 1000, deadline: null, composition_theme: 'sepia', theme: 'traditional', paper_width: 800, background_opacity: 0.9 }}
        projectWords={projectWordCount}
        sessionWords={sessionWords}
        onUpdateSettings={handleUpdateSettings}
      />

      {/* Modals */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={project?.settings || { target_word_count: 50000, session_target: 1000, deadline: null, composition_theme: 'sepia', theme: 'traditional', paper_width: 800, background_opacity: 0.9 }}
        onUpdateSettings={handleUpdateSettings}
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
        onRename={handleRenameProject}
      />

      {/* Context Menu */}
      {contextMenu && (
        <div 
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-item" onClick={() => { handleAddDoc(contextMenu.id, 'text'); setContextMenu(null); }}>
            <div className="context-menu-icon"><File size={14} /></div>
            New Text
          </div>
          <div className="context-menu-item" onClick={() => { handleAddDoc(contextMenu.id, 'folder'); setContextMenu(null); }}>
            <div className="context-menu-icon"><Folder size={14} /></div>
            New Folder
          </div>
          <div className="context-menu-item" onClick={() => { handleAddPart(contextMenu.id); setContextMenu(null); }}>
            <div className="context-menu-icon"><BookMarked size={14} /></div>
            Novo Livro / Parte
          </div>
          {docs.find(d => d.id === contextMenu.id)?.type === 'text' && (
            <div className="context-menu-item" onClick={() => { handleTogglePart(contextMenu.id); setContextMenu(null); }}>
              <div className="context-menu-icon"><BookMarked size={14} /></div>
              {isPart(docs.find(d => d.id === contextMenu.id)!) ? 'Converter em documento' : 'Converter em Livro / Parte'}
            </div>
          )}
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={() => { setRenamingId(contextMenu.id); setContextMenu(null); }}>
            <div className="context-menu-icon"><Edit3 size={14} /></div>
            Rename
          </div>
          {contextMenu && contextMenu.id === trashFolder?.id ? (
            <div className="context-menu-item" onClick={() => { handleEmptyTrash(); setContextMenu(null); }} style={{ color: '#E74C3C' }}>
              <div className="context-menu-icon"><Trash2 size={14} /></div>
              Esvaziar Lixeira
            </div>
          ) : (
            <>
              {docs.find(d => d.id === contextMenu.id)?.parent_id === trashFolder?.id && (
                <div className="context-menu-item" onClick={() => { handleRestoreDoc(contextMenu.id); setContextMenu(null); }}>
                  <div className="context-menu-icon"><RotateCcw size={14} /></div>
                  Restaurar
                </div>
              )}
              {/* Pastas estruturais (Manuscript, Characters...) não vão para a lixeira. */}
              {!docs.find(d => d.id === contextMenu.id)?.metadata.folder_role && (
                <div className="context-menu-item" onClick={() => { handleDeleteDoc(contextMenu.id); setContextMenu(null); }}>
                  <div className="context-menu-icon"><Trash2 size={14} /></div>
                  {isInTrash(docs, contextMenu.id) ? 'Deletar Permanentemente' : 'Move to Trash'}
                </div>
              )}
            </>
          )}
          {/* "Compartilhar Link" escondido: copiava só a URL raiz, sem projeto nem documento. */}
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
          <button
            className="flex items-center gap-2 hover:text-[#436127] transition-colors"
            title="Open Project Targets"
            onClick={() => setIsTargetsOpen(true)}
          >
            <span className="opacity-70">WORDS: <span className="font-bold text-[#436127]">{projectWordCount.toLocaleString()}</span></span>
            {(project?.settings?.target_word_count ?? 0) > 0 && (
              <span className="flex items-center gap-1.5">
                <span className="w-16 h-1.5 rounded-full bg-black/15 overflow-hidden inline-block align-middle">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((projectWordCount / project!.settings.target_word_count) * 100))}%`,
                      backgroundColor:
                        projectWordCount >= project!.settings.target_word_count ? '#40A040' : '#5B7A3D',
                    }}
                  />
                </span>
                <span className="font-bold text-[#436127]">
                  {Math.min(100, Math.round((projectWordCount / project!.settings.target_word_count) * 100))}%
                </span>
              </span>
            )}
            {(project?.settings?.session_target ?? 0) > 0 && (
              <span className="opacity-70">
                · SESSION: <span className="font-bold text-[#436127]">{sessionWords.toLocaleString()}/{project!.settings.session_target.toLocaleString()}</span>
              </span>
            )}
          </button>
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
