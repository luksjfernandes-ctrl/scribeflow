import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { appendLostToNotes, conflictSnapshot, mergeMetadata, needsConflictSnapshot, resolveConflict, theirsOnly } from '../src/lib/conflict.ts'
import type { DocumentMetadata } from '../src/types.ts'

const meta = (m: Partial<DocumentMetadata> = {}): DocumentMetadata => ({
  status: 'To Do', label: 'none', label_color: 'transparent', subtitle: '', synopsis: '', notes: '',
  target_word_count: 0, is_include_in_compile: true, section_type: 'Heading', created_at: 1, updated_at: 1,
  keywords: [], custom_metadata: {}, snapshots: [], comments: [], bookmarks: [], ...m,
})
const com = (id: string, text: string) => ({ id, text, author: 'L', timestamp: 1, color: '#ff0' })

// ---------- corpo ----------
test('corpo: texto de outra aba gravado no meio pede snapshot', () => {
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p>base AbaA</p>', '<p>base AbaB</p>'), true)
})

test('corpo: sem conflito real nao ha snapshot', () => {
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p>base</p>', '<p>base mais</p>'), false)
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p>nosso</p>', '<p>nosso</p>'), false)
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p><strong>base</strong></p>', '<p>x</p>'), false)
  assert.equal(needsConflictSnapshot('<p>base</p>', '<p></p>', '<p>x</p>'), false)
})

test('corpo: snapshot traz o texto da outra aba e avisa no titulo', () => {
  assert.deepEqual(conflictSnapshot('Capítulo 1', '<p>AbaA</p>', 'id1', 42),
    { id: 'id1', timestamp: 42, title: 'Capítulo 1 (versão de outra aba)', content: '<p>AbaA</p>' })
})

// ---------- metadata: campo que so uma aba mudou ----------
test('metadata: cada aba mudou um campo diferente -> as duas mudancas ficam', () => {
  const base = meta()
  const ours = meta({ subtitle: 'Sub nosso', status: 'First Draft' })
  const theirs = meta({ synopsis: 'Sinopse deles', label: 'red', target_word_count: 3000 })
  const { merged, lost } = mergeMetadata(base, ours, theirs)
  assert.equal(merged.subtitle, 'Sub nosso')
  assert.equal(merged.status, 'First Draft')
  assert.equal(merged.synopsis, 'Sinopse deles')
  assert.equal(merged.label, 'red')
  assert.equal(merged.target_word_count, 3000)
  assert.deepEqual(lost, [])
})

test('metadata: so a outra aba mudou -> a mudanca dela vence o nosso valor antigo', () => {
  const { merged } = mergeMetadata(meta({ notes: 'n' }), meta({ notes: 'n' }), meta({ notes: 'n editada' }))
  assert.equal(merged.notes, 'n editada')
})

test('metadata: as duas mudaram igual -> sem perda', () => {
  const { merged, lost } = mergeMetadata(meta(), meta({ subtitle: 'igual' }), meta({ subtitle: 'igual' }))
  assert.equal(merged.subtitle, 'igual')
  assert.deepEqual(lost, [])
})

// ---------- metadata: campo de texto que as duas mudaram ----------
test('metadata: subtitulo, sinopse e notas mudados nas duas -> vence o nosso, o deles vai para lost', () => {
  const base = meta({ subtitle: 'S', synopsis: 'Y', notes: 'N' })
  const ours = meta({ subtitle: 'S nosso', synopsis: 'Y nossa', notes: 'N nossa' })
  const theirs = meta({ subtitle: 'S deles', synopsis: 'Y deles', notes: 'N deles' })
  const { merged, lost } = mergeMetadata(base, ours, theirs)
  assert.equal(merged.subtitle, 'S nosso')
  assert.equal(merged.synopsis, 'Y nossa')
  // guarda so o trecho que so a outra aba tem (o comum ja esta no nosso)
  assert.deepEqual(lost, [
    { field: 'subtítulo', text: 'deles' },
    { field: 'sinopse', text: 'deles' },
    { field: 'notas', text: 'deles' },
  ])
  const final = appendLostToNotes(merged, lost, '26/09 21:03')
  // nenhum texto some: o nosso nos campos, o deles no fim das notas
  for (const t of ['N nossa', 'deles']) assert.ok(final.notes.includes(t), t)
  assert.ok(final.notes.includes('[Trecho de outra aba · subtítulo · 26/09 21:03]'))
})

