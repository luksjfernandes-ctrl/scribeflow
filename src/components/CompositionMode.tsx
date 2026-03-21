import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import { X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface CompositionModeProps {
  content: string;
  onChange: (content: string) => void;
  onExit: () => void;
  title: string;
}

export function CompositionMode({ content, onChange, onExit, title }: CompositionModeProps) {
  const [isWide, setIsWide] = React.useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Focus on your words...',
      }),
      CharacterCount,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when external content changes
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="composition-overlay"
    >
      {/* Composition Toolbar (Auto-hiding) */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between opacity-0 hover:opacity-100 transition-opacity z-10">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-serif italic text-[#D4D0C8]/40">{title}</h2>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsWide(!isWide)}
            className="p-2.5 hover:bg-white/5 rounded-full transition-colors text-[#D4D0C8]/60"
            title={isWide ? "Narrow View" : "Wide View"}
          >
            {isWide ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button 
            onClick={onExit}
            className="p-2.5 hover:bg-white/5 rounded-full transition-colors text-[#D4D0C8]/60"
            title="Exit Composition Mode"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className={cn(
        "composition-editor scrivener-scrollbar",
        isWide && "w-[1000px]"
      )}>
        <EditorContent 
          editor={editor} 
          className="prose prose-invert max-w-none focus:outline-none min-h-screen"
        />
      </div>

      {/* Word Count (Auto-hiding) */}
      <div className="absolute bottom-6 right-8 opacity-0 hover:opacity-100 transition-opacity text-xs font-mono text-[#D4D0C8]/20 uppercase tracking-widest">
        {editor?.storage.characterCount?.words?.() || 0} words
      </div>
    </motion.div>
  );
}
