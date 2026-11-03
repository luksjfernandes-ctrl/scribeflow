// A arvore do Binder nao pode ter ciclo: X dentro de Y e Y dentro de X faz a
// subarvore inteira sumir do Binder e da exportacao. Roda o supabase_schema.sql
// num Postgres de verdade (PGlite), como tests/schema-seguranca.test.ts.
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { before, test } from 'node:test'
import { PGlite } from '@electric-sql/pglite'
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp'

const A = '00000000-0000-0000-0000-00000000000a'
let db: PGlite

async function usr(sql: string, params: unknown[] = []) {
  await db.exec('BEGIN')
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [A])
    await db.exec('SET LOCAL ROLE authenticated')
    const r = await db.query<Record<string, unknown>>(sql, params)
    await db.exec('COMMIT')
    return { rows: r.rows, erro: undefined as string | undefined }
  } catch (e) {
    await db.exec('ROLLBACK')
    return { rows: [], erro: (e as Error).message }
  }
}
const pais = async () =>
  Object.fromEntries((await usr(`SELECT id, parent_id FROM public.docs ORDER BY id`)).rows.map((r) => [r.id, r.parent_id]))

before(async () => {
  db = await PGlite.create({ extensions: { uuid_ossp } })
  await db.exec(`
    CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE
      AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
    INSERT INTO auth.users VALUES ('${A}');
    CREATE PUBLICATION supabase_realtime;
  `)
  const schema = readFileSync(new URL('../supabase_schema.sql', import.meta.url), 'utf8')
  await db.exec(schema)
  await db.exec(schema) // idempotente

  await usr(`INSERT INTO public.projects(id, name, owner_id) VALUES ('P', 'Livro', $1)`, [A])
  // M (Manuscrito) > X, Y; Y > Z
  await usr(`INSERT INTO public.docs(id, project_id, title, type, parent_id) VALUES
    ('M', 'P', 'Manuscrito', 'folder', NULL)`)
  await usr(`INSERT INTO public.docs(id, project_id, title, type, parent_id) VALUES
    ('X', 'P', 'Pasta X', 'folder', 'M'), ('Y', 'P', 'Pasta Y', 'folder', 'M')`)
  await usr(`INSERT INTO public.docs(id, project_id, title, type, parent_id, content) VALUES
    ('Z', 'P', 'Cena', 'text', 'Y', '<p>texto da cena</p>')`)
})

test('duas abas: X dentro de Y numa, Y dentro de X na outra -> a segunda e recusada', async () => {
  // Cada aba conferiu o arraste contra o proprio estado (antigo): os dois
  // planDrop eram validos. Os dois UPDATEs chegam ao banco.
  assert.equal((await usr(`UPDATE public.docs SET parent_id = 'Y', "order" = 1 WHERE id = 'X'`)).erro, undefined)
  const segunda = await usr(`UPDATE public.docs SET parent_id = 'X', "order" = 0 WHERE id = 'Y'`)
  assert.match(segunda.erro ?? '', /scribeflow_ciclo/)
  // A arvore continua presa ao Manuscrito: nada some.
  assert.deepEqual(await pais(), { M: null, X: 'Y', Y: 'M', Z: 'Y' })
})

test('ciclo mais longo (neto vira pai do avo) tambem e recusado', async () => {
  const r = await usr(`UPDATE public.docs SET parent_id = 'X' WHERE id = 'M'`)
  assert.match(r.erro ?? '', /scribeflow_ciclo/)
})

test('o item nao entra em si mesmo, nem ao nascer', async () => {
  assert.match((await usr(`UPDATE public.docs SET parent_id = 'Z' WHERE id = 'Z'`)).erro ?? '', /scribeflow_ciclo/)
  assert.match((await usr(`INSERT INTO public.docs(id, project_id, title, type, parent_id) VALUES ('W', 'P', 'w', 'text', 'W')`)).erro ?? '', /scribeflow_ciclo/)
})

test('mover, devolver para a raiz e reordenar continuam livres', async () => {
  assert.equal((await usr(`UPDATE public.docs SET parent_id = 'M' WHERE id = 'X'`)).erro, undefined)
  assert.equal((await usr(`UPDATE public.docs SET parent_id = 'X' WHERE id = 'Z'`)).erro, undefined)
  assert.equal((await usr(`UPDATE public.docs SET parent_id = NULL WHERE id = 'Y'`)).erro, undefined)
  assert.equal((await usr(`UPDATE public.docs SET "order" = "order" + 1`)).erro, undefined)
  assert.deepEqual(await pais(), { M: null, X: 'M', Y: null, Z: 'X' })
})

test('a checagem trava o livro, para a segunda aba esperar a primeira e ver o ciclo', async () => {
  await db.exec('BEGIN')
  try {
    await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [A])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(`UPDATE public.docs SET parent_id = 'M' WHERE id = 'Y'`)
    // O PGlite tem uma sessao so (pid nulo): conta as travas consultivas.
    const r = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory'`)
    assert.equal(r.rows[0].n, 1)
  } finally {
    await db.exec('ROLLBACK')
  }
})
