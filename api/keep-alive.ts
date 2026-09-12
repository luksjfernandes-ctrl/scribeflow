/**
 * Mantém o projeto Supabase acordado.
 *
 * O plano free do Supabase pausa um projeto após ~7 dias sem nenhuma
 * requisição, e não existe configuração do lado deles para desligar isso —
 * a única saída é bater na API periodicamente. Este projeto já pausou por
 * isso uma vez.
 *
 * Segue o mesmo padrão dos crons do fodmap-companion: Vercel Cron chamando
 * uma rota protegida por CRON_SECRET. A alternativa (GitHub Action agendada)
 * foi descartada porque o GitHub desabilita schedules em repos sem commits
 * por 60 dias — exatamente o cenário de um app dormente.
 */

export const config = { runtime: 'nodejs' }

export default async function handler(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return Response.json(
      { error: 'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes' },
      { status: 500 },
    )
  }

  // Consulta que realmente toca o Postgres. A RLS devolve [] para anônimo;
  // o que conta como atividade no projeto é o 200. Um GET em /rest/v1/ cru
  // devolve 401 e não serviria.
  const res = await fetch(`${url}/rest/v1/projects?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })

  if (!res.ok) {
    return Response.json(
      { ok: false, status: res.status, body: await res.text() },
      { status: 502 },
    )
  }

  return Response.json({ ok: true, checkedAt: new Date().toISOString() })
}
