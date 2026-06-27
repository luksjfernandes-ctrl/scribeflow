import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';
import { Doc } from '../types';
import { getDocIcon } from '../utils/getDocIcon';

interface QuickSearchProps {
  docs: Doc[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

const strip = (html: string) =>
  (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Build a short excerpt centered on the first match of `query`. */
const excerpt = (text: string, query: string): string => {
  if (!text) return '';
  const idx = text.toLowerCase().indexOf(query);
  if (idx === -1) return text.slice(0, 80);
  const start = Math.max(0, idx - 30);
  const end = Math.min(text.length, idx + query.length + 50);
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
};

export function QuickSearch({ docs, onSelect, onClose }: QuickSearchProps) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    // Never surface the Trash folder itself; documents inside still match.
    const pool = docs.filter((d) => d.metadata?.folder_role !== 'trash');
    if (!query) {
      return pool
        .filter((d) => d.type === 'text')
        .sort((a, b) => (b.metadata?.updated_at || 0) - (a.metadata?.updated_at || 0))
        .slice(0, 20);
    }
    return pool
      .filter((d) => {
        const inTitle = d.title.toLowerCase().includes(query);
        const inSynopsis = (d.metadata?.synopsis || '').toLowerCase().includes(query);
        const inContent = strip(d.content).toLowerCase().includes(query);
        return inTitle || inSynopsis || inContent;
      })
      .slice(0, 50);
  }, [q, docs]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (id: string) => {
    onSelect(id);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[active]) choose(results[active].id);
    }
  };

  const query = q.trim().toLowerCase();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/40 backdrop-blur-sm pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl mx-4 rounded-xl bg-[#F5F3ED] shadow-2xl border border-black/10 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 border-b border-black/10">
          <Search size={16} className="text-[#8A877F]" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Go to document or search text…"
            className="flex-1 bg-transparent py-3.5 text-[15px] text-[#3A3A3A] outline-none placeholder:text-[#A8A59D]"
          />
          <kbd className="text-[10px] text-[#A8A59D] border border-black/10 rounded px-1.5 py-0.5">esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[50vh] overflow-y-auto scrivener-scrollbar py-1">
          {results.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] italic text-[#8A877F]">No documents found.</div>
          )}
          {results.map((doc, i) => {
            const synopsis = doc.metadata?.synopsis || '';
            const inTitle = query && doc.title.toLowerCase().includes(query);
            let preview = synopsis ? strip(synopsis) : strip(doc.content);
            if (query && !inTitle) {
              const synLower = synopsis.toLowerCase();
              const source =
                synLower.includes(query) ? strip(synopsis) : strip(doc.content);
              preview = excerpt(source, query);
            } else {
              preview = preview.slice(0, 90);
            }

            return (
              <button
                key={doc.id}
                data-idx={i}
                onClick={() => choose(doc.id)}
                onMouseEnter={() => setActive(i)}
                className={`w-full flex items-center gap-3 px-4 py-2 text-left ${
                  i === active ? 'bg-[#5B7A3D] text-white' : 'hover:bg-black/[0.04] text-[#3A3A3A]'
                }`}
              >
                <span className={i === active ? 'opacity-90' : 'text-[#5A5A5A]'}>{getDocIcon(doc)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{doc.title || 'Untitled'}</span>
                  {preview && (
                    <span
                      className={`block truncate text-[11px] ${i === active ? 'text-white/70' : 'text-[#8A877F]'}`}
                    >
                      {preview}
                    </span>
                  )}
                </span>
                {i === active && <CornerDownLeft size={13} className="opacity-70 shrink-0" />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-4 py-2 border-t border-black/10 text-[10px] text-[#8A877F]">
          <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
          <span className="flex items-center gap-2">
            <kbd className="border border-black/10 rounded px-1">↑</kbd>
            <kbd className="border border-black/10 rounded px-1">↓</kbd>
            to navigate
          </span>
        </div>
      </div>
    </div>
  );
}
