import React from 'react';
import { Editor as TiptapEditor, EditorContent, useEditorState } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Highlighter,
  MessageSquarePlus
} from 'lucide-react';
import { cn } from '../lib/utils';

import { Doc } from '../types';
import { parseEpigraph } from '../lib/epigraph';
import { parsePartTitle, suggestsPartTitle } from '../lib/part';
import { isPart as isPartDoc } from '../lib/binderOrder';

interface EditorProps {
  content: string;
  onChange: (content: string) => void;
  title: string;
  onTitleChange: (title: string) => void;
  doc: Doc;
  zoom: number;
  onZoomChange: (zoom: number) => void;
  externalEditor?: TiptapEditor | null;
  onSubtitleChange?: (subtitle: string) => void;
  onAddComment?: (id: string, quote: string) => void;
  /** O Modo de Composicao monta o MESMO editor no overlay. O TipTap so mantem
   *  o view.dom em um lugar, entao enquanto o overlay estiver montado — incluindo
   *  a animacao de saida — este EditorContent precisa ficar desmontado. */
  suspendEditorContent?: boolean;
  /** Converte este documento em Livro/Parte (a mesma acao do Binder). */
  onConvertToPart?: () => void;
  /** Celular: barra de formatacao embaixo (acima do teclado), sem zoom e com
   *  corpo de pelo menos 16px (abaixo disso o iOS da zoom sozinho ao focar). */
  isMobile?: boolean;
  /** Faixa fixa acima de tudo (indicador de salvamento). */
  topBar?: React.ReactNode;
}

const uid = () => {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

type BlockStyle = 'paragraph' | 'h1' | 'h2' | 'blockquote';

/** Fonte e tamanho de EXIBICAO do editor: preferencia de quem esta vendo, sem
 *  mexer no HTML salvo nem na exportacao (o manuscrito nao guarda fonte). */
export interface EditorDisplayPrefs {
  font: string;
  size: number;
}

const DISPLAY_FONTS: Record<string, string> = {
  Palatino: '"Palatino Linotype", "Palatino", "Book Antiqua", serif',
  'Times New Roman': '"Times New Roman", Times, serif',
  Georgia: 'Georgia, serif',
  Courier: '"Courier New", Courier, monospace',
};
const DISPLAY_SIZES = [12, 14, 16, 18];
const DEFAULT_PREFS: EditorDisplayPrefs = { font: 'Palatino', size: 14 };
const PREFS_KEY = 'scribeflow-editor-display';

const readPrefs = (): EditorDisplayPrefs => {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<EditorDisplayPrefs>;
    return {
      font: parsed.font && parsed.font in DISPLAY_FONTS ? parsed.font : DEFAULT_PREFS.font,
      size: parsed.size && DISPLAY_SIZES.includes(parsed.size) ? parsed.size : DEFAULT_PREFS.size,
    };
  } catch {
    return DEFAULT_PREFS;
  }
};

const writePrefs = (prefs: EditorDisplayPrefs) => {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* aba privada ou storage bloqueado: vale so ate recarregar */
  }
};

