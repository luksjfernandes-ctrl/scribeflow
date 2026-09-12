import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Falha explicita: passar undefined adiante faz o supabase-js lancar
// "supabaseUrl is required" e a pagina abre em branco, sem pista da causa.
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Configuracao ausente: defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY ' +
      '(copie .env.example para .env.local). Veja o README.',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
