import React from 'react';
import { Doc } from '../types';
import { cn } from '../lib/utils';
import { getDocIcon } from '../utils/getDocIcon';
import { ICONS, FOLDER_COLORS } from '../constants';



interface OutlinerProps {
  docs: Doc[];
  onSelectDoc: (id: string) => void;
  onUpdateMetadata: (id: string, metadata: Partial<Doc['metadata']>) => void;
}

export function Outliner({ docs, onSelectDoc, onUpdateMetadata }: OutlinerProps) {
  return (
    <div className="flex-1 bg-white overflow-x-auto scrivener-scrollbar">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[#F2F0EB] border-b border-[#B5B2AA]">
          <tr>
            <th className="p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px] border-r border-[#B5B2AA] w-64">Title</th>
            <th className="p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px] border-r border-[#B5B2AA] w-32">Status</th>
            <th className="p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px] border-r border-[#B5B2AA] w-32">Label</th>
            <th className="p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px] border-r border-[#B5B2AA] w-24">Target</th>
            <th className="p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px] border-r border-[#B5B2AA] w-24">Compile</th>
            <th className="p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px]">Synopsis</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr 
              key={doc.id} 
              className="border-b border-[#E2DFD8] hover:bg-[#F0EDE7] cursor-pointer transition-colors"
              onClick={() => onSelectDoc(doc.id)}
            >
              <td className="p-2 border-r border-[#E2DFD8] flex items-center gap-2">
                {getDocIcon(doc)}
                <span className="font-medium truncate text-[#1A1A1A] text-[13px]">{doc.title}</span>
              </td>
              <td className="p-3 border-r border-outline-variant/20">
                <select
                  className="w-full bg-transparent border-none focus:outline-none text-xs text-on-surface-variant appearance-none cursor-pointer"
                  value={doc.metadata?.status || 'To Do'}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateMetadata(doc.id, { status: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="To Do">To Do</option>
                  <option value="First Draft">First Draft</option>
                  <option value="Revised">Revised</option>
                  <option value="Final">Final</option>
                </select>
              </td>
              <td className="p-3 border-r border-outline-variant/20">
                <select
                  className="w-full bg-transparent border-none focus:outline-none text-xs text-on-surface-variant appearance-none cursor-pointer"
                  value={doc.metadata?.label || 'No Label'}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateMetadata(doc.id, { label: e.target.value });
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="Chapter">Chapter</option>
                  <option value="Scene">Scene</option>
                  <option value="Research">Research</option>
                  <option value="Note">Note</option>
                </select>
              </td>
              <td className="p-3 border-r border-outline-variant/20 text-right">
                <input 
                  type="number"
                  className="bg-transparent border-none p-0 w-16 text-right focus:ring-0"
                  value={doc.metadata?.target_word_count || 0}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateMetadata(doc.id, { target_word_count: parseInt(e.target.value) || 0 });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="px-3 py-2 text-center">
                <input 
                  type="checkbox"
                  className="rounded border-border-color text-accent-color focus:ring-accent-color/20"
                  checked={doc.metadata?.is_include_in_compile || false}
                  onChange={(e) => {
                    e.stopPropagation();
                    onUpdateMetadata(doc.id, { is_include_in_compile: e.target.checked });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </td>
              <td className="p-3 text-xs text-on-surface-variant/60 font-serif italic truncate max-w-xs">
                {doc.metadata?.synopsis || 'No synopsis...'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
