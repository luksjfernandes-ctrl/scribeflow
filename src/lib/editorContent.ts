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
type ContentEditor = Pick<Editor, 'commands' | 'state' | 'view' | 'getHTML'>;

/** Documento que está no editor (o editor é um só e sobrevive à troca de vista). */
const loadedDoc = new WeakMap<object, string>();

export const loadedDocId = (editor: ContentEditor): string | undefined => loadedDoc.get(editor);

export function loadContent(editor: ContentEditor, content: Content, docId?: string): void {
  editor.commands.setContent(content, { emitUpdate: false });
  editor.view.updateState(withoutHistory(editor.state));
  if (docId !== undefined) loadedDoc.set(editor, docId);
}

/**
 * Abre `docId` no editor. Se ele já está lá com o mesmo texto, não faz nada:
 * voltar do Mural ou da Tabela para o Documento remonta o componente, e o
 * desfazer do texto tem que continuar. Trocar de documento sempre zera o
 * desfazer, mesmo que os dois textos sejam iguais.
 */
export function openDocument(editor: ContentEditor, docId: string, content: Content): void {
  if (loadedDoc.get(editor) === docId && editor.getHTML() === content) return;
  loadContent(editor, content, docId);
}
