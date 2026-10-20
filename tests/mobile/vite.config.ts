import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

const root = path.resolve(import.meta.dirname, '../..');
const real = path.join(root, 'src/lib/supabase.ts');
const mock = path.join(import.meta.dirname, 'supabase-mock.ts');

// Só para testes locais: importa o app real e troca o cliente por dados fictícios.
// Não carrega .env, não autentica e não consulta contas ou livros reais.
export default defineConfig({
  root,
  envDir: false,
  plugins: [react(), tailwindcss(), {
    name: 'supabase-ficticio-celular',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!source.includes('supabase') || !importer?.startsWith(path.join(root, 'src'))) return null;
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
      return resolved?.id === real ? mock : null;
    },
  }],
  resolve: { alias: { '@': root } },
  server: { host: '127.0.0.1', port: 4318, strictPort: true, hmr: false },
});
