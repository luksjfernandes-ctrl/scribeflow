import React from 'react';
import { 
  Info, 
  Tag, 
  CheckCircle, 
  FileText, 
  Calendar, 
  Target, 
  MessageSquare,
  StickyNote
} from 'lucide-react';
import { Doc } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface InspectorProps {
  doc: Doc | null;
  onUpdateMetadata: (id: string, metadata: Partial<Doc['metadata']>) => void;
}

export function Inspector({ doc, onUpdateMetadata }: InspectorProps) {
  if (!doc) {
    return (
      <div className="inspector-container flex items-center justify-center p-8 text-center text-text-secondary">
        <div className="opacity-20 flex flex-col items-center">
          <Info size={48} className="mb-4" />
          <p className="text-sm font-serif italic">Select a document to view its metadata.</p>
        </div>
      </div>
    );
  }

  const metadata = doc.metadata || {
    status: 'To Do',
    label: 'none',
    labelColor: 'transparent',
    synopsis: '',
    notes: '',
    targetWordCount: 0,
    isIncludeInCompile: true,
    sectionType: 'Scene',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    keywords: [],
    customMetadata: {},
    snapshots: [],
    comments: [],
    bookmarks: [],
  };

  return (
    <div className="inspector-container flex flex-col h-full overflow-hidden">
      {/* Inspector Tabs */}
      <div className="inspector-tabs">
        <button className="inspector-tab active" title="Synopsis & Notes"><StickyNote size={14} /></button>
        <button className="inspector-tab" title="Bookmarks"><Tag size={14} /></button>
        <button className="inspector-tab" title="Metadata"><Info size={14} /></button>
        <button className="inspector-tab" title="Snapshots"><Calendar size={14} /></button>
      </div>

      <div className="flex-1 overflow-y-auto scrivener-scrollbar pb-6">
        {/* Synopsis Section */}
        <div className="synopsis-card">
          <div className="synopsis-card-header">SYNOPSIS</div>
          <textarea
            className="synopsis-card-body scrivener-scrollbar"
            placeholder="Write a brief synopsis..."
            value={metadata.synopsis}
            onChange={(e) => onUpdateMetadata(doc.id, { synopsis: e.target.value })}
          />
        </div>

        {/* General Metadata */}
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <div className="inspector-section-header">LABEL</div>
            <select
              className="inspector-dropdown"
              value={metadata.label}
              onChange={(e) => onUpdateMetadata(doc.id, { label: e.target.value })}
            >
              <option value="none">No Label</option>
              <option value="red">Chapter</option>
              <option value="green">Scene</option>
              <option value="blue">Research</option>
              <option value="yellow">Note</option>
            </select>
          </div>

          <div className="space-y-1">
            <div className="inspector-section-header">STATUS</div>
            <select
              className="inspector-dropdown"
              value={metadata.status}
              onChange={(e) => onUpdateMetadata(doc.id, { status: e.target.value })}
            >
              <option value="To Do">To Do</option>
              <option value="First Draft">First Draft</option>
              <option value="Revised Draft">Revised Draft</option>
              <option value="Final Draft">Final Draft</option>
            </select>
          </div>

          {/* Notes Section */}
          <div className="space-y-1">
            <div className="inspector-section-header">NOTES</div>
            <textarea
              className="inspector-notes scrivener-scrollbar"
              placeholder="General notes..."
              value={metadata.notes}
              onChange={(e) => onUpdateMetadata(doc.id, { notes: e.target.value })}
            />
          </div>

          {/* Compile Info */}
          <div className="px-3 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-[11px] text-text-secondary">
              <input 
                type="checkbox" 
                id="include-compile"
                checked={metadata.isIncludeInCompile}
                onChange={(e) => onUpdateMetadata(doc.id, { isIncludeInCompile: e.target.checked })}
                className="rounded border-border-color text-accent-color focus:ring-accent-color/20"
              />
              <label htmlFor="include-compile" className="font-medium">Include in Compile</label>
            </div>
            
            <div className="flex items-center justify-between text-[10px] text-text-secondary uppercase tracking-wider font-bold pt-2 border-t border-border-color">
              <span>Created</span>
              <span className="text-text-primary">{format(metadata.createdAt, 'MMM d, yyyy')}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
