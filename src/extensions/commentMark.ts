import { Mark, mergeAttributes } from '@tiptap/core';

export interface CommentOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      /** Wrap the current selection in a comment mark with the given id. */
      setComment: (commentId: string) => ReturnType;
      /** Remove the comment mark with the given id, keeping other comments on the same text. */
      removeComment: (commentId: string) => ReturnType;
    };
  }
}

/**
 * Inline comment mark. The comment id is stored on the mark (and persisted in
 * the document HTML as data-comment-id); the comment body lives separately in
 * doc.metadata.comments, keyed by the same id.
 */
export const CommentMark = Mark.create<CommentOptions>({
  name: 'comment',
  inclusive: false,
  excludes: '',

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-comment-id'),
        renderHTML: (attrs) =>
          attrs.commentId ? { 'data-comment-id': attrs.commentId } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes({ class: 'comment-mark' }, this.options.HTMLAttributes, HTMLAttributes),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),

      removeComment:
        (commentId: string) =>
        ({ tr, state, dispatch }) => {
          const markType = state.schema.marks[this.name];
          if (!markType) return false;
          let changed = false;
          state.doc.descendants((node, pos) => {
            if (!node.isText) return;
            // Remove só a marca deste id. Passar o markType tiraria também as
            // outras marcas de comentário no mesmo trecho (excludes: '' deixa
            // comentários se sobreporem), e o comentário vizinho perderia a âncora.
            const alvo = node.marks.find((m) => m.type === markType && m.attrs.commentId === commentId);
            if (alvo) {
              tr.removeMark(pos, pos + node.nodeSize, alvo);
              changed = true;
            }
          });
          if (changed && dispatch) dispatch(tr);
          return changed;
        },
    };
  },
});
