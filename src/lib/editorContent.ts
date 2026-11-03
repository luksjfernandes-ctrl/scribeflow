import type { Content, Editor } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';

/**
 * O mesmo documento e a mesma seleção, com os plugins zerados: o histórico de
 * desfazer começa vazio.
 */
export const withoutHistory = (state: EditorState): EditorState =>
  EditorState.create({
    schema: state.schema,
    doc: state.doc,
    selection: state.selection,
    plugins: state.plugins,
  });

/**
 * Põe no editor um texto que veio de fora (outro documento, ou a versão que
 * outra aba gravou), sem gravar e sem deixar o texto anterior no desfazer.
 *
 * O editor é um só para todos os documentos. O `setContent` do TipTap entra no
 * histórico, e o desfazer não emite com `preventUpdate`. Então ⌘Z logo depois
 * de trocar de capítulo trazia de volta o capítulo anterior, e o onUpdate
 * gravava esse texto no capítulo aberto.
 */
export function loadContent(
  editor: Pick<Editor, 'commands' | 'state' | 'view'>,
  content: Content,
): void {
  editor.commands.setContent(content, { emitUpdate: false });
  editor.view.updateState(withoutHistory(editor.state));
}
