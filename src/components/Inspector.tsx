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
  MessageSquare,
} from 'lucide-react';
import { Doc, Snapshot, Bookmark, Keyword, Comment } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { safeUrl } from '../utils/sanitize';
import { LABEL_OPTIONS, STATUS_OPTIONS } from '../lib/metadataLabels';

export type InspectorTab = 'notes' | 'bookmarks' | 'metadata' | 'snapshots' | 'comments';

interface InspectorProps {
  doc: Doc | null;
  tab: InspectorTab;
  onTabChange: (tab: InspectorTab) => void;
  onUpdateMetadata: (id: string, metadata: Partial<Doc['metadata']>) => void;
  onRestoreSnapshot?: (snapshot: Snapshot) => void;
  onUpdateComment?: (id: string, text: string) => void;
  onDeleteComment?: (id: string) => void;
  onSelectComment?: (id: string) => void;
  onTogglePart?: (id: string) => void;
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

export function Inspector({
  doc,
  tab,
  onTabChange,
  onUpdateMetadata,
  onRestoreSnapshot,
  onUpdateComment,
  onDeleteComment,
  onSelectComment,
  onTogglePart,
}: InspectorProps) {
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
          <p className="text-sm font-serif italic">Selecione um documento para ver os detalhes.</p>
        </div>
      </div>
    );
  }

  const metadata = doc.metadata;
  const keywords: Keyword[] = metadata.keywords || [];
  const bookmarks: Bookmark[] = metadata.bookmarks || [];
  const snapshots: Snapshot[] = metadata.snapshots || [];
  const comments: Comment[] = metadata.comments || [];
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
    const url = safeUrl(bookmarkUrl);
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
      title: doc.title || 'Sem título',
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
    { id: 'notes', icon: <StickyNote size={14} />, title: 'Sinopse e notas' },
    { id: 'bookmarks', icon: <BookmarkIcon size={14} />, title: 'Referências' },
    { id: 'metadata', icon: <Info size={14} />, title: 'Palavras-chave e campos' },
    { id: 'comments', icon: <MessageSquare size={14} />, title: 'Comentários' },
    { id: 'snapshots', icon: <Camera size={14} />, title: 'Versões guardadas' },
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
            onClick={() => onTabChange(t.id)}
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
              <div className="synopsis-card-header">SINOPSE</div>
              <textarea
                className="synopsis-card-body scrivener-scrollbar"
                placeholder="Escreva uma sinopse curta..."
                value={metadata.synopsis}
                onChange={(e) => onUpdateMetadata(doc.id, { synopsis: e.target.value })}
              />
            </div>

            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <div className="inspector-section-header">RÓTULO</div>
                <select
                  className="inspector-dropdown"
                  value={metadata.label}
                  onChange={(e) => onUpdateMetadata(doc.id, { label: e.target.value })}
                >
                  {LABEL_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="inspector-section-header">STATUS</div>
                <select
                  className="inspector-dropdown"
                  value={metadata.status}
                  onChange={(e) => onUpdateMetadata(doc.id, { status: e.target.value })}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <div className="inspector-section-header">NOTAS</div>
                <textarea
                  className="inspector-notes scrivener-scrollbar"
                  placeholder="Notas gerais..."
                  value={metadata.notes}
                  onChange={(e) => onUpdateMetadata(doc.id, { notes: e.target.value })}
                />
              </div>

              <div className="px-3 pt-4 space-y-3">
                {doc.type === 'text' && (
                  <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                    <input
                      type="checkbox"
                      id="is-part"
                      checked={metadata.section_type === 'Part'}
                      onChange={() => onTogglePart?.(doc.id)}
                      className="rounded border-border-color text-accent-color focus:ring-accent-color/20"
                    />
                    <label htmlFor="is-part" className="font-medium">
                      Livro / Parte (página de título)
                    </label>
                  </div>
                )}
                <div className="flex items-center gap-2 text-[11px] text-text-secondary">
                  <input
                    type="checkbox"
                    id="include-compile"
                    checked={metadata.is_include_in_compile}
                    onChange={(e) => onUpdateMetadata(doc.id, { is_include_in_compile: e.target.checked })}
                    className="rounded border-border-color text-accent-color focus:ring-accent-color/20"
                  />
                  <label htmlFor="include-compile" className="font-medium">
                    Incluir na exportação
                  </label>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ========================== BOOKMARKS ========================== */}
        {tab === 'bookmarks' && (
          <div className="py-2">
            <div className="inspector-section-header">REFERÊNCIAS</div>
            <div className="px-3 space-y-2">
              {bookmarks.length === 0 && (
                <p className="text-[11px] italic text-text-secondary opacity-60 py-2">
                  Nenhuma referência ainda. Acrescente um título ou um link abaixo.
                </p>
              )}
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="group flex items-center justify-between gap-2 rounded-md border border-[#C5C2BA] bg-white/70 px-2 py-1.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-[#3A3A3A] font-medium">{bm.title}</div>
                    {safeUrl(bm.url) && (
                      <a
                        href={safeUrl(bm.url)!}
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
                    title="Remover referência"
                    onClick={() => removeBookmark(bm.id)}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}

              <div className="space-y-1 pt-2">
                <input
                  className="inspector-input"
                  placeholder="Título da referência"
                  value={bookmarkTitle}
                  onChange={(e) => setBookmarkTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBookmark()}
                />
                <input
                  className="inspector-input"
                  placeholder="https://… (opcional)"
                  value={bookmarkUrl}
                  onChange={(e) => setBookmarkUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addBookmark()}
                />
                <button className="inspector-add-btn" onClick={addBookmark}>
                  <Plus size={12} /> Adicionar referência
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
              <div className="inspector-section-header">PALAVRAS-CHAVE</div>
              <div className="px-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {keywords.length === 0 && (
                    <p className="text-[11px] italic text-text-secondary opacity-60">Nenhuma palavra-chave.</p>
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
                        title="Remover palavra-chave"
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
                    placeholder="Nova palavra-chave…"
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
              <div className="inspector-section-header">TIPO DE SEÇÃO</div>
              <input
                className="inspector-dropdown"
                value={metadata.section_type}
                onChange={(e) => onUpdateMetadata(doc.id, { section_type: e.target.value })}
                placeholder="Cena, capítulo…"
              />
            </div>

            <div>
              <div className="inspector-section-header">META DE PALAVRAS</div>
              <input
                type="number"
                min={0}
                className="inspector-dropdown"
                value={metadata.target_word_count || 0}
                onChange={(e) =>
                  onUpdateMetadata(doc.id, { target_word_count: parseInt(e.target.value) || 0 })
                }
              />
              {(metadata.target_word_count || 0) > 0 &&
                (() => {
                  const words = wordCount(doc.content);
                  const target = metadata.target_word_count;
                  const pct = Math.min(100, Math.round((words / target) * 100));
                  return (
                    <div className="px-3 pt-2">
                      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#40A040' : '#5B7A3D' }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-[10px] text-text-secondary">
                        <span>{words} palavras</span>
                        <span>{pct}%</span>
                      </div>
                    </div>
                  );
                })()}
            </div>

            {/* Custom metadata */}
            <div>
              <div className="inspector-section-header">CAMPOS PERSONALIZADOS</div>
              <div className="px-3 space-y-2">
                {Object.keys(customMetadata).length === 0 && (
                  <p className="text-[11px] italic text-text-secondary opacity-60">Nenhum campo personalizado.</p>
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
                      title="Remover campo"
                      onClick={() => removeCustomField(key)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
                <div className="flex gap-1 pt-1">
                  <input
                    className="inspector-input w-1/3"
                    placeholder="Campo"
                    value={metaKey}
                    onChange={(e) => setMetaKey(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
                  />
                  <input
                    className="inspector-input flex-1"
                    placeholder="Valor"
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
                <span>Criado</span>
                <span className="text-text-primary">{format(metadata.created_at, 'd MMM yyyy', { locale: ptBR })}</span>
              </div>
              <div className="flex items-center justify-between text-[10px] uppercase tracking-wider font-bold text-text-secondary">
                <span>Modificado</span>
                <span className="text-text-primary">{format(metadata.updated_at, 'd MMM yyyy', { locale: ptBR })}</span>
              </div>
            </div>
          </div>
        )}

        {/* ========================== SNAPSHOTS ========================== */}
        {tab === 'snapshots' && (
          <div className="py-2">
            <div className="px-3 pt-1 pb-2">
              <button className="inspector-add-btn" onClick={takeSnapshot}>
                <Camera size={12} /> Guardar esta versão
              </button>
            </div>
            <div className="px-3 space-y-2">
              {snapshots.length === 0 && (
                <p className="text-[11px] italic text-text-secondary opacity-60 py-2">
                  Nenhuma versão guardada. Guarde o texto como está agora para poder voltar a ele depois.
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
                        {format(snap.timestamp, 'd MMM yyyy · HH:mm', { locale: ptBR })} · {wordCount(snap.content)} palavras
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className="rounded p-1 text-text-secondary hover:bg-black/5 hover:text-accent-color"
                        title="Voltar para esta versão"
                        onClick={() => restoreSnapshot(snap)}
                      >
                        <RotateCcw size={13} />
                      </button>
                      <button
                        className="rounded p-1 text-text-secondary hover:bg-black/5 hover:text-[#E05050]"
                        title="Apagar esta versão"
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

        {/* ========================== COMMENTS ========================== */}
        {tab === 'comments' && (
          <div className="py-2">
            <div className="inspector-section-header">COMENTÁRIOS</div>
            <div className="px-3 space-y-2">
              {comments.length === 0 && (
                <p className="text-[11px] italic text-text-secondary opacity-60 py-2">
                  Selecione um trecho no editor e clique no botão de comentário para anotar.
                </p>
              )}
              {comments.map((c) => (
                <div
                  key={c.id}
                  className="group rounded-md border border-[#D4C78A] bg-[#FFFDE8] overflow-hidden"
                  style={{ borderLeft: `3px solid ${c.color || '#FFD66B'}` }}
                >
                  <div className="flex items-start justify-between gap-2 px-2.5 pt-2">
                    <button
                      className="min-w-0 flex-1 text-left"
                      title="Ir até o comentário no texto"
                      onClick={() => onSelectComment?.(c.id)}
                    >
                      {c.quote && (
                        <span className="block truncate text-[11px] italic text-[#7A6A2A]">
                          “{c.quote}”
                        </span>
                      )}
                      <span className="block text-[9px] uppercase tracking-wider text-text-secondary">
                        {c.author} · {format(c.timestamp, 'd MMM, HH:mm', { locale: ptBR })}
                      </span>
                    </button>
                    <button
                      className="shrink-0 text-text-secondary opacity-0 group-hover:opacity-100 hover:text-[#E05050]"
                      title="Apagar comentário"
                      onClick={() => onDeleteComment?.(c.id)}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <textarea
                    className="w-full bg-transparent px-2.5 py-1.5 text-[12px] text-[#3A3A3A] outline-none resize-none scrivener-scrollbar"
                    rows={2}
                    placeholder="Escreva um comentário…"
                    value={c.text}
                    onChange={(e) => onUpdateComment?.(c.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
