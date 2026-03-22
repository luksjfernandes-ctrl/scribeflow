import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export const ParagraphFocus = Extension.create({
  name: 'paragraphFocus',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('paragraphFocus'),
        props: {
          decorations(state) {
            const { selection } = state;
            const decorations: Decoration[] = [];

            state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
              if (node.isBlock && node.type.name === 'paragraph') {
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: 'is-active-paragraph',
                  })
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