const FormatBar = ({
  editor,
  onAddComment,
  disabled,
  prefs,
  onPrefsChange,
  compact = false,
}: {
  editor: TiptapEditor | null;
  onAddComment?: (id: string, quote: string) => void;
  /** Foco no titulo ou no subtitulo: a barra so formata o corpo. */
  disabled: boolean;
  prefs: EditorDisplayPrefs;
  onPrefsChange: (prefs: EditorDisplayPrefs) => void;
  /** Celular: sem fonte/tamanho de exibicao, botoes maiores, presa acima do teclado. */
  compact?: boolean;
}) => {
  // Sem isto a barra so re-renderiza quando o App re-renderiza (ao digitar), e o
  // estado ativo dos botoes fica velho ao mover o cursor ou selecionar texto.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return null;
      const block: BlockStyle = e.isActive('heading', { level: 1 })
        ? 'h1'
        : e.isActive('heading', { level: 2 })
          ? 'h2'
          : e.isActive('blockquote')
            ? 'blockquote'
            : 'paragraph';
      return {
        block,
        bold: e.isActive('bold'),
        italic: e.isActive('italic'),
        underline: e.isActive('underline'),
        left: e.isActive({ textAlign: 'left' }),
        center: e.isActive({ textAlign: 'center' }),
        right: e.isActive({ textAlign: 'right' }),
        justify: e.isActive({ textAlign: 'justify' }),
        bulletList: e.isActive('bulletList'),
        orderedList: e.isActive('orderedList'),
        highlight: e.isActive('highlight'),
        comment: e.isActive('comment'),
        hasSelection: !e.state.selection.empty,
      };
    },
  });

  if (!editor || !state) return null;

  const addComment = () => {
    const { from, to } = editor.state.selection;
    if (from === to) return; // require a selection
    const quote = editor.state.doc.textBetween(from, to, ' ').trim();
    const id = uid();
    editor.chain().focus().setComment(id).run();
    onAddComment?.(id, quote);
  };

  const setBlock = (style: BlockStyle) => {
    const chain = editor.chain().focus();
    if (style === 'paragraph') chain.clearNodes().run();
    else if (style === 'blockquote') chain.clearNodes().setBlockquote().run();
    else chain.setHeading({ level: style === 'h1' ? 1 : 2 }).run();
  };

  // mousedown com preventDefault: o clique nao tira o foco (nem a selecao) do texto.
  const btn = (label: string, active: boolean, run: () => void, icon: React.ReactNode, extraDisabled = false) => (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled || extraDisabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
      className={cn('format-btn', active && 'active')}
    >
      {icon}
    </button>
  );

  return (
    <div
      className={cn('format-bar', compact && 'format-bar-mobile', disabled && 'format-bar-disabled')}
      aria-disabled={disabled}
      title={disabled ? 'Formatting applies to the body text only' : undefined}
    >
      <select
        className="format-dropdown w-32"
        title="Paragraph style"
        aria-label="Paragraph style"
        disabled={disabled}
        value={state.block}
        onChange={(e) => setBlock(e.target.value as BlockStyle)}
      >
        <option value="paragraph">Body</option>
        <option value="h1">Heading 1</option>
        <option value="h2">Heading 2</option>
        <option value="blockquote">Blockquote</option>
      </select>

      {!compact && (<>
      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      <select
        className="format-dropdown w-32"
        title="Editor display font (does not change the saved text or the export)"
        aria-label="Editor display font"
        disabled={disabled}
        value={prefs.font}
        onChange={(e) => onPrefsChange({ ...prefs, font: e.target.value })}
      >
        {Object.keys(DISPLAY_FONTS).map((f) => <option key={f} value={f}>{f}</option>)}
      </select>

      <select
        className="format-dropdown w-16"
        title="Editor display size (does not change the saved text or the export)"
        aria-label="Editor display size"
        disabled={disabled}
        value={prefs.size}
        onChange={(e) => onPrefsChange({ ...prefs, size: Number(e.target.value) })}
      >
        {DISPLAY_SIZES.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
      </>)}

      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      {btn('Bold', state.bold, () => editor.chain().focus().toggleBold().run(), <Bold size={14} />)}
      {btn('Italic', state.italic, () => editor.chain().focus().toggleItalic().run(), <Italic size={14} />)}
      {btn('Underline', state.underline, () => editor.chain().focus().toggleUnderline().run(), <UnderlineIcon size={14} />)}

      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      {btn('Align left', state.left, () => editor.chain().focus().setTextAlign('left').run(), <AlignLeft size={14} />)}
      {btn('Align center', state.center, () => editor.chain().focus().setTextAlign('center').run(), <AlignCenter size={14} />)}
      {btn('Align right', state.right, () => editor.chain().focus().setTextAlign('right').run(), <AlignRight size={14} />)}
      {btn('Justify', state.justify, () => editor.chain().focus().setTextAlign('justify').run(), <AlignJustify size={14} />)}

      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      {btn('Bulleted list', state.bulletList, () => editor.chain().focus().toggleBulletList().run(), <List size={14} />)}
      {btn('Numbered list', state.orderedList, () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={14} />)}
      {btn('Highlight', state.highlight, () => editor.chain().focus().toggleHighlight().run(), <Highlighter size={14} />)}

      <div className="w-px h-4 bg-[#C8C5BD] mx-1" />

      {btn(
        state.hasSelection ? 'Add comment to selection' : 'Select text to add a comment',
        state.comment,
        addComment,
        <MessageSquarePlus size={14} />,
        !state.hasSelection,
      )}
    </div>
  );
};

const HINTS_KEY = 'scribeflow-part-hint-dismissed';
const readDismissedHints = (): string[] => {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};
const writeDismissedHints = (ids: string[]) => {
  try {
    localStorage.setItem(HINTS_KEY, JSON.stringify(ids));
  } catch {
    /* sem storage: volta a aparecer ao recarregar */
  }
};

/** Ajusta a altura do textarea ao conteudo (sem barra de rolagem interna). */
const autosize = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

