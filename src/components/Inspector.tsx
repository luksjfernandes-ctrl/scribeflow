import React, { useState } from 'react';
import {
  Info,
  Bookmark as BookmarkIcon,
  StickyNote,
  Camera,
  Plus,
  X,
  Trash2,
  RotateCcw,
  ExternalLink,
} from 'lucide-react';
import { Doc, Snapshot, Bookmark, Keyword } from '../types';
import { format } from 'date-fns';

type InspectorTab = 'notes' | 'bookmarks' | 'metadata' | 'snapshots';

interface InspectorProps {
  doc: Doc | null;
  onUpdateMetadata: (id: string, metadata: Partial<Doc['metadata']>) => void;
  onRestoreSnapshot?: (snapshot: Snapshot) => void;
}

const KEYWORD_PALETTE = ['#E05050', '#E08030', '#D0B020', '#40A040', '#4070D0', '#8040D0', '#0F9B8E'];

const uid = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const wordCount = (html: string) => {
  const text = stripHtml(html);
  return text ? text.split(' ').length : 0;
};

export function Inspector({ doc, onUpdateMetadata, onRestoreSnapshot }: InspectorProps) {
  const [tab, setTab] = useState<InspectorTab>('notes');

  // Local form state for the various "add" inputs
  const [keywordDraft, setKeywordDraft] = useState('');
  const [bookmarkTitle, setBookmarkTitle] = useState('');
  const [bookmarkUrl, setBookmarkUrl] = useState('');
  const [metaKey, setMetaKey] = useState('');
  const [metaValue, setMetaValue] = useState('');

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

  const metadata = doc.metadata;
  const keywords: Keyword[] = metadata.keywords || [];
  const bookmarks: Bookmark[] = metadata.bookmarks || [];
  const snapshots: Snapshot[] = metadata.snapshots || [];
  const customMetadata: Record<string, string> = metadata.custom_metadata || {};

  /* ---------------------------- Keywords ---------------------------- */
  const addKeyword = () => {
    const text = keywordDraft.trim();
    if (!text) return;
    if (keywords.some((k) => k.text.toLowerCase() === text.toLowerCase())) {
      setKeywordDraft('');
      return;
    }
    const color = KEYWORD_PALETTE[keywords.length % KEYWORD_PALETTE.length];
    onUpdateMetadata(doc.id, { keywords: [...keywords, { text, color }] });
    setKeywordDraft('');
  };

  const removeKeyword = (text: string) => {
    onUpdateMetadata(doc.id, { keywords: keywords.filter((k) => k.text !== text) });
  };

  /* ---------------------------- Bookmarks --------------------------- */
  const addBookmark = () => {
    const title = bookmarkTitle.trim();
    if (!title) return;
    const url = bookmarkUrl.trim();
    const bm: Bookmark = { id: uid(), title, ...(url ? { url } : {}) };
    onUpdateMetadata(doc.id, { bookmarks: [...bookmarks, bm] });
    setBookmarkTitle('');
    setBookmarkUrl('');
  };

  const removeBookmark = (id: string) => {
    onUpdateMetadata(doc.id, { bookmarks: bookmarks.filter((b) => b.id !== id) });
  };

  /* ------------------------- Custom metadata ------------------------ */
  const addCustomField = () => {
    const key = metaKey.trim();
    if (!key) return;
    onUpdateMetadata(doc.id, { custom_metadata: { ...customMetadata, [key]: metaValue.trim() } });
    setMetaKey('');
    setMetaValue('');
  };

  const removeCustomField = (key: string) => {
    const next = { ...customMetadata };
    delete next[key];
    onUpdateMetadata(doc.id, { custom_metadata: next });
  };

  /* ---------------------------- Snapshots --------------------------- */
  const takeSnapshot = () => {
    const snapshot: Snapshot = {
      id: uid(),
      timestamp: Date.now(),
      title: doc.title || 'Untitled',
      content: doc.content || '',
    };
    onUpdateMetadata(doc.id, { snapshots: [snapshot, ...snapshots] });
  };

  const deleteSnapshot = (id: string) => {
    onUpdateMetadata(doc.id, { snapshots: snapshots.filter((s) => s.id !== id) });
  };

  const restoreSnapshot = (snapshot: Snapshot) => {
    onRestoreSnapshot?.(snapshot);
  };

  const tabs: { id: InspectorTab; icon: React.ReactNode; title: string }[] = [
    { id: 'notes', icon: <StickyNote size={14} />, title: 'Synopsis & Notes' },
    { id: 'bookmarks', icon: <BookmarkIcon size={14} />, title: 'Bookmarks' },
    { id: 'metadata', icon: <Info size={14} />, title: 'Metadata & Keywords' },
    { id: 'snapshots', icon: <Camera size={14} />, title: 'Snapshots' },
  ];

  return (
    <div className="inspector-container flex flex-col h-full overflow-hidden">
      {/* Inspector Tabs */}
      <div className="inspector-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`inspector-tab${tab === t.id ? ' active' : ''}`}
            title={t.title}
            onClick={() => setTab(t.id)}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrivener-scrollbar pb-6">
        {/* ============================ NOTES ============================ */}
        {tab === 'notes' && (
          <>
            <div className="synopsis-card">
              <div className="synopsis-card-header">SYNOPSIS</div>
              <textarea
                className="synopsis-card-body scrivener-scrollbar"
                placeholder="Write a brief synopsis..."
                value={metadata.synopsis}
                onChange={(e) => onUpdateMetadata(doc.id, { synopsis: e.target.value })}
              />
            </div>

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

              <div className="space-y-1">
                <div className="inspector-section-header">NOTES</div>
                <textarea
                  className="inspector-notes scrivener-scrollbar"
                  placeholder="General notes..."
                  value={metadata.notes}
                  onChange={(e) => onUpdateMetadata(doc.id, { notes: e.target.value })}
                />
              </div>

              <div className="px-3 pt-4 space-y-3">
                <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                  <input
                    type="checkbox"
                    id="include-compile"
                    checked={metadata.is_include_in_compile}
                    onChange={(e) => onUpdateMetadata(doc.id, { is_include_in_compile: e.target.checked })}
                    className="rounded border-border-color text-accent-color focus:ring-accent-color/20"
                  />
                  <label htmlFor="include-compile" className="font-medium">
                    Include in Compile
                  </label>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================== BOOKMARKS ========================== */}
        {tab === 'bookmarks' && (
          <div className="py-2">
            <div className="inspector-section-header">BOOKMARKS</div>
            <div className="px-3 space-y-2">
              {bookmarks.length === 0 && (
                <p className="text-[11px] italic text-text-secondary opacity-60 py-2">
                  No bookmarks yet. Add a reference or a link below.
                </p>
              )}
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="group flex items-center justify-between gap-2 rounded-md border border-[#C5C2BA] bg-white/70 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-[#3A3A3A] font-medium">{bm.title}</div>
                    {bm.url && (
                      <a
                        href={bm.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 truncate text-[10px] text-[#4070D0] hover:underline"
                      >
                        <ExternalLink size={9} /> {bm.url}
                      </a>
                    )}
                  </div>
                  <button
                    className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-[#E05050]"
                    title="Remove bookmark"
                    onClick={() => removeBookmark(bm.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              <div className="space-y-1 pt-2">
                <input
                  className="inspector-input"
                  placeholder="Bookmark title"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBookmark()}
                />
                <input
                  className="inspector-input"
                  placeholder="https://… (optional)"
                  value={bookmarkUrl}
                  onChange={(e) => setBookmarkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBookmark()}
                />
                <button className="inspector-add-btn" onClick={addBookmark}>
                  <Plus size={12} /> Add Bookmark
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================== METADATA ========================== */}
        {tab === 'metadata' && (
          <div className="py-2 space-y-4">
            {/* Keywords */}
            <div>
              <div className="inspector-section-header">KEYWORDS</div>
              <div className="px-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {keywords.length === 0 && (
                    <p className="text-[11px] italic text-text-secondary opacity-60">No keywords.</p>
                  )}
                  {keywords.map((kw) => (
                    <span
                      key={kw.text}
                      className="keyword-chip"
                      style={{
                        backgroundColor: `${kw.color}1A`,
                        borderColor: kw.color,
                        color: kw.color,
                      }}
                    >
                      {kw.text}
                      <button
                        className="hover:opacity-70"
                        title="Remove keyword"
                        onClick={() => removeKeyword(kw.text)}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1">
                  <input
                    className="inspector-input flex-1"
                    placeholder="Add keyword…"
                    value={keywordDraft}
                    onChange={(e) => setKeywordDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  />
                  <button className="inspector-add-btn shrink-0 !w-auto px-2" onClick={addKeyword}>
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Section type + target */}
            <div>
              <div className="inspector-section-header">SECTION TYPE</div>
              <input
                className="inspector-dropdown"
                value={metadata.section_type}
                onChange={(e) => onUpdateMetadata(doc.id, { section_type: e.target.value })}
                placeholder="Scene, Chapter…"
              />
            </div>

            <div>
              <div className="inspector-section-header">TARGET WORD COUNT</div>
              <input
                type="number"
                min={0}
                className="inspector-dropdown"
                value={metadata.target_word_count || 0}
                onChange={(e) =>
                  onUpdateMetadata(doc.id, { target_word_count: parseInt(e.target.value) || 0 })
                }
              />
            </div>

            {/* Custom metadata */}
            <div>
              <div className="inspector-section-header">CUSTOM METADATA</div>
              <div className="px-3 space-y-2">
                {Object.keys(customMetadata).length === 0 && (
                  <p className="text-[11px] italic text-text-secondary opacity-60">No custom fields.</p>
                )}
                {Object.entries(customMetadata).map(([key, value]) => (
                  <div key={key} className="group flex items-center gap-1">
                    <span className="w-1/3 truncate text-[11px] font-semibold text-[#5A5850]" title={key}>
                      {key}
                    </span>
                    <input
                      className="inspector-input flex-1"
                      value={value}
                      onChange={(e) =>
                        onUpdateMetadata(doc.id, {
                          custom_metadata: { ...customMetadata, [key]: e.target.value },
                        })
                      }
                    />
                    <button
                      className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-[#E05050]"
                      title="Remove field"
                      onClick={() => removeCustomField(key)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1 pt-1">
                  <input
                    className="inspector-input w-1/3"
                    placeholder="Field"
                    value={metaKey}
                    onChange={(e) => setMetaKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
                  />
                  <input
                    className="inspector-input flex-1"
                    placeholder="Value"
                    value={metaValue}
                    onChange={(e) => setMetaValue(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
                  />
                  <button className="inspector-add-btn shrink-0 !w-auto px-2" onClick={addCustomField}>
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            </div>

            {/* Dates */}
            <div className="px-3 pt-2 space-y-1 border-t border-border-color">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-text-secondary pt-2">
                <span>Created</span>
                <span className="text-text-primary">{format(metadata.created_at, 'MMM d, yyyy')}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                <span>Modified</span>
                <span className="text-text-primary">{format(metadata.updated_at, 'MMM d, yyyy')}</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================== SNAPSHOTS ========================== */}
        {tab === 'snapshots' && (
          <div className="py-2">
            <div className="px-3 pt-1 pb-2">
              <button className="inspector-add-btn" onClick={takeSnapshot}>
                <Camera size={12} /> Take Snapshot
              </button>
            </div>
            <div className="px-3 space-y-2">
              {snapshots.length === 0 && (
                <p className="text-[11px] italic text-text-secondary opacity-60 py-2">
                  No snapshots. Capture the current state of this document so you can restore it later.
                </p>
              )}
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="group rounded-md border border-[#C5C2BA] bg-white/70 px-2.5 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium text-[#3A3A3A]">{snap.title}</div>
                      <div className="text-[10px] text-text-secondary">
                        {format(snap.timestamp, 'MMM d, yyyy · HH:mm')} · {wordCount(snap.content)} words
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className="rounded p-1 text-text-secondary hover:bg-black/5 hover:text-accent-color"
                        title="Restore this snapshot"
                        onClick={() => restoreSnapshot(snap)}
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        className="rounded p-1 text-text-secondary hover:bg-black/5 hover:text-[#E05050]"
                        title="Delete snapshot"
                        onClick={() => deleteSnapshot(snap.id)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
