import React, { useState, useRef, useEffect } from 'react';
import { 
  ChevronRight, 
  ChevronDown, 
  FileText, 
  Folder, 
  Search, 
  Plus, 
  Trash2,
  BookOpen,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Info,
  Download,
  FolderPlus,
  User,
  MapPin,
  FileSearch,
  Layout,
  MoreVertical,
  Settings,
  Pencil,
  BookMarked
} from 'lucide-react';
import { Doc, DocumentType } from '../types';
import { ICONS, FOLDER_COLORS, labelColorOf } from '../constants';
import { getDocIcon } from '../utils/getDocIcon';
import { cn } from '../lib/utils';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  CollisionDetection,
  Modifier,
  DragEndEvent,
  DragMoveEvent,
  DragOverEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  DropPosition,
  getDropPosition,
  getSortedChildren,
  isContainer,
  planDrop,
} from '../lib/binderOrder';
import { InlineNameInput } from './InlineNameInput';
import { isInTrash } from '../lib/trash';
import {
  GestureState,
  LONG_PRESS_MS,
  autoScrollSpeed,
  idleGesture,
  onTouchEndAction,
  onTouchMovePhase,
} from '../lib/touchGesture';

const COARSE_POINTER = (() => {
  try {
    return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
})();

// Com o ponteiro em cima de uma linha, ela é o alvo; nos vãos, a mais próxima.
const binderCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : closestCenter(args);
};

// Desloca a "fantasma" do arraste para baixo e para a direita do ponteiro,
// para ela não cobrir a linha-alvo e o indicador de onde vai cair.
const offsetOverlay: Modifier = ({ transform }) => ({
  ...transform,
  x: transform.x + 32,
  y: transform.y + 22,
});

interface DropIndicator {
  overId: string;
  position: DropPosition;
}



