// Roda o supabase_schema.sql num Postgres de verdade (PGlite, em memoria) e
// confere as duas coisas que protegem o app publico: a RLS entre contas e os
// limites por usuario (secao 10). Regressao em qualquer uma quebra o CI.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { before, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const A = '00000000-0000-0000-0000-00000000000a'
const B = '00000000-0000-0000-0000-00000000000b'
const C = '00000000-0000-0000-0000-00000000000c'
const D = '00000000-0000-0000-0000-00000000000d'

let db: PGlite

/** Executa como `authenticated` (ou `anon`) com o usuario simulado, numa
 *  transacao propria. Erro vira `{ erro }` para o teste conferir a mensagem. */
async function como(papel: 'authenticated' | 'anon', uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec('BEGIN')
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid ?? ''])
    await db.exec(`SET LOCAL ROLE ${papel}`)
    const r = await db.query<Record<string, unknown>>(sql, params)
    await db.exec('COMMIT')
    return { rows: r.rows, n: r.affectedRows ?? r.rows.length, erro: undefined as string | undefined }
  } catch (e) {
    await db.exec('ROLLBACK')
    return { rows: [], n: 0, erro: (e as Error).message }
  }
}
const usr = (uid: string, sql: string, params?: unknown[]) => como('authenticated', uid, sql, params)
const aleatorio = (n: number) => `(SELECT string_agg(md5(random()::text || g::text), '') FROM generate_series(1, ${n}) g)`

