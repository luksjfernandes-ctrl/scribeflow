// safeUrl: o link do marcador (Inspector) so pode ser http, https ou mailto,
// mas endereco digitado sem esquema nao pode sumir sem aviso.
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { safeUrl } from '../src/utils/sanitize'

test('endereco com porta ou com ":" no caminho nao perde o link', () => {
  assert.equal(safeUrl('localhost:3000'), 'https://localhost:3000')
  assert.equal(safeUrl('exemplo.com:8080/notas'), 'https://exemplo.com:8080/notas')
  assert.equal(safeUrl('youtube.com/watch?v=abc&t=1:30'), 'https://youtube.com/watch?v=abc&t=1:30')
  assert.equal(safeUrl('www.ex.com/a?hora=10:00'), 'https://www.ex.com/a?hora=10:00')
})

test('o que ja funcionava continua igual', () => {
  assert.equal(safeUrl('https://exemplo.com/a'), 'https://exemplo.com/a')
  assert.equal(safeUrl('http://exemplo.com:8080'), 'http://exemplo.com:8080')
  assert.equal(safeUrl('mailto:autora@exemplo.com'), 'mailto:autora@exemplo.com')
  assert.equal(safeUrl('exemplo.com'), 'https://exemplo.com')
  assert.equal(safeUrl('  exemplo.com/x  '), 'https://exemplo.com/x')
  assert.equal(safeUrl(''), null)
  assert.equal(safeUrl('   '), null)
  assert.equal(safeUrl(undefined), null)
})

test('esquema perigoso continua barrado, em qualquer grafia', () => {
  for (const ruim of [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    ' javascript:alert(1)',
    'java\tscript:alert(1)',
    'javascript:alert(1)//exemplo.com:80',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'blob:https://exemplo.com/uuid',
  ]) {
    const r = safeUrl(ruim)
    assert.ok(r === null || r.startsWith('https://'), `${JSON.stringify(ruim)} -> ${r}`)
    assert.ok(!/^\s*(javascript|data|vbscript|file|blob):/i.test(r ?? ''), ruim)
  }
})
