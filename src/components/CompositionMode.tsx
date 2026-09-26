import React, { useEffect, useRef } from 'react';
import { EditorContent, Editor } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { X } from 'lucide-react';
import { motion } from 'motion/react';
import { CompositionSettings } from './CompositionSettings';
import { useCompositionPrefs } from '../hooks/useCompositionPrefs';
import { computeTypewriterScroll } from '../lib/typewriterScroll';
import '../styles/composition.css';

const typewriterKey = new PluginKey('typewriterScroll');

interface CompositionModeProps {
  editor: Editor | null;
  onExit: () => void;
  title: string;
}

export function CompositionMode({ editor, onExit, title }: CompositionModeProps) {
  const { prefs, updatePrefs } = useCompositionPrefs();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onExit]);

  // Rolagem de máquina de escrever: mantém o CURSOR numa faixa central do
  // overlay. Entra pelo handleScrollToSelection do ProseMirror, que só é
  // chamado em transações marcadas com scrollIntoView (digitar, Enter, colar,
  // setas). Clique e seleção com o mouse não passam por aqui, então não
  // arrastam a tela. Retornar true suprime a rolagem nativa, para as duas não
  // brigarem. O editor é compartilhado com o modo normal: o plugin só existe
  // enquanto o Compose está montado.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;

    const posicionarCursor = (view: EditorView) => {
      const overlay = overlayRef.current;
      if (!overlay) return false;
      const caret = view.coordsAtPos(view.state.selection.head);
      const rect = overlay.getBoundingClientRect();
      const alvo = computeTypewriterScroll({
        caretTop: caret.top,
        caretBottom: caret.bottom,
        containerTop: rect.top,
        containerHeight: overlay.clientHeight,
        scrollTop: overlay.scrollTop,
        maxScrollTop: overlay.scrollHeight - overlay.clientHeight,
      });
      // Sempre instantâneo: nada de smooth a cada tecla (e respeita
      // prefers-reduced-motion por construção).
      if (alvo !== null) overlay.scrollTop = alvo;
      return true;
    };

    editor.registerPlugin(
      new Plugin({
        key: typewriterKey,
        props: { handleScrollToSelection: posicionarCursor },
      })
    );

    // Ao entrar: foco no texto (cursor visível) sem a rolagem nativa, e o
    // cursor já posicionado na faixa.
    const raf = requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      editor.commands.focus(undefined, { scrollIntoView: false });
      posicionarCursor(editor.view);
    });

    return () => {
      cancelAnimationFrame(raf);
      if (!editor.isDestroyed) editor.unregisterPlugin(typewriterKey);
    };
  }, [editor]);

  if (!editor) return null;

  return (
    <motion.div
      ref={overlayRef}
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
      <div className="fixed top-0 left-0 right-0 p-8 flex items-center justify-between opacity-40 hover:opacity-100 transition-opacity duration-500 z-10 pointer-events-none">
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
      <div className="fixed bottom-10 left-10 opacity-0 hover:opacity-100 transition-opacity duration-700">
        <p className="text-[9px] font-mono text-gray-700 uppercase tracking-widest font-bold">
          {editor.storage.characterCount.words()} palavras · ScribeFlow Sanctuary
        </p>
      </div>
    </motion.div>
  );
}

