import React from 'react';
import { Doc } from '../types';
import { getDocIcon } from '../utils/getDocIcon';
import { LABEL_COLORS } from '../constants';

interface OutlinerProps {
  docs: Doc[];
  onSelectDoc: (id: string) => void;
  onUpdateMetadata: (id: string, metadata: Partial<Doc['metadata']>) => void;
}

const wordCount = (html: string) =>
  (html || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;

const TH = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <th
    className={`p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px] border-r border-[#B5B2AA] ${className}`}
  >
    {children}
  </th>
);

export function Outliner({ docs, onSelectDoc, onUpdateMetadata }: OutlinerProps) {
  return (
    <div className="flex-1 bg-white overflow-x-auto scrivener-scrollbar">
      <table className="w-full border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-[#F2F0EB] border-b border-[#B5B2AA]">
          <tr>
            <TH className="w-64">Title</TH>
            <TH className="w-32">Status</TH>
            <TH className="w-32">Label</TH>
            <TH className="w-40">Progress</TH>
            <TH className="w-20">Target</TH>
            <TH className="w-16">Compile</TH>
            <th className="p-2 text-left font-bold uppercase tracking-wider text-[#5A5A5A] text-[9px]">Synopsis</th>
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => {
            const words = wordCount(doc.content);
            const target = doc.metadata?.target_word_count || 0;
            const pct = target > 0 ? Math.min(100, Math.round((words / target) * 100)) : 0;
            const labelDot = LABEL_COLORS[doc.metadata?.label || 'none']?.dot;
            return (
              <tr
                key={doc.id}
                className="border-b border-[#E2DFD8] hover:bg-[#F0EDE7] cursor-pointer transition-colors"
                onClick={() => onSelectDoc(doc.id)}
              >
                <td className="p-2 border-r border-[#E2DFD8]">
                  <div className="flex items-center gap-2">
                    {getDocIcon(doc)}
                    <span className="font-medium truncate text-[#1A1A1A] text-[13px]">{doc.title}</span>
                    {(doc.metadata?.keywords?.length ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        {doc.metadata.keywords.slice(0, 3).map((kw) => (
                          <span
                            key={kw.text}
                            className="w-2 h-2 rounded-sm"
                            style={{ backgroundColor: kw.color }}
                            title={kw.text}
                          />
                        ))}
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2 border-r border-[#E2DFD8]">
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
                    <option value="Revised Draft">Revised Draft</option>
                    <option value="Final Draft">Final Draft</option>
                  </select>
                </td>
                <td className="p-2 border-r border-[#E2DFD8]">
                  <div className="flex items-center gap-1.5">
                    {labelDot && labelDot !== '#CCC' && (
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: labelDot }} />
                    )}
                    <select
                      className="w-full bg-transparent border-none focus:outline-none text-xs text-on-surface-variant appearance-none cursor-pointer"
                      value={doc.metadata?.label || 'none'}
                      onChange={(e) => {
                        e.stopPropagation();
                        onUpdateMetadata(doc.id, { label: e.target.value });
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="none">No Label</option>
                      <option value="red">Chapter</option>
                      <option value="green">Scene</option>
                      <option value="blue">Research</option>
                      <option value="yellow">Note</option>
                    </select>
                  </div>
                </td>
                <td className="p-2 border-r border-[#E2DFD8]">
                  {target > 0 ? (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden min-w-[40px]">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${pct}%`, backgroundColor: pct >= 100 ? '#40A040' : '#5B7A3D' }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-on-surface-variant/60 w-8 text-right">{pct}%</span>
                    </div>
                  ) : (
                    <span className="text-[11px] font-mono text-on-surface-variant/50">{words} words</span>
                  )}
                </td>
                <td className="p-2 border-r border-[#E2DFD8] text-right">
                  <input
                    type="number"
                    className="bg-transparent border-none p-0 w-14 text-right focus:ring-0"
                    value={target}
                    onChange={(e) => {
                      e.stopPropagation();
                      onUpdateMetadata(doc.id, { target_word_count: parseInt(e.target.value) || 0 });
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </td>
                <td className="px-3 py-2 text-center border-r border-[#E2DFD8]">
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
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
