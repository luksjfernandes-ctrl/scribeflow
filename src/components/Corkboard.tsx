import React from 'react';
import { Doc } from '../types';
import { cn } from '../lib/utils';
import { getDocIcon } from '../utils/getDocIcon';
import { ICONS, FOLDER_COLORS } from '../constants';



interface CorkboardProps {
  docs: Doc[];
  onSelectDoc: (id: string) => void;
  onUpdateSynopsis: (id: string, synopsis: string) => void;
}

const wordCount = (html: string) =>
  (html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

export function Corkboard({ docs, onSelectDoc, onUpdateSynopsis }: CorkboardProps) {
  return (
    <div className="flex-1 bg-[#E2DFD8] p-8 overflow-y-auto scrivener-scrollbar">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {docs.map((doc) => (
          <div 
            key={doc.id}
            className="bg-[#FFFDE8] ambient-shadow rounded-sm flex flex-col h-72 group cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
            onClick={() => onSelectDoc(doc.id)}
          >
            {/* Index Card Header */}
            <div className="p-4 flex items-center justify-between border-b border-[#B5B2AA]/20">
              <div className="flex items-center gap-2">
                {getDocIcon(doc)}
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#5A5A5A] truncate max-w-[140px]">
                  {doc.title}
                </span>
              </div>
              {doc.metadata.label_color && doc.metadata.label_color !== 'transparent' && (
                <div 
                  className="w-full h-1" 
                  style={{ backgroundColor: doc.metadata.label_color }}
                />
              )}
            </div>
            
            {/* Index Card Body (Synopsis) */}
            <div className="flex-1 px-4 pb-3 flex flex-col min-h-0">
              <textarea
                className="flex-1 w-full bg-transparent border-none focus:outline-none text-[13px] font-serif italic text-on-surface-variant/80 resize-none leading-relaxed placeholder:text-on-surface-variant/20"
                placeholder="No synopsis..."
                value={doc.metadata?.synopsis || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateSynopsis(doc.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
              />

              {/* Keywords */}
              {(doc.metadata?.keywords?.length ?? 0) > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {doc.metadata.keywords.slice(0, 4).map((kw) => (
                    <span
                      key={kw.text}
                      className="px-1.5 py-px rounded-full text-[9px] font-medium border"
                      style={{ backgroundColor: `${kw.color}1A`, borderColor: kw.color, color: kw.color }}
                    >
                      {kw.text}
                    </span>
                  ))}
                </div>
              )}

              {/* Target progress */}
              {(doc.metadata?.target_word_count ?? 0) > 0 && (() => {
                const words = wordCount(doc.content);
                const target = doc.metadata.target_word_count;
                const pct = Math.min(100, Math.round((words / target) * 100));
                return (
                  <div className="mt-2">
                    <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#40A040' : '#5B7A3D' }}
                      />
                    </div>
                    <div className="text-[8px] text-on-surface-variant/40 mt-0.5 text-right">
                      {words} / {target} words
                    </div>
                  </div>
                );
              })()}

              {/* Card Footer Info */}
              <div className="flex items-center justify-end mt-1">
                <span className="text-[9px] uppercase font-bold tracking-widest text-on-surface-variant/40">
                  {doc.metadata.status}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
