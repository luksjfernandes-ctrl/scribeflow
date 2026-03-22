import React, { useEffect } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { X, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CompositionSettings } from './CompositionSettings';
import { useCompositionPrefs } from '../hooks/useCompositionPrefs';
import { cn } from '../lib/utils';
import '../styles/composition.css';

interface CompositionModeProps {
  editor: Editor | null;
  onExit: () => void;
  title: string;
}

export function CompositionMode({ editor, onExit, title }: CompositionModeProps) {
  const { prefs, updatePrefs } = useCompositionPrefs();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // Typewriter Scroll Logic
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      const { selection } = editor.state;
      if (!selection.empty) return;

      // Ensure the cursor stays centered
      setTimeout(() => {
        const cursor = document.querySelector('.ProseMirror-focused');
        if (cursor) {
          cursor.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 10);
    };

    editor.on('selectionUpdate', handleUpdate);
    return () => {
      editor.off('selectionUpdate', handleUpdate);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="composition-overlay bg-[#0A0A0A] fixed inset-0 z-[5000] flex flex-col items-center overflow-y-auto scrivener-scrollbar font-serif"
      style={{
        '--comp-bg': '#0A0A0A',
        '--comp-text': '#C8C8B0',
        '--comp-accent': '#B8A04A',
        '--comp-width': `${prefs.paperWidth}px`,
        '--comp-font-size': `${prefs.fontSize}px`,
        '--comp-line-height': `${prefs.lineHeight}`,
        '--comp-font-family': prefs.fontFamily === 'serif' ? 'Georgia, serif' : 
                             prefs.fontFamily === 'monospace' ? 'monospace' : 'system-ui',
      } as React.CSSProperties}
    >
      {/* Immersive Header (Auto-hiding) */}
      <div className="fixed top-0 left-0 right-0 p-8 flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none">
        <div className="flex items-center gap-4">
          <h2 className="text-xs font-mono uppercase tracking-[0.3em] text-[#B8A04A]/40">{title}</h2>
        </div>
        <div className="flex items-center gap-4 pointer-events-auto">
          <button 
            onClick={onExit}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-full transition-all text-[#B8A04A]/60 hover:text-[#B8A04A]"
            title="Sair do Modo de Foco (ESC)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Deep Dark Editor Container */}
      <div 
        className="w-full max-w-[var(--comp-width)] flex-1 pt-[20vh] pb-[60vh] transition-all duration-500"
        style={{ fontSize: 'var(--comp-font-size)', lineHeight: 'var(--comp-line-height)', fontFamily: 'var(--comp-font-family)' }}
      >
        <EditorContent 
          editor={editor} 
          className="composition-tiptap prose prose-invert max-w-none focus:outline-none min-h-[50vh] text-[#C8C8B0]"
        />
      </div>

      {/* Settings UI */}
      <CompositionSettings prefs={prefs} onUpdate={updatePrefs} />

      {/* Floating Meta (Auto-hiding) */}
      <div className="fixed bottom-10 left-10 opacity-0 hover:opacity-100 transition-opacity duration-700 pointer-events-none">
        <p className="text-[9px] font-mono text-gray-700 uppercase tracking-widest font-bold">
          {editor.storage.characterCount.words()} palavras · ScribeFlow Sanctuary
        </p>
      </div>
    </motion.div>
  );
}

