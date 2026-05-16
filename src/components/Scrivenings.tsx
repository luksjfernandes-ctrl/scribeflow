import React from 'react';
import { Doc } from '../types';
import { sanitizeHtml } from '../utils/sanitize';

interface ScriveningsProps {
  docs: Doc[];
}

export function Scrivenings({ docs }: ScriveningsProps) {
  const textDocs = docs.filter(d => d.type === 'text');

  if (textDocs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-center text-on-surface-variant/40 bg-surface-container-low">
        <p className="font-serif italic">No text documents in this selection.</p>
      </div>
    );
  }

  return (
    <div className="scrivenings-container scrivener-scrollbar">
      <div className="max-w-2xl mx-auto space-y-16">
        {textDocs.map((doc, index) => (
          <div key={doc.id} className="relative">
            <div className="scrivenings-header">
              <div className="scrivenings-line" />
              <span className="scrivenings-title">{doc.title}</span>
              <div className="scrivenings-line" />
            </div>
            
            <div
              className="prose prose-stone max-w-none font-serif text-lg leading-relaxed text-[#1A1A1A]"
              dangerouslySetInnerHTML={{ __html: doc.content ? sanitizeHtml(doc.content) : '<p class="italic opacity-30">Empty document</p>' }}
            />
            
            {index < textDocs.length - 1 && (
              <div className="scrivenings-doc-sep">
                <div className="scrivenings-dot" />
                <div className="scrivenings-dot" />
                <div className="scrivenings-dot" />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