test('metadata: campo de escolha (status, rotulo) nas duas -> vence o nosso, sem ir para as notas', () => {
  const { merged, lost } = mergeMetadata(meta(), meta({ status: 'Final Draft', label: 'red' }), meta({ status: 'Revised Draft', label: 'blue' }))
  assert.equal(merged.status, 'Final Draft')
  assert.equal(merged.label, 'red')
  assert.deepEqual(lost, [])
})

test('metadata: texto da outra aba vazio nao gera bloco nas notas', () => {
  const { lost } = mergeMetadata(meta({ subtitle: 'S' }), meta({ subtitle: 'S2' }), meta({ subtitle: '' }))
  assert.deepEqual(lost, [])
})

// ---------- custom_metadata ----------
test('custom_metadata: chaves juntadas por tres vias; texto disputado vai para lost', () => {
  const base = meta({ custom_metadata: { pov: 'Ana', lugar: 'Unaí' } })
  const ours = meta({ custom_metadata: { pov: 'Ana', lugar: 'Paracatu', tempo: 'manhã' } })
  const theirs = meta({ custom_metadata: { pov: 'Bia', lugar: 'Brasília' } })
  const { merged, lost } = mergeMetadata(base, ours, theirs)
  assert.deepEqual(merged.custom_metadata, { pov: 'Bia', lugar: 'Paracatu', tempo: 'manhã' })
  assert.deepEqual(lost, [{ field: 'campo "lugar"', text: 'Brasília' }])
})

// ---------- listas ----------
test('comentarios: uniao por id (cada aba criou um)', () => {
  const base = meta({ comments: [com('c0', 'antigo')] })
  const { merged } = mergeMetadata(base,
    meta({ comments: [com('c0', 'antigo'), com('cA', 'da aba A')] }),
    meta({ comments: [com('c0', 'antigo'), com('cB', 'da aba B')] }))
  assert.deepEqual(merged.comments.map(c => c.id), ['c0', 'cA', 'cB'])
})

test('comentarios: apagado numa aba e intacto na outra -> fica apagado (nao ressuscita)', () => {
  const base = meta({ comments: [com('c0', 'x'), com('c1', 'y')] })
  const { merged } = mergeMetadata(base, meta({ comments: [com('c1', 'y')] }), meta({ comments: [com('c0', 'x'), com('c1', 'y')] }))
  assert.deepEqual(merged.comments.map(c => c.id), ['c1'])
  const inverso = mergeMetadata(base, meta({ comments: [com('c0', 'x'), com('c1', 'y')] }), meta({ comments: [com('c1', 'y')] }))
  assert.deepEqual(inverso.merged.comments.map(c => c.id), ['c1'])
})

test('comentarios: apagado numa aba e EDITADO na outra -> fica (texto nao some)', () => {
  const base = meta({ comments: [com('c0', 'x')] })
  const { merged } = mergeMetadata(base, meta({ comments: [] }), meta({ comments: [com('c0', 'x editado')] }))
  assert.deepEqual(merged.comments.map(c => c.text), ['x editado'])
})

test('comentarios: mesmo comentario editado nas duas -> vence o nosso, o texto deles vai para lost', () => {
  const base = meta({ comments: [com('c0', 'x')] })
  const { merged, lost } = mergeMetadata(base, meta({ comments: [com('c0', 'x nosso')] }), meta({ comments: [com('c0', 'x deles')] }))
  assert.deepEqual(merged.comments.map(c => c.text), ['x nosso'])
  assert.deepEqual(lost, [{ field: 'comentário', text: 'deles' }])
})

test('marcadores e palavras-chave: uniao (palavra-chave pela chave de texto)', () => {
  const base = meta({ bookmarks: [{ id: 'b0', title: 'B0' }], keywords: [{ text: 'amor', color: '#f00' }] })
  const ours = meta({ bookmarks: [{ id: 'b0', title: 'B0' }, { id: 'bA', title: 'BA' }], keywords: [{ text: 'amor', color: '#f00' }, { text: 'guerra', color: '#0f0' }] })
  const theirs = meta({ bookmarks: [{ id: 'bB', title: 'BB' }], keywords: [{ text: 'amor', color: '#f00' }, { text: 'paz', color: '#00f' }] })
  const { merged } = mergeMetadata(base, ours, theirs)
  // b0 foi apagado pela outra aba sem edicao nossa: sai
  assert.deepEqual(merged.bookmarks.map(b => b.id), ['bA', 'bB'])
  assert.deepEqual(merged.keywords.map(k => k.text), ['amor', 'guerra', 'paz'])
})

