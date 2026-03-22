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
  Settings
} from 'lucide-react';
import { Doc, DocumentType } from '../types';
import { ICONS, FOLDER_COLORS } from '../constants';
import { getDocIcon } from '../utils/getDocIcon';
import { cn } from '../lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';



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
  renderChildren
}: SortableBinderItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: doc.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(doc.title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      setIsEditing(true);
    }
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
    <div ref={setNodeRef} style={style} className="select-none">
      <div
        className={cn(
          "binder-item group",
          isSelected && "selected"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(doc.id)}
        onDoubleClick={() => setIsEditing(true)}
        onContextMenu={(e) => onContextMenu(e, doc.id)}
      >
        <div
          className="w-4 h-4 mr-0.5 flex items-center justify-center cursor-default"
          onClick={(e) => {
            if (doc.type === 'folder' || doc.type === 'research' || doc.type === 'characters' || doc.type === 'places' || doc.type === 'front-matter') {
              e.stopPropagation();
              onToggle(doc.id);
            }
          }}
        >
          {(doc.type === 'folder' || doc.type === 'research' || doc.type === 'characters' || doc.type === 'places' || doc.type === 'front-matter') && (
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
  onReorderDocs: (activeId: string, overId: string) => void;
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
  onReorderDocs,
  onToggleFolder,
  expandedFolders,
  onContextMenu,
  renamingId,
  onRenameComplete,
  onUpdateDoc
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      onReorderDocs(active.id as string, over.id as string);
    }
  };

  const renderChildren = (parent_id: string | null, depth: number = 0) => {
    const children = docs
      .filter(d => d.parent_id === parent_id)
      .sort((a, b) => a.order - b.order);

    if (children.length === 0) return null;

    return (
      <SortableContext
        items={children.map(d => d.id)}
        strategy={verticalListSortingStrategy}
      >
        {children.map(doc => {
          if (searchQuery && !doc.title.toLowerCase().includes(searchQuery.toLowerCase())) {
            return null;
          }

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
            />
          );
        })}
      </SortableContext>
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
        <button 
          onClick={onOpenProjects}
          className="w-full flex items-center gap-2 p-2 hover:bg-black/10 rounded-lg transition-all text-left group"
        >
          <div className="w-8 h-8 rounded bg-blue-600/20 flex items-center justify-center shrink-0">
            <Folder className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-gray-200 truncate">{projectName}</div>
          </div>
        </button>
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
      
      <div className="flex-1 overflow-y-auto py-1 scrivener-scrollbar">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {renderChildren(null)}
        </DndContext>
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
