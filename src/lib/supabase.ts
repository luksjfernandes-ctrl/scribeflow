import { createClient } from '@supabase/supabase-js';
import { cleanEnv } from './env';

// trim: um "\n" no fim da chave derrubava o realtime em produção (ver lib/env.ts).
const supabaseUrl = cleanEnv(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY);

// Falha explicita: passar undefined adiante faz o supabase-js lancar
// "supabaseUrl is required" e a pagina abre em branco, sem pista da causa.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuracao ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
      '(copie .env.example para .env.local). Veja o README.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Usados pelo envio com keepalive na descarga da pagina (ver App.tsx), que nao
// pode esperar o supabase-js buscar a sessao de forma assincrona.
export { supabaseUrl, supabaseAnonKey };