test('snapshots: os das duas abas ficam', () => {
  const s = (id: string) => ({ id, timestamp: 1, title: id, content: '<p>' + id + '</p>' })
  const { merged } = mergeMetadata(meta({ snapshots: [s('s0')] }), meta({ snapshots: [s('sA'), s('s0')] }), meta({ snapshots: [s('sB'), s('s0')] }))
  assert.deepEqual(merged.snapshots.map(x => x.id), ['sA', 's0', 'sB'])
})

test('ordem das chaves no jsonb nao conta como mudanca', () => {
  const base = meta({ custom_metadata: { a: '1', b: '2' } })
  const theirs = { ...meta(), custom_metadata: { b: '2', a: '1' }, synopsis: 'deles' }
  const { merged, lost } = mergeMetadata(base, meta({ custom_metadata: { a: '1', b: '2' }, subtitle: 'nosso' }), theirs)
  assert.equal(merged.subtitle, 'nosso')
  assert.equal(merged.synopsis, 'deles')
  assert.deepEqual(lost, [])
})

// ---------- resolveConflict (corpo + titulo + metadata juntos) ----------
test('resolveConflict: corpo vira snapshot, titulo perdedor e subtitulo perdedor vao para as notas', () => {
  const base = { updatedAt: 1, title: 'Cap', content: '<p>base</p>', metadata: meta({ subtitle: 'S' }) }
  const r = resolveConflict({
    base,
    ours: { title: 'Cap nosso', content: '<p>base nossa</p>', metadata: meta({ subtitle: 'S nosso' }) },
    current: { title: 'Cap deles', content: '<p>base deles</p>', metadata: meta({ subtitle: 'S deles', synopsis: 'nova sinopse' }) },
    snapshotId: 'snap1', now: 99, stamp: '26/09 21:03',
  })
  assert.equal(r.snapshot?.content, '<p>base deles</p>')
  assert.equal(r.metadata.snapshots[0].id, 'snap1')
  assert.equal(r.metadata.subtitle, 'S nosso')
  assert.equal(r.metadata.synopsis, 'nova sinopse')
  assert.ok(r.metadata.notes.includes('[Trecho de outra aba · subtítulo · 26/09 21:03]\ndeles'))
  assert.ok(r.metadata.notes.includes('[Trecho de outra aba · título · 26/09 21:03]\ndeles'))
})

test('resolveConflict: so corpo enviado, metadata da outra aba e preservado', () => {
  const r = resolveConflict({
    base: { updatedAt: 1, title: 'Cap', content: '<p>a</p>', metadata: meta() },
    ours: { content: '<p>a b</p>' },
    current: { title: 'Cap', content: '<p>a</p>', metadata: meta({ synopsis: 'sinopse deles' }) },
    snapshotId: 's', now: 1, stamp: 'x',
  })
  assert.equal(r.snapshot, null)
  assert.equal(r.metadata.synopsis, 'sinopse deles')
  assert.deepEqual(r.lost, [])
})

test('theirsOnly: so o trecho da outra aba, cortado por palavra', () => {
  assert.equal(theirsOnly('Sub caso SubA-1', 'Sub caso SubB-1'), 'SubB-1')
  assert.equal(theirsOnly('notas antigas NotaA2', 'notas antigas NotaB2'), 'NotaB2')
  assert.equal(theirsOnly('começo A fim', 'começo B C fim'), 'B C')
  // a outra aba so apagou: nada a guardar
  assert.equal(theirsOnly('um dois tres', 'um tres'), '')
  assert.equal(theirsOnly('', 'tudo novo'), 'tudo novo')
  assert.equal(theirsOnly('x', ''), '')
})

test('notas disputadas repetidas nao duplicam o texto comum', () => {
  const base = meta({ notes: 'Nota longa com muito texto.' })
  const { merged, lost } = mergeMetadata(base, meta({ notes: 'Nota longa com muito texto. A' }), meta({ notes: 'Nota longa com muito texto. B' }))
  const final = appendLostToNotes(merged, lost, 't')
  assert.equal(final.notes, 'Nota longa com muito texto. A\n\n[Trecho de outra aba · notas · t]\nB')
})
