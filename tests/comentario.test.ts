// Apagar um comentário não pode levar junto outro comentário no mesmo trecho.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { EditorState, TextSelection } from '@tiptap/pm/state'
import { CommentMark } from '../src/extensions/commentMark'

const schema = getSchema([StarterKit, CommentMark])
const tipo = schema.marks.comment

function estado() {
  const doc = schema.node('doc', null, [schema.node('paragraph', null, [schema.text('hello world')])])
  let s = EditorState.create({ schema, doc })
  // A em "hello world" (1..12), B só em "world" (7..12): comentários sobrepostos.
  s = s.apply(s.tr.addMark(1, 12, tipo.create({ commentId: 'A' })))
  s = s.apply(s.tr.addMark(7, 12, tipo.create({ commentId: 'B' })))
  return s
}

function remover(s: EditorState, id: string) {
  const cmds = (CommentMark.config.addCommands as Function).call({ name: 'comment' })
  const tr = s.tr.setSelection(TextSelection.create(s.doc, 1))
  const ok = cmds.removeComment(id)({ tr, state: s, dispatch: () => {} })
  return { ok, s: s.apply(tr) }
}

const trechos = (s: EditorState) => {
  const out: [string, string[]][] = []
  s.doc.descendants((n) => {
    if (n.isText) out.push([n.text!, n.marks.map((m) => m.attrs.commentId).sort()])
  })
  return out
}

test('estado de partida tem A e B sobrepostos em "world"', () => {
  assert.deepEqual(trechos(estado()), [['hello ', ['A']], ['world', ['A', 'B']]])
})

test('apagar B mantém A no trecho inteiro', () => {
  const { ok, s } = remover(estado(), 'B')
  assert.equal(ok, true)
  assert.deepEqual(trechos(s), [['hello world', ['A']]])
})

test('apagar A mantém B em "world"', () => {
  const { s } = remover(estado(), 'A')
  assert.deepEqual(trechos(s), [['hello ', []], ['world', ['B']]])
})

test('id inexistente não muda nada', () => {
  const { ok, s } = remover(estado(), 'Z')
  assert.equal(ok, false)
  assert.deepEqual(trechos(s), trechos(estado()))
})
