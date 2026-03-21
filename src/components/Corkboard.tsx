import React from 'react';
import { Doc } from '../types';
import { cn } from '../lib/utils';
import { ICONS, FOLDER_COLORS } from '../constants';

const getDocIcon = (doc: Doc) => {
  const role = doc.folder_role as keyof typeof FOLDER_COLORS;
  const color = FOLDER_COLORS[role] || FOLDER_COLORS.manuscript;
  
  if (role === 'trash') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.trash }} />;
  if (role === 'research') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.research }} />;
  if (role === 'characters') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.characters }} />;
  if (role === 'places') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.places }} />;
  
  if (doc.type === 'folder') return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.folder(role === 'manuscript' ? color : undefined) }} />;
  
  return <div className="w-4 h-4 flex items-center justify-center" dangerouslySetInnerHTML={{ __html: ICONS.textDoc(true) }} />;
};

interface CorkboardProps {
  docs: Doc[];
  onSelectDoc: (id: string) => void;
  onUpdateSynopsis: (id: string, synopsis: string) => void;
}

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
            <div className="flex-1 px-4 pb-4 relative">
              <textarea
                className="w-full h-full bg-transparent border-none focus:outline-none text-[13px] font-serif italic text-on-surface-variant/80 resize-none leading-relaxed placeholder:text-on-surface-variant/20"
                placeholder="No synopsis..."
                value={doc.metadata?.synopsis || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  onUpdateSynopsis(doc.id, e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
              />
              
              {/* Card Footer Info */}
              <div className="absolute bottom-3 right-3 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <span className="text-[9px] uppercase font-bold tracking-widest text-on-surface-variant/40">{doc.metadata.status}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
