// O editor é um só para todos os documentos. Trocar de capítulo não pode entrar
// no desfazer: ⌘Z logo depois da troca trazia o capítulo anterior, e o onUpdate
// gravava esse texto no capítulo aberto.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { loadContent } from '../src/lib/editorContent'

const doc = (...paragrafos: string[]) => ({
  type: 'doc',
  content: paragrafos.map((t) => ({ type: 'paragraph', content: [{ type: 'text', text: t }] })),
})

/** Editor real do TipTap, sem DOM. Sem view, os plugins (o histórico entre
 *  eles) só entram ao montar; aqui entram à mão, como a montagem faz. */
function editor(inicial: ReturnType<typeof doc>) {
  const gravados: string[] = []
  const ed = new Editor({
    element: null,
    extensions: [StarterKit],
    content: inicial,
    onUpdate: ({ editor }) => gravados.push(editor.getText()),
  })
  ed.view.updateState(ed.state.reconfigure({ plugins: ed.extensionManager.plugins }))
  const digitar = (texto: string) => ed.view.dispatch(ed.state.tr.insertText(texto, ed.state.doc.content.size - 1))
  return { ed, gravados, digitar }
}

test('o setContent do TipTap entra no desfazer (é por isso que a troca usa loadContent)', () => {
  const { ed, gravados, digitar } = editor(doc('Capítulo A'))
  digitar(' editado')
  ed.commands.setContent(doc('Capítulo B'), { emitUpdate: false })
  ed.commands.undo()
  assert.equal(ed.getText(), 'Capítulo A')
  assert.equal(gravados.at(-1), 'Capítulo A', 'o desfazer emite onUpdate: o app gravaria A dentro de B')
})

test('trocar de documento: ⌘Z não traz o anterior nem grava nada', () => {
  const { ed, gravados, digitar } = editor(doc('Capítulo A'))
  digitar(' editado')
  const antes = gravados.length

  loadContent(ed, doc('Capítulo B'))

  assert.equal(ed.getText(), 'Capítulo B')
  assert.equal(ed.can().undo(), false, 'o menu Desfazer fica desligado logo depois da troca')
  ed.commands.undo()
  assert.equal(ed.getText(), 'Capítulo B')
  assert.equal(gravados.length, antes, 'a troca e o ⌘Z não gravam nada')
})

test('depois da troca, o desfazer volta só as edições do documento aberto', () => {
  const { ed, digitar } = editor(doc('Capítulo A'))
  digitar(' editado')
  loadContent(ed, doc('Capítulo B'))
  digitar(' novo')
  assert.equal(ed.getText(), 'Capítulo B novo')
  ed.commands.undo()
  assert.equal(ed.getText(), 'Capítulo B')
  assert.equal(ed.can().undo(), false)
})

test('texto que outra aba gravou entra fora do desfazer e a seleção sobrevive', () => {
  const { ed, digitar } = editor(doc('Primeira versão'))
  digitar(' local')
  loadContent(ed, doc('Versão da outra aba', 'com mais um parágrafo'))
  assert.equal(ed.can().undo(), false)
  ed.commands.setTextSelection(3)
  assert.equal(ed.state.selection.from, 3)
  // Os outros plugins seguem ativos: digitar continua indo para o histórico.
  digitar('!')
  assert.equal(ed.can().undo(), true)
})
