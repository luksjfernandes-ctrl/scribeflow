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
  Pencil
} from 'lucide-react';
import { Doc, DocumentType } from '../types';
import { ICONS, FOLDER_COLORS } from '../constants';
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
  dropPosition
}: SortableBinderItemProps) {
  // Arrasta pelo puxador; o alvo de soltura é só a linha (sem os filhos),
  // senão uma pasta aberta cobre a área de todos os filhos e "rouba" o drop.
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({ id: doc.id });
  const { setNodeRef: setDropRef } = useDroppable({ id: doc.id });

  const style = { opacity: isDragging ? 0.4 : 1 };

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

  const wordCount = (doc.content || '').replace(/<[^>]*>/g, '').split(/\s+/).filter(Boolean).length;

  return (
    <div ref={setDragRef} style={style} className="select-none">
      <div
        ref={setDropRef}
        data-binder-id={doc.id}
        className={cn(
          "binder-item group relative",
          isSelected && "selected",
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
          className="w-4 h-4 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity shrink-0 mr-1"
          {...attributes}
          {...listeners}
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

        <div
          className="w-4 h-4 mr-0.5 flex items-center justify-center cursor-default"
          onClick={(e) => {
            if (doc.type === 'folder' || doc.type === 'research' || doc.type === 'characters' || doc.type === 'places' || doc.type === 'front-matter' || doc.type === 'trash') {
              e.stopPropagation();
              onToggle(doc.id);
            }
          }}
        >
          {(doc.type === 'folder' || doc.type === 'research' || doc.type === 'characters' || doc.type === 'places' || doc.type === 'front-matter' || doc.type === 'trash') && (
            <div
              className={cn("disclosure-triangle", is_expanded && "expanded")}
              dangerouslySetInnerHTML={{ __html: is_expanded ? ICONS.disclosureExpanded : ICONS.disclosure }}
            />
          )}
        </div>

        <div className="mr-1.5 text-[#5A5A5A] flex items-center shrink-0">
          {getDocIcon(doc)}
        </div>

        {doc.metadata.label_color && doc.metadata.label_color !== 'transparent' && (
          <div
            className="w-2 h-2 rounded-full mr-2 shadow-sm"
            style={{ backgroundColor: doc.metadata.label_color }}
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
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
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

  // Flat full-text results — shown while a search is active so matches inside
  // collapsed folders surface too (the tree only renders expanded branches).
  const renderSearchResults = () => {
    const results = docs
      .filter((d) => d.metadata?.folder_role !== 'trash' && matchesSearch(d, searchQuery))
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
        {doc.metadata.label_color && doc.metadata.label_color !== 'transparent' && (
          <div
            className="w-2 h-2 rounded-full mr-2 shadow-sm shrink-0"
            style={{ backgroundColor: doc.metadata.label_color }}
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
              onContextMenu={onContextMenu}
              isRenaming={renamingId === doc.id}
              onRenameComplete={onRenameComplete}
              childrenDocs={docs.filter(d => d.parent_id === doc.id)}
              renderChildren={renderChildren}
              dropPosition={dropIndicator?.overId === doc.id ? dropIndicator.position : null}
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
