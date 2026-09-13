import type { IncomingMessage, ServerResponse } from 'node:http'

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
 *
 * Assinatura Node (req, res), não Web API: num projeto Vite, as funções em
 * /api rodam no runtime Node clássico, onde `req.headers` é um objeto e não
 * tem `.get()`.
 */

function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  // .trim() dos dois lados: valor gravado via stdin pode carregar \n, e o
  // header pode vir com espaco. Sem isso a comparacao falha silenciosamente.
  const secret = process.env.CRON_SECRET?.trim()

  // Falha FECHADO. A versao anterior era `if (secret && given !== secret)`:
  // sem CRON_SECRET definido a guarda inteira sumia e o endpoint ficava
  // aberto — confirmado explorável no preview, que respondia 200 sem header.
  // A Vercel envia `Authorization: Bearer $CRON_SECRET` nas invocacoes
  // agendadas, entao exigir o secret nao quebra o cron.
  if (!secret) {
    console.error('[keep-alive] CRON_SECRET ausente; recusando por seguranca')
    return send(res, 503, { error: 'CRON_SECRET nao configurado' })
  }

  const given = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim()
  if (given !== secret) {
    // Sem o comprimento do segredo: era informacao gratuita para quem
    // chamasse sem credencial.
    console.log('[keep-alive] token nao confere')
    return send(res, 401, { error: 'Unauthorized' })
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return send(res, 500, {
      error: 'VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY ausentes',
    })
  }

  // Consulta que realmente toca o Postgres. A RLS devolve [] para anônimo;
  // o que conta como atividade no projeto é o 200. Um GET em /rest/v1/ cru
  // devolve 401 e não serviria.
  const r = await fetch(`${url}/rest/v1/projects?select=id&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })

  if (!r.ok) {
    return send(res, 502, { ok: false, status: r.status, body: await r.text() })
  }

  return send(res, 200, { ok: true, checkedAt: new Date().toISOString() })
}
