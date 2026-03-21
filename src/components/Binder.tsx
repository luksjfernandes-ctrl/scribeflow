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

const getDocIcon = (type: DocumentType, id: string) => {
  const color = FOLDER_COLORS[id as keyof typeof FOLDER_COLORS] || FOLDER_COLORS.manuscript;
  switch (type) {
    case 'folder': return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.folder(color) }} />;
    case 'research': return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.research }} />;
    case 'characters': return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.characters }} />;
    case 'places': return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.places }} />;
    case 'trash': return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.trash }} />;
    default: return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.textDoc(true) }} />;
  }
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
    if (e.key === 'Enter') handleRename();
    if (e.key === 'Escape') {
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
          {getDocIcon(doc.type, doc.id)}
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
}

export function Binder({
  docs,
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
  onRenameComplete
}: BinderProps) {
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
      <div className="p-3">
        <div className="flex items-center justify-between mb-3">
          <h2 className="binder-header border-none p-0">Binder</h2>
          <div className="flex gap-1">
            <button 
              onClick={() => onAddDoc(null, 'folder')}
              className="macos-btn w-6 h-6"
              title="New Folder"
            >
              <FolderPlus size={14} />
            </button>
            <button 
              onClick={() => onAddDoc(null, 'text')}
              className="macos-btn w-6 h-6"
              title="New Document"
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

      <div className="p-2 border-t border-[#C0BDB5] flex items-center justify-between bg-black/5">
        <div className="flex gap-0.5">
          <button onClick={() => onAddDoc(null, 'text')} className="macos-btn w-6 h-6" title="Add Document">
            <Plus size={14} />
          </button>
          <button onClick={() => onAddDoc(null, 'folder')} className="macos-btn w-6 h-6" title="Add Folder">
            <FolderPlus size={14} />
          </button>
        </div>
        <div className="flex gap-0.5">
          <button className="macos-btn w-6 h-6" title="Options">
            <Settings size={14} />
          </button>
          <button className="macos-btn w-6 h-6 text-red-700/70" title="Trash">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