before(async () => {
  db = await PGlite.create({ extensions: { uuid_ossp } })
  // O minimo do Supabase que o schema usa: papeis, auth.uid() e os grants padrao.
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    INSERT INTO auth.users VALUES ('${A}'), ('${B}'), ('${C}'), ('${D}');
    CREATE PUBLICATION supabase_realtime;
  `)
  const schema = readFileSync(new URL('../supabase_schema.sql', import.meta.url), 'utf8')
  await db.exec(schema)
  await db.exec(schema) // o README manda reexecutar; tem que ser idempotente

  await usr(A, `INSERT INTO public.projects(id, name, owner_id) VALUES ('PA', 'Livro A', $1)`, [A])
  await usr(A, `INSERT INTO public.docs(id, project_id, title, type, content) VALUES ('DA', 'PA', 'Cap A', 'text', 'segredo de A')`)
  await usr(B, `INSERT INTO public.projects(id, name, owner_id) VALUES ('PB', 'Livro B', $1)`, [B])
  await usr(B, `INSERT INTO public.docs(id, project_id, title, type) VALUES ('DB', 'PB', 'Cap B', 'text')`)
})

test('cada conta le os proprios dados e nada da outra', async () => {
  assert.equal((await usr(A, `SELECT * FROM public.docs`)).rows.length, 1)
  assert.equal((await usr(B, `SELECT * FROM public.projects WHERE owner_id = $1`, [A])).rows.length, 0)
  assert.equal((await usr(B, `SELECT * FROM public.docs WHERE project_id = 'PA'`)).rows.length, 0)
  assert.equal((await como('anon', null, `SELECT * FROM public.docs`)).rows.length, 0)
})

test('B nao grava, altera nem apaga nada de A', async () => {
  assert.ok((await usr(B, `INSERT INTO public.docs(id, project_id, title, type) VALUES ('X1', 'PA', 'x', 'text')`)).erro)
  assert.equal((await usr(B, `UPDATE public.projects SET name = 'roubado' WHERE id = 'PA'`)).n, 0)
  assert.equal((await usr(B, `DELETE FROM public.docs WHERE id = 'DA'`)).n, 0)
  assert.ok((await usr(B, `INSERT INTO public.projects(id, name, owner_id) VALUES ('PX', 'x', $1)`, [A])).erro)
  assert.ok((await usr(B, `UPDATE public.projects SET owner_id = $1 WHERE id = 'PB'`, [A])).erro)
  assert.ok((await usr(B, `UPDATE public.docs SET project_id = 'PA' WHERE id = 'DB'`)).erro)
  assert.ok((await usr(B, `INSERT INTO public.docs(id, project_id, title, type) VALUES ('DA', 'PB', 'x', 'text') ON CONFLICT (id) DO UPDATE SET title = 'sequestrado'`)).erro)
  assert.ok((await como('anon', null, `INSERT INTO public.projects(id, name, owner_id) VALUES ('PZ', 'x', $1)`, [A])).erro)
  const intacto = await usr(A, `SELECT title, content FROM public.docs WHERE id = 'DA'`)
  assert.deepEqual(intacto.rows[0], { title: 'Cap A', content: 'segredo de A' })
})

test('tamanho maximo por doc, metadata e titulo', async () => {
  let r = await usr(B, `INSERT INTO public.docs(id, project_id, title, type, content) VALUES ('BIG', 'PB', 'x', 'text', ${aleatorio(62600)})`)
  assert.match(r.erro ?? '', /docs_content_tamanho/)
  r = await usr(B, `UPDATE public.docs SET metadata = jsonb_build_object('snapshots', ${aleatorio(160000)}) WHERE id = 'DB'`)
  assert.match(r.erro ?? '', /docs_metadata_tamanho/)
  r = await usr(B, `UPDATE public.docs SET title = repeat('t', 1001) WHERE id = 'DB'`)
  assert.match(r.erro ?? '', /docs_title_tamanho/)
  r = await usr(C, `INSERT INTO public.projects(id, name, owner_id) VALUES ('CN', repeat('n', 501), $1)`, [C])
  assert.match(r.erro ?? '', /projects_name_tamanho/)
})

test('cota de 25 MB por conta, sem travar reordenar nem encolher', async () => {
  let gravados = 0
  let erro: string | undefined
  for (let i = 1; i <= 20 && !erro; i++) {
    const r = await usr(B, `INSERT INTO public.docs(id, project_id, title, type, content) VALUES ('OK${i}', 'PB', 'x', 'text', ${aleatorio(59000)})`)
    if (r.erro) erro = r.erro
    else gravados++
  }
  assert.equal(gravados, 13) // 13 x 1,9 MB cabem em 25 MB; o 14o nao
  assert.match(erro ?? '', /scribeflow_limite: espaco/)
  const maior = await usr(B, `UPDATE public.docs SET content = ${aleatorio(59000)} WHERE id = 'DB'`)
  assert.match(maior.erro ?? '', /scribeflow_limite: espaco/)
  const reordena = await usr(B, `UPDATE public.docs SET "order" = "order" + 1 WHERE project_id = 'PB'`)
  assert.equal(reordena.erro, undefined)
  assert.equal((await usr(B, `UPDATE public.docs SET content = 'curto' WHERE id = 'OK1'`)).erro, undefined)
  // A cota e por conta: A continua gravando normalmente.
  assert.equal((await usr(A, `INSERT INTO public.docs(id, project_id, title, type, content) VALUES ('A2', 'PA', 'x', 'text', ${aleatorio(59000)})`)).erro, undefined)
})

test('20.000 docs e 100 livros por conta', async () => {
  await usr(C, `INSERT INTO public.projects(id, name, owner_id) VALUES ('PC', 'Livro C', $1)`, [C])
  assert.equal((await usr(C, `INSERT INTO public.docs(id, project_id, title, type) SELECT 'C' || g, 'PC', 'x', 'text' FROM generate_series(1, 20000) g`)).erro, undefined)
  assert.match((await usr(C, `INSERT INTO public.docs(id, project_id, title, type) VALUES ('C20001', 'PC', 'x', 'text')`)).erro ?? '', /scribeflow_limite: docs/)
  assert.equal((await usr(D, `INSERT INTO public.projects(id, name, owner_id) SELECT 'D' || g, 'x', $1 FROM generate_series(1, 100) g`, [D])).erro, undefined)
  assert.match((await usr(D, `INSERT INTO public.projects(id, name, owner_id) VALUES ('D101', 'x', $1)`, [D])).erro ?? '', /scribeflow_limite: projetos/)
})