const stripHtml = (html: string) =>
  (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const matchesSearch = (doc: Doc, query: string): boolean => {
  const q = query.toLowerCase();
  return (
    doc.title.toLowerCase().includes(q) ||
    (doc.metadata?.synopsis || '').toLowerCase().includes(q) ||
    stripHtml(doc.content).toLowerCase().includes(q)
  );
};

interface SortableBinderItemProps {
  doc: Doc;
  depth: number;
  isSelected: boolean;
  is_expanded: boolean;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onAdd: (parent_id: string | null, type: DocumentType) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, newTitle: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  isRenaming: boolean;
  onRenameComplete: () => void;
  childrenDocs: Doc[];
  renderChildren: (parent_id: string, depth: number) => React.ReactNode;
  dropPosition: DropPosition | null;
  /** Toque: o arraste e o menu vêm do gesto do Binder, não do puxador. */
  touchMode: boolean;
  /** Item segurado (toque longo) ou sendo arrastado pelo toque. */
  touchState: 'armed' | 'dragging' | null;
}

function SortableBinderItem({
  doc,
  depth,
  isSelected,
  is_expanded,
  onSelect,
  onToggle,
  onAdd,
  onDelete,
  onRename,
  onContextMenu,
  isRenaming,
  onRenameComplete,
  childrenDocs,
  renderChildren,
  dropPosition,
  touchMode,
  touchState
}: SortableBinderItemProps) {
  // Arrasta pelo puxador; o alvo de soltura é só a linha (sem os filhos),
  // senão uma pasta aberta cobre a área de todos os filhos e "rouba" o drop.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: doc.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: doc.id });

  const style = { opacity: isDragging || touchState === 'dragging' ? 0.4 : 1 };

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(doc.title);
  const inputRef = useRef<HTMLInputElement>(null);

  // O campo parte do titulo ATUAL: o editTitle inicial fica velho quando o
  // titulo muda pelo editor, e sair do campo desfazia o titulo novo.
  const startEditing = () => {
    setEditTitle(doc.title);
    setIsEditing(true);
  };

  useEffect(() => {
    if (isRenaming) {
      startEditing();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRenaming]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleRename = () => {
    if (editTitle.trim() && editTitle !== doc.title) {
      onRename(doc.id, editTitle);
    } else {
      setEditTitle(doc.title);
    }
    setIsEditing(false);
    if (isRenaming) onRenameComplete();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      handleRename();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      setEditTitle(doc.title);
      setIsEditing(false);
      if (isRenaming) onRenameComplete();
    }
  };

  const hasDisclosure = isContainer(doc) || childrenDocs.length > 0;

  const wordCount = (doc.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

  return (
    <div ref={setDragRef} style={style} className="select-none">
      <div
        ref={setDropRef}
        data-binder-id={doc.id}
        className={cn(
          "binder-item group relative",
          isSelected && "selected",
          touchState === 'armed' && "touch-armed",
          dropPosition === 'inside' && "ring-2 ring-inset ring-[#5B7A3D] bg-[#5B7A3D]/15"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(doc.id)}
        onDoubleClick={startEditing}
        onContextMenu={(e) => onContextMenu(e, doc.id)}
      >
        {(dropPosition === 'before' || dropPosition === 'after') && (
          <div
            data-drop-indicator={dropPosition}
            className={cn(
              "absolute right-1 h-0.5 bg-[#5B7A3D] rounded-full pointer-events-none z-10",
              dropPosition === 'before' ? "top-0" : "bottom-0"
            )}
            style={{ left: `${depth * 12 + 8}px` }}
          />
        )}
        <div
          aria-label={`Arrastar ${doc.title}`}
          className={cn(
            "w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity shrink-0 mr-1",
            touchMode && "hidden"
          )}
          {...attributes}
          {...(touchMode ? {} : listeners)}
        >
          <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" className="text-gray-400">
            <circle cx="2" cy="2" r="1.2"/>
            <circle cx="6" cy="2" r="1.2"/>
            <circle cx="2" cy="6" r="1.2"/>
            <circle cx="6" cy="6" r="1.2"/>
            <circle cx="2" cy="10" r="1.2"/>
            <circle cx="6" cy="10" r="1.2"/>
          </svg>
        </div>

        {/* Seta em pasta e em QUALQUER item com filhos: um texto com filhos
            (dado legado ou vindo de outra versão) não pode esconder documentos. */}
        <div
          className="w-4 h-4 mr-0.5 flex items-center justify-center cursor-default"
          onClick={(e) => {
            if (hasDisclosure) {
              e.stopPropagation();
              onToggle(doc.id);
            }
          }}
        >
          {hasDisclosure && (
            <div
              className={cn("disclosure-triangle", is_expanded && "expanded")}
              dangerouslySetInnerHTML={{ __html: is_expanded ? ICONS.disclosureExpanded : ICONS.disclosure }}
            />
          )}
        </div>

        <div className="mr-1.5 text-[#5A5A5A] flex items-center shrink-0">
          {getDocIcon(doc)}
        </div>

        {labelColorOf(doc.metadata) && (
          <div
            data-label-dot
            className="w-2 h-2 rounded-full mr-2 shadow-sm shrink-0"
            style={{ backgroundColor: labelColorOf(doc.metadata)! }}
          />
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            className="flex-1 bg-white border border-[#5B7A3D] rounded px-1 text-[13px] focus:outline-none"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="flex-1 truncate text-[13px] tracking-tight">{doc.title}</span>
        )}

        <div className="flex items-center gap-2">
          {(doc.metadata?.keywords?.length ?? 0) > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              {doc.metadata.keywords.slice(0, 3).map((kw) => (
                <span
                  key={kw.text}
                  className="w-2 h-2 rounded-sm"
                  style={{ backgroundColor: kw.color }}
                  title={kw.text}
                />
              ))}
            </div>
          )}
          {wordCount > 0 && (
            <span className="text-[10px] text-on-surface-variant/60 font-mono opacity-0 group-hover:opacity-100">{wordCount}</span>
          )}
        </div>
      </div>

      {is_expanded && childrenDocs.length > 0 && (
        <div className="">
          {renderChildren(doc.id, depth + 1)}
        </div>
      )}
    </div>
  );
}

interface BinderProps {
  docs: Doc[];
  projectName: string;
  activeProjectId: string | null;
  onOpenProjects: () => void;
  selectedDocId: string | null;
  onSelectDoc: (id: string) => void;
  onAddDoc: (parent_id: string | null, type: DocumentType) => void;
  /** Novo Livro/Parte depois do item selecionado. */
  onAddPart: () => void;
  onDeleteDoc: (id: string) => void;
  onRenameDoc: (id: string, newTitle: string) => void;
  onDropDoc: (activeId: string, targetId: string, position: DropPosition) => void;
  onRenameProject: (name: string) => void;
  onToggleFolder: (id: string) => void;
  expandedFolders: Set<string>;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  renamingId: string | null;
  onRenameComplete: () => void;
  onUpdateDoc: (id: string, updates: Partial<Doc>) => void;
}

export const Binder: React.FC<BinderProps> = ({
  docs,
  projectName,
  activeProjectId,
  onOpenProjects,
  selectedDocId,
  onSelectDoc,
  onAddDoc,
  onAddPart,
  onDeleteDoc,
  onRenameDoc,
  onDropDoc,
  onRenameProject,
  onToggleFolder,
  expandedFolders,
  onContextMenu,
  renamingId,
  onRenameComplete,
  onUpdateDoc
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);

  // Distância de ativação: um clique (ou duplo clique para renomear) não vira arraste.
  // No toque, só um toque longo arrasta: deslizar o dedo rola a lista (antes, 5px
  // de rolagem já viravam arraste e a lista não rolava no celular).
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: COARSE_POINTER
        ? { delay: 300, tolerance: 8 }
        : { distance: 5 },
    }),
    useSensor(KeyboardSensor)
  );

  // Posição real do ponteiro durante o arraste. O `over` e os retângulos do
  // dnd-kit ficam defasados enquanto a lista rola sozinha, então o alvo e a
  // posição são lidos do DOM, embaixo do ponteiro.
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const rowAt = (x: number, y: number): HTMLElement | null => {
    for (const el of document.elementsFromPoint(x, y)) {
      const row = (el as HTMLElement).closest?.('[data-binder-id]') as HTMLElement | null;
      if (row) return row;
    }
    return null;
  };

  const computeIndicator = (activeId: string, overId: string | null): DropIndicator | null => {
    let targetId = overId;
    let y: number | null = null;
    const pointer = pointerRef.current;
    if (pointer) {
      y = pointer.y;
      const row = rowAt(pointer.x, pointer.y);
      if (row) targetId = row.dataset.binderId ?? null;
    }
    if (!targetId || targetId === activeId) return null;
    const target = docs.find(d => d.id === targetId);
    const row = document.querySelector(`[data-binder-id="${CSS.escape(targetId)}"]`);
    if (!target || !row) return null;
    const rect = row.getBoundingClientRect();
    // No teclado (sem ponteiro), usa o meio da linha-alvo.
    const position = getDropPosition(y ?? rect.top + rect.height / 2, rect, isContainer(target));
    // Só mostra o indicador onde o drop é válido (nada de pasta dentro de si mesma etc.).
    return planDrop(docs, activeId, target.id, position) ? { overId: target.id, position } : null;
  };

  const lastOverRef = useRef<string | null>(null);

  const refreshIndicator = () => {
    if (!draggingId) return;
    const next = computeIndicator(draggingId, lastOverRef.current);
    setDropIndicator(curr =>
      curr?.overId === next?.overId && curr?.position === next?.position ? curr : next
    );
  };

  useEffect(() => {
    if (!draggingId) return;
    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current = { x: e.clientX, y: e.clientY };
    };
    const container = scrollRef.current;
    window.addEventListener('pointermove', onPointerMove, true);
    // A lista rola sozinha sem o ponteiro mexer: recalcula no scroll também.
    container?.addEventListener('scroll', refreshIndicator);
    return () => {
      window.removeEventListener('pointermove', onPointerMove, true);
      container?.removeEventListener('scroll', refreshIndicator);
    };
  });

  const handleDragStart = (event: DragStartEvent) => {
    const start = event.activatorEvent as PointerEvent;
    pointerRef.current = typeof start?.clientX === 'number' ? { x: start.clientX, y: start.clientY } : null;
    lastOverRef.current = null;
    setDraggingId(event.active.id as string);
    setDropIndicator(null);
  };

  const updateIndicator = (event: DragMoveEvent | DragOverEvent) => {
    lastOverRef.current = (event.over?.id as string) ?? null;
    const next = computeIndicator(event.active.id as string, lastOverRef.current);
    setDropIndicator(curr =>
      curr?.overId === next?.overId && curr?.position === next?.position ? curr : next
    );
  };

  // No `onDragMove` o `over` ainda é o do passo anterior (o dnd-kit só o troca
  // depois, no `onDragOver`). Com o mouse o alvo vem do DOM e isso não pesa;
  // no teclado não há ponteiro, então o indicador ficava um passo atrás.
  const handleDragMove = updateIndicator;
  const handleDragOver = updateIndicator;

  const handleDragEnd = (event: DragEndEvent) => {
    const indicator = computeIndicator(event.active.id as string, (event.over?.id as string) ?? null);
    pointerRef.current = null;
    setDraggingId(null);
    setDropIndicator(null);
    if (!indicator) return;
    onDropDoc(event.active.id as string, indicator.overId, indicator.position);
  };

  const handleDragCancel = () => {
    pointerRef.current = null;
    setDraggingId(null);
    setDropIndicator(null);
  };

  const draggingDoc = draggingId ? docs.find(d => d.id === draggingId) : null;

  // ---- Toque (celular/tablet): toque longo parado = menu; toque longo + mover = arrastar.
  const [touchItem, setTouchItem] = useState<{ id: string; state: 'armed' | 'dragging' } | null>(null);
  const [touchGhost, setTouchGhost] = useState<{ x: number; y: number } | null>(null);
  const lastTouchGestureAt = useRef(0);

  // No Android o toque longo também dispara o contextmenu nativo; o menu já
  // veio do gesto, então esse é ignorado.
  const handleRowContextMenu = (e: React.MouseEvent, id: string) => {
    if (Date.now() - lastTouchGestureAt.current < 1000) {
      e.preventDefault();
      return;
    }
    onContextMenu(e, id);
  };

  // Os listeners nativos ficam presos uma vez; leem o estado atual por aqui.
  const latest = useRef({ computeIndicator, onDropDoc, onContextMenu });
  latest.current = { computeIndicator, onDropDoc, onContextMenu };

  useEffect(() => {
    if (!COARSE_POINTER) return;
    const container = scrollRef.current;
    if (!container) return;
    let g: GestureState & { id: string | null } = { ...idleGesture, id: null };
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;
    let indicator: DropIndicator | null = null;
    let last = { x: 0, y: 0 };

    const clearTimer = () => { if (timer) { clearTimeout(timer); timer = null; } };
    const reset = () => {
      clearTimer();
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      g = { ...idleGesture, id: null };
      indicator = null;
      pointerRef.current = null;
      setTouchItem(null);
      setTouchGhost(null);
      setDraggingId(null);
      setDropIndicator(null);
    };
    const updateDrag = () => {
      if (!g.id) return;
      pointerRef.current = { x: last.x, y: last.y };
      const next = latest.current.computeIndicator(g.id, null);
      indicator = next;
      setDropIndicator(curr => (curr?.overId === next?.overId && curr?.position === next?.position ? curr : next));
    };
    // Rolagem da gaveta enquanto o dedo está perto da borda de cima ou de baixo.
    const tick = () => {
      frame = 0;
      if (g.phase !== 'dragging') return;
      const rect = container.getBoundingClientRect();
      const speed = autoScrollSpeed(last.y, rect.top, rect.bottom);
      if (speed) {
        container.scrollTop += speed;
        updateDrag();
      }
      frame = requestAnimationFrame(tick);
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) { reset(); return; }
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, button')) return;
      const row = target.closest('[data-binder-id]') as HTMLElement | null;
      if (!row) return;
      const t = e.touches[0];
      clearTimer();
      last = { x: t.clientX, y: t.clientY };
      g = { phase: 'pressing', startX: t.clientX, startY: t.clientY, id: row.dataset.binderId ?? null };
      timer = setTimeout(() => {
        timer = null;
        if (g.phase !== 'pressing' || !g.id) return;
        g = { ...g, phase: 'armed' };
        setTouchItem({ id: g.id, state: 'armed' });
        try { navigator.vibrate?.(12); } catch { /* sem vibração */ }
      }, LONG_PRESS_MS);
    };

    const onMove = (e: TouchEvent) => {
      if (g.phase === 'idle' || !g.id) return;
      const t = e.touches[0];
      if (!t) return;
      last = { x: t.clientX, y: t.clientY };
      const phase = onTouchMovePhase(g, t.clientX, t.clientY);
      if (phase === 'idle') { clearTimer(); g = { ...idleGesture, id: null }; return; }
      if (g.phase === 'armed' || g.phase === 'dragging') e.preventDefault(); // segurou: a lista não rola
      if (phase === 'dragging') {
        if (g.phase !== 'dragging') {
          setTouchItem({ id: g.id, state: 'dragging' });
          setDraggingId(g.id);
        }
        g = { ...g, phase };
        setTouchGhost({ x: t.clientX, y: t.clientY });
        updateDrag();
        if (!frame) frame = requestAnimationFrame(tick);
      }
    };

    const onEnd = (e: TouchEvent) => {
      const action = onTouchEndAction(g);
      const id = g.id;
      const drop = indicator;
      if (action !== 'none') {
        // Sem o clique sintético: ele abriria o item e fecharia a gaveta.
        if (e.cancelable) e.preventDefault();
        lastTouchGestureAt.current = Date.now();
      }
      reset();
      if (!id) return;
      if (action === 'menu') {
        latest.current.onContextMenu(
          { clientX: last.x, clientY: last.y, preventDefault: () => {} } as unknown as React.MouseEvent,
          id,
        );
      } else if (action === 'drop' && drop) {
        latest.current.onDropDoc(id, drop.overId, drop.position);
      }
    };

    container.addEventListener('touchstart', onStart, { passive: true });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onEnd, { passive: false });
    container.addEventListener('touchcancel', reset);
    return () => {
      container.removeEventListener('touchstart', onStart);
      container.removeEventListener('touchmove', onMove);
      container.removeEventListener('touchend', onEnd);
      container.removeEventListener('touchcancel', reset);
      clearTimer();
      if (frame) cancelAnimationFrame(frame);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const touchDoc = touchItem?.state === 'dragging' ? docs.find(d => d.id === touchItem.id) : null;

  // Flat full-text results — shown while a search is active so matches inside
  // collapsed folders surface too (the tree only renders expanded branches).
  const renderSearchResults = () => {
    const results = docs
      .filter((d) => !isInTrash(docs, d.id) && matchesSearch(d, searchQuery))
      .sort((a, b) => a.title.localeCompare(b.title));

    if (results.length === 0) {
      return (
        <div className="px-4 py-6 text-center text-[12px] italic text-[#8A877F]">
          No matches for “{searchQuery}”.
        </div>
      );
    }

    return results.map((doc) => (
      <div
        key={doc.id}
        className={cn('binder-item group', selectedDocId === doc.id && 'selected')}
        style={{ paddingLeft: '12px' }}
        onClick={() => onSelectDoc(doc.id)}
      >
        <div className="mr-1.5 text-[#5A5A5A] flex items-center shrink-0">{getDocIcon(doc)}</div>
        {labelColorOf(doc.metadata) && (
          <div
            className="w-2 h-2 rounded-full mr-2 shadow-sm shrink-0"
            style={{ backgroundColor: labelColorOf(doc.metadata)! }}
          />
        )}
        <span className="flex-1 truncate text-[13px] tracking-tight">{doc.title}</span>
      </div>
    ));
  };

  const renderChildren = (parent_id: string | null, depth: number = 0) => {
    const children = getSortedChildren(docs, parent_id);

    if (children.length === 0) return null;

    return (
      <>
        {children.map(doc => {
          return (
            <SortableBinderItem
              key={doc.id}
              doc={doc}
              depth={depth}
              isSelected={selectedDocId === doc.id}
              is_expanded={expandedFolders.has(doc.id)}
              onSelect={onSelectDoc}
              onToggle={onToggleFolder}
              onAdd={onAddDoc}
              onDelete={onDeleteDoc}
              onRename={onRenameDoc}
              onContextMenu={handleRowContextMenu}
              isRenaming={renamingId === doc.id}
              onRenameComplete={onRenameComplete}
              childrenDocs={docs.filter(d => d.parent_id === doc.id)}
              renderChildren={renderChildren}
              dropPosition={dropIndicator?.overId === doc.id ? dropIndicator.position : null}
              touchMode={COARSE_POINTER}
              touchState={touchItem?.id === doc.id ? touchItem.state : null}
            />
          );
        })}
      </>
    );
  };

  return (
    <div className="flex flex-col h-full binder-container w-full">
      {/* Project Switcher Header */}
      <div className="p-3 border-b border-[#333] bg-black/10">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Projeto Ativo</span>
          <button 
            onClick={onOpenProjects}
            className="p-1 hover:bg-black/20 rounded transition-colors text-gray-400 group"
            title="Gerenciar Projetos"
          >
            <ChevronDown className="w-4 h-4 group-hover:text-blue-400" />
          </button>
        </div>
        {isEditingProjectName ? (
          <div className="w-full flex items-center gap-2 p-2">
            <div className="w-8 h-8 rounded bg-blue-600/20 flex items-center justify-center shrink-0">
              <Folder className="w-4 h-4 text-blue-400" />
            </div>
            <InlineNameInput
              initialValue={projectName}
              ariaLabel="Nome do livro"
              className="flex-1 min-w-0 bg-white border border-[#5B7A3D] rounded px-1 text-sm text-gray-900 focus:outline-none"
              onCommit={(name) => {
                setIsEditingProjectName(false);
                onRenameProject(name);
              }}
              onCancel={() => setIsEditingProjectName(false)}
            />
          </div>
        ) : (
          <div className="w-full flex items-center gap-1 group/name">
            <button
              onClick={onOpenProjects}
              className="flex-1 min-w-0 flex items-center gap-2 p-2 hover:bg-black/10 rounded-lg transition-all text-left"
            >
              <div className="w-8 h-8 rounded bg-blue-600/20 flex items-center justify-center shrink-0">
                <Folder className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <div className="text-sm font-medium text-gray-200 truncate">{projectName}</div>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingProjectName(true);
              }}
              disabled={!activeProjectId}
              className="p-1.5 rounded text-gray-400 opacity-40 group-hover/name:opacity-100 hover:bg-black/20 hover:text-blue-400 transition-opacity shrink-0"
              title="Renomear livro"
              aria-label="Renomear livro"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="binder-header border-none p-0">Binder</h2>
          <div className="flex gap-1">
            <button 
              onClick={() => onAddDoc(null, 'folder')}
              className="macos-btn w-6 h-6"
              title="Novo Grupo"
            >
              <FolderPlus size={14} />
            </button>
            <button 
              onClick={() => onAddDoc(null, 'text')}
              className="macos-btn w-6 h-6"
              title="Novo Texto"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={onAddPart}
              className="macos-btn w-6 h-6"
              title="Novo Livro / Parte (depois do item selecionado)"
            >
              <BookMarked size={14} />
            </button>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A877F]" size={12} />
          <input 
            type="text" 
            placeholder="Search..." 
            className="binder-search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-y-auto py-1 scrivener-scrollbar">
        {searchQuery.trim() ? (
          renderSearchResults()
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={binderCollision}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            {renderChildren(null)}
            <DragOverlay dropAnimation={null} modifiers={[offsetOverlay]}>
              {draggingDoc ? (
                <div className="binder-item selected inline-flex w-auto max-w-[220px] shadow-lg rounded opacity-80 pointer-events-none">
                  <div className="mr-1.5 text-[#5A5A5A] flex items-center shrink-0">{getDocIcon(draggingDoc)}</div>
                  <span className="flex-1 truncate text-[13px] tracking-tight">{draggingDoc.title}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
        {touchDoc && touchGhost && (
          <div
            className="touch-drag-ghost binder-item selected"
            style={{ left: touchGhost.x + 12, top: touchGhost.y - 44 }}
            aria-hidden="true"
          >
            <div className="mr-1.5 text-[#5A5A5A] flex items-center shrink-0">{getDocIcon(touchDoc)}</div>
            <span className="flex-1 truncate text-[13px] tracking-tight">{touchDoc.title}</span>
          </div>
        )}
      </div>

      <div className="p-2 border-t border-[#333] flex items-center justify-between bg-black/10">
        <div className="flex gap-0.5">
          <button onClick={() => onAddDoc(null, 'text')} className="macos-btn w-6 h-6" title="Add Document">
            <Plus size={14} />
          </button>
          <button onClick={() => onAddDoc(null, 'folder')} className="macos-btn w-6 h-6" title="Add Folder">
            <FolderPlus size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
