import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TextAlign from '@tiptap/extension-text-align';
import Placeholder from '@tiptap/extension-placeholder';
import CharacterCount from '@tiptap/extension-character-count';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  Highlighter
} from 'lucide-react';
import { cn } from '../lib/utils';

import { Doc } from '../types';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  doc: Doc;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}

const FormatBar = ({ editor }: { editor: any }) => {
  if (!editor) return null;

  return (
    <div className="format-bar">
      <select className="format-dropdown w-32">
        <option>Body</option>
        <option>Heading 1</option>
        <option>Heading 2</option>
        <option>Blockquote</option>
      </select>
      
      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />
      
      <select className="format-dropdown w-32">
        <option>Palatino</option>
        <option>Times New Roman</option>
        <option>Georgia</option>
        <option>Courier</option>
      </select>

      <select className="format-dropdown w-16">
        <option>12</option>
        <option>14</option>
        <option>16</option>
        <option>18</option>
      </select>

      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={cn("format-btn", editor.isActive('bold') && "active")}
      >
        <Bold size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={cn("format-btn", editor.isActive('italic') && "active")}
      >
        <Italic size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={cn("format-btn", editor.isActive('underline') && "active")}
      >
        <UnderlineIcon size={14} />
      </button>

      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={cn("format-btn", editor.isActive({ textAlign: 'left' }) && "active")}
      >
        <AlignLeft size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={cn("format-btn", editor.isActive({ textAlign: 'center' }) && "active")}
      >
        <AlignCenter size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={cn("format-btn", editor.isActive({ textAlign: 'right' }) && "active")}
      >
        <AlignRight size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        className={cn("format-btn", editor.isActive({ textAlign: 'justify' }) && "active")}
      >
        <AlignJustify size={14} />
      </button>

      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={cn("format-btn", editor.isActive('bulletList') && "active")}
      >
        <List size={14} />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHighlight().run()}
        className={cn("format-btn", editor.isActive('highlight') && "active")}
      >
        <Highlighter size={14} />
      </button>
    </div>
  );
};

export function Editor({ content, onChange, title, onTitleChange, doc, zoom, onZoomChange }: EditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Placeholder.configure({
        placeholder: 'Start writing...',
      }),
      CharacterCount,
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when external content changes (e.g., selecting a new doc)
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  const wordCount = editor?.storage.characterCount.words() || 0;
  const charCount = editor?.storage.characterCount.characters() || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <FormatBar editor={editor} />
      
      <div className="editor-writing-area scrivener-scrollbar">
        <div 
          className="editor-page"
          style={{ 
            transform: `scale(${zoom / 100})`, 
            transformOrigin: 'top center',
            width: `${doc.metadata.section_type === 'Heading' ? '100%' : 'auto'}`,
            maxWidth: `${doc.metadata.section_type === 'Heading' ? 'none' : '800px'}`
          }}
        >
          <input 
            type="text" 
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            className="w-full text-2xl font-serif italic font-bold bg-transparent border-none focus:outline-none placeholder:opacity-30 text-accent-color mb-8"
            placeholder="Untitled Document"
          />
          <EditorContent 
            editor={editor} 
            className="prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[500px]"
          />
        </div>
      </div>

      {/* Editor Footer */}
      <div className="h-6 flex items-center justify-between px-3 bg-[#E2DFD8] border-t border-[#B5B2AA] text-[10px] text-[#5A5A5A] font-sans">
        <div className="flex items-center gap-3">
          <span>{wordCount} words</span>
          <span>{charCount} characters</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span>{zoom}%</span>
          <input 
            type="range" 
            min="50" 
            max="200" 
            value={zoom} 
            onChange={(e) => onZoomChange(parseInt(e.target.value))}
            className="w-24 h-1 bg-[#B5B2AA] rounded-full appearance-none cursor-pointer accent-[#5B7A3D]"
          />
        </div>
      </div>
    </div>
  );
}