export function Editor({ 
  content, 
  onChange, 
  title, 
  onTitleChange, 
  doc, 
  zoom, 
  onZoomChange,
  externalEditor,
  onSubtitleChange,
  onAddComment,
  suspendEditorContent = false,
  onConvertToPart,
  isMobile = false,
  topBar,
}: EditorProps) {
  const editor = externalEditor;

  // Set content only when the document changes to prevent bounce-back from autosave
  React.useEffect(() => {
    if (editor) {
      // Trocar de documento nao e edicao: sem emitUpdate, nao gera gravacao.
      editor.commands.setContent(content, { emitUpdate: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc.id, editor]);

  // Assina as transações do editor: o setContent da troca de documento (sem
  // emitUpdate) roda depois do render, e ler o storage direto no render deixava
  // o rodapé com a contagem velha ("0 words") até a primeira tecla.
  const counts = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      words: e?.storage.characterCount.words() ?? 0,
      chars: e?.storage.characterCount.characters() ?? 0,
    }),
  });
  const wordCount = counts?.words ?? 0;
  const charCount = counts?.chars ?? 0;

  const [focusedField, setFocusedField] = React.useState<'title' | 'subtitle' | null>(null);
  const [prefs, setPrefs] = React.useState<EditorDisplayPrefs>(readPrefs);
  const changePrefs = (next: EditorDisplayPrefs) => {
    setPrefs(next);
    writePrefs(next);
  };

  // Titulo: rascunho local. O App rejeita titulo vazio (validacao do doc), e com
  // o textarea controlado direto pelo doc, apagar o titulo inteiro para redigitar
  // fazia o titulo antigo voltar na hora e o novo ser colado no fim dele.
  const titleRef = React.useRef<HTMLTextAreaElement>(null);
  const [titleDraft, setTitleDraft] = React.useState(title);
  React.useEffect(() => {
    // Mudanca de fora (binder, outro documento) so entra quando nao ha edicao em curso.
    if (focusedField !== 'title') setTitleDraft(title);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, doc.id]);
  React.useLayoutEffect(() => autosize(titleRef.current), [titleDraft]);

  const subtitleRef = React.useRef<HTMLTextAreaElement>(null);
  const subtitle = doc.metadata.subtitle || '';
  const epigraph = React.useMemo(() => parseEpigraph(subtitle), [subtitle]);
  const editingSubtitle = focusedField === 'subtitle';
  React.useLayoutEffect(() => autosize(subtitleRef.current), [subtitle, editingSubtitle]);

  const pageFont = DISPLAY_FONTS[prefs.font] || DISPLAY_FONTS[DEFAULT_PREFS.font];
  // No celular o zoom da pagina fica em 100% e o corpo em >= 16px.
  const pageZoom = isMobile ? 100 : zoom;
  const pageFontSize = isMobile ? Math.max(16, prefs.size) : prefs.size;

  // Livro/Parte: pagina de titulo (rotulo + nome + epigrafe), corpo recolhido.
  const isPart = isPartDoc(doc);
  const partTitle = React.useMemo(() => parsePartTitle(title), [title]);
  const editingTitle = focusedField === 'title';
  const [partBodyOpen, setPartBodyOpen] = React.useState(false);
  React.useEffect(() => setPartBodyOpen(false), [doc.id]);
  const showBody = !isPart || partBodyOpen;
  // Conta pelo doc, nao pelo storage do editor: na troca de documento o
  // setContent roda depois do render e a contagem do editor ainda e a do anterior.
  const partWords = React.useMemo(
    () => (isPart ? content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length : 0),
    [isPart, content],
  );
  // Faixa "Transformar em pagina de Livro?" para quem criou o Livro como
  // documento comum. Dispensar vale por documento, so para quem esta vendo.
  const [hintDismissed, setHintDismissed] = React.useState<string[]>(readDismissedHints);
  const showPartHint =
    !!onConvertToPart && !isPart && doc.type === 'text' && suggestsPartTitle(title) && !hintDismissed.includes(doc.id);
  const dismissHint = () => {
    const next = [...hintDismissed, doc.id].slice(-200);
    setHintDismissed(next);
    writeDismissedHints(next);
  };
  const focusAtEnd = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };

  const formatBar = (
    <FormatBar
      editor={editor}
      onAddComment={onAddComment}
      disabled={focusedField !== null || !showBody}
      prefs={prefs}
      onPrefsChange={changePrefs}
      compact={isMobile}
    />
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {topBar}
      {!isMobile && formatBar}
      
      {showPartHint && (
        <div className="part-hint" role="status">
          <span>Parece o início de um Livro. Transformar em página de Livro?</span>
          <button type="button" className="part-hint-convert" onClick={onConvertToPart}>
            Transformar
          </button>
          <button type="button" className="part-hint-dismiss" aria-label="Dispensar sugestão" title="Dispensar" onClick={dismissHint}>
            ×
          </button>
        </div>
      )}
      <div className="editor-writing-area scrivener-scrollbar">
        <div 
          className={cn('editor-page', isPart && 'part-host', isPart && !showBody && 'part-sheet')}
          style={{ 
            transform: `scale(${pageZoom / 100})`, 
            transformOrigin: 'top center',
            width: '100%',
            maxWidth: `${doc.metadata.section_type === 'Heading' ? 'none' : '800px'}`,
            fontFamily: pageFont,
            fontSize: `${pageFontSize}px`,
          }}
        >
          <div className={cn(isPart && 'part-page')}>
          <div className={cn(isPart && 'part-title-wrap')}>
          <textarea
            ref={titleRef}
            aria-label={isPart ? 'Part title (e.g. Book I – Childhood)' : 'Document title'}
            rows={1}
            value={titleDraft}
            onChange={(e) => {
              setTitleDraft(e.target.value);
              if (e.target.value.trim()) onTitleChange(e.target.value);
            }}
            onFocus={() => setFocusedField('title')}
            onBlur={() => {
              setFocusedField(null);
              // Saiu com o campo vazio: volta ao ultimo titulo gravado.
              if (!titleDraft.trim()) setTitleDraft(title);
            }}
            className={
              isPart
                ? cn('part-title-input keep-font', !editingTitle && 'part-title-input-idle')
                : 'keep-font w-full text-2xl font-serif italic font-bold bg-transparent border-none focus:outline-none placeholder:opacity-30 text-accent-color mb-2 resize-none overflow-hidden'
            }
            placeholder={isPart ? 'Book I – Childhood' : 'Untitled Document'}
          />
          {isPart && !editingTitle && (
            <div
              className="part-title-view"
              aria-hidden="true"
              onMouseDown={(e) => {
                e.preventDefault();
                focusAtEnd(titleRef.current);
              }}
            >
              {partTitle.label && <div className="part-label">{partTitle.label}</div>}
              {partTitle.label && <div className="part-rule" />}
              <div className="part-name">{partTitle.name || 'Untitled Part'}</div>
            </div>
          )}
          </div>
          {/* Subtitulo como epigrafe de livro. O textarea e o controle de verdade
              (foco, teclado, leitor de tela); fora de edicao ele fica invisivel e
              o bloco formatado aparece no lugar. O dado continua texto puro. */}
          <div className="epigraph-wrap">
            <textarea
              id="editor-subtitle"
              ref={subtitleRef}
              rows={1}
              value={subtitle}
              aria-label="Subtitle or epigraph"
              onChange={(e) => {
                onSubtitleChange?.(e.target.value);
                autosize(e.target);
              }}
              onFocus={() => setFocusedField('subtitle')}
              onBlur={() => setFocusedField(null)}
              className={cn('epigraph epigraph-input', !editingSubtitle && 'epigraph-input-idle')}
              placeholder="Write a subtitle or epigraph... (a line starting with — is the attribution)"
            />
            {!editingSubtitle && (
              <div
                className="epigraph epigraph-view"
                aria-hidden="true"
                lang="pt-BR"
                onMouseDown={(e) => {
                  e.preventDefault();
                  focusAtEnd(subtitleRef.current);
                }}
              >
                {epigraph.length === 0 ? (
                  <p className="epigraph-placeholder">Write a subtitle or epigraph...</p>
                ) : (
                  epigraph.map((line, i) =>
                    line.kind === 'blank' ? (
                      <p key={i} className="epigraph-blank" />
                    ) : (
                      <p key={i} className={line.kind === 'attribution' ? 'epigraph-attribution' : 'epigraph-quote'}>
                        {line.display}
                      </p>
                    ),
                  )
                )}
              </div>
            )}
          </div>
          {/* O Modo de Composicao monta este mesmo editor no overlay. Manter os
              dois EditorContent vivos faz o TipTap entregar o view.dom a apenas
              um deles, e o overlay abre vazio. */}
          </div>
          {isPart && (
            <div className="part-body-toggle">
              <button type="button" onClick={() => setPartBodyOpen((open) => !open)}>
                {partBodyOpen ? 'Hide text' : partWords > 0 ? `Show text (${partWords} ${partWords === 1 ? 'word' : 'words'})` : 'Add text to this part'}
              </button>
            </div>
          )}
          {!showBody ? null : suspendEditorContent ? (
            <div className="min-h-[500px]" aria-hidden="true" />
          ) : (
            <EditorContent 
              editor={editor} 
              className="book-text prose prose-stone dark:prose-invert max-w-none focus:outline-none min-h-[500px]"
            />
          )}
        </div>
      </div>

      {/* Celular: a barra fica por ultimo na coluna, e a coluna termina onde o
          teclado comeca (useVisualViewport), entao ela fica logo acima dele. */}
      {isMobile && formatBar}

      {/* Editor Footer */}
      {!isMobile && (
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
      )}
    </div>
  );
}
