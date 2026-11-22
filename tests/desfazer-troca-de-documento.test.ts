// O editor é um só para todos os documentos. Trocar de capítulo não pode entrar
// no desfazer: ⌘Z logo depois da troca trazia o capítulo anterior, e o onUpdate
// gravava esse texto no capítulo aberto.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { loadContent, openDocument } from '../src/lib/editorContent'

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

test('nenhuma troca de documento chama setContent direto (só a restauração de versão, de propósito)', () => {
  const ler = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
  const diretos = ['src/App.tsx', 'src/components/Editor.tsx', 'src/components/CompositionMode.tsx'].flatMap((f) =>
    ler(f)
      .split('\n')
      .map((linha, i) => ({ f, i: i + 1, linha }))
      .filter(({ linha }) => /\.commands\.setContent\(/.test(linha)),
  )
  // Restaurar uma versão guardada fica no desfazer: o ⌘Z ali é desejável e não sai do documento.
  assert.deepEqual(diretos.map(({ f, linha }) => `${f}: ${linha.trim()}`), [
    'src/App.tsx: globalEditor.commands.setContent(plan.content, { emitUpdate: false });',
  ])
})

// Sem DOM o TipTap nao serializa HTML; aqui o HTML "na tela" e o texto puro,
// o suficiente para comparar com o que o app passaria.
const comHtml = (ed: Editor) => Object.assign(ed, { getHTML: () => ed.getText() })

test('voltar do Mural ou da Tabela para o mesmo documento mantém o desfazer', () => {
  const { ed, digitar } = editor(doc('Capítulo A'))
  comHtml(ed)
  loadContent(ed, doc('Capítulo A'), 'A')
  digitar(' editado')
  // Remonta o Editor (troca de vista): mesmo doc, mesmo texto.
  openDocument(ed, 'A', ed.getText())
  assert.equal(ed.can().undo(), true, 'o desfazer da edição continua')
  ed.commands.undo()
  assert.equal(ed.getText(), 'Capítulo A')
})

test('outro documento com o mesmo texto ainda zera o desfazer', () => {
  const { ed, digitar } = editor(doc('igual'))
  comHtml(ed)
  loadContent(ed, doc('igual'), 'A')
  digitar('!')
  openDocument(ed, 'B', doc('igual!'))
  assert.equal(ed.can().undo(), false)
})

test('o mesmo documento com texto diferente (ex.: entrou de novo na conta) recarrega', () => {
  const { ed, digitar } = editor(doc('velho'))
  comHtml(ed)
  loadContent(ed, doc('velho'), 'A')
  digitar('!')
  openDocument(ed, 'A', doc('versão do banco'))
  assert.equal(ed.getText(), 'versão do banco')
  assert.equal(ed.can().undo(), false)
})
