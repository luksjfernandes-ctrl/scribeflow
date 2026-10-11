/**
 * Supabase fictício para testes de escrita: sessão fixa e tabelas locais.
 * Todo o capítulo é inventado. Não fala com a rede nem com a produção.
 */
type Row = Record<string, any>;

const now = Date.UTC(2026, 9, 10, 14, 0);
const PROJECT = 'demo-projeto';
const meta = (over: Row = {}) => ({
  status: 'To Do', label: 'none', label_color: 'transparent', synopsis: '', notes: '', target_word_count: 0,
  is_include_in_compile: true, section_type: 'Scene', created_at: now - 9 * 864e5, updated_at: now,
  keywords: [], custom_metadata: {}, snapshots: [], comments: [], bookmarks: [], ...over,
});
const folder = (id: string, title: string, order: number, role: string, type = 'folder', color?: string) => ({
  id, project_id: PROJECT, title, content: '', type, parent_id: null, order, updated_at: now,
  metadata: meta({ section_type: 'Heading', folder_role: role, ...(color ? { folder_color: color } : {}), is_include_in_compile: role === 'manuscript' }),
});
const doc = (id: string, title: string, parent: string, order: number, content: string, over: Row = {}, type = 'text') => ({
  id, project_id: PROJECT, title, content, type, parent_id: parent, order, updated_at: now, metadata: meta(over),
});

const CAP1 = [
  'O farol tinha de ser aceso antes que a neblina chegasse, e a neblina chegava às quatro. Elena sabia disso como sabia do próprio pulso, ou seja, não pensava nisso até que falhasse.',
  'O avô cuidou da luz por trinta e um anos. Tinha uma frase para o ofício, repetida tantas vezes que ficou lisa: o mar não quer saber se você está cansado. Aos doze anos, ela odiava a frase. Aos vinte e nove, subindo os mesmos cento e quarenta degraus com a mesma lata de latão, descobriu que não tinha nada melhor.',
  'No décimo quarto degrau havia uma lasca na pedra, com o formato de uma vírgula. Ela a tocava todas as vezes. Nunca decidiu por quê.',
].map((p) => `<p>${p}</p>`).join('');

const tables: Record<string, Row[]> = {
  projects: [{
    id: PROJECT, name: 'TESTE — O Faroleiro', owner_id: 'demo-user', updated_at: new Date(now).toISOString(),
    settings: { target_word_count: 50000, session_target: 1000, deadline: null, composition_theme: 'sepia', theme: 'traditional', paper_width: 800, background_opacity: 0.9, paragraph_style: 'book' },
  }],
  docs: [
    folder('f-man', 'Manuscrito', 0, 'manuscript'),
    folder('f-per', 'Personagens', 1, 'characters', 'folder', '#9B59B6'),
    folder('f-lug', 'Lugares', 2, 'places', 'folder', '#27AE60'),
    folder('f-pes', 'Pesquisa', 3, 'research', 'folder', '#3498DB'),
    folder('f-lix', 'Lixeira', 4, 'trash', 'trash', '#95A5A6'),
    doc('c1', 'Capítulo 1 – O faroleiro', 'f-man', 0, CAP1, {
      subtitle: 'em que se guarda uma luz, e uma promessa com ela',
      synopsis: 'Elena sobe para acender o farol antes da neblina. A rotina a mantém de pé; a lasca no degrau, ela não sabe explicar.',
      notes: 'Deixar o avô fora de cena por enquanto: ele funciona melhor como voz do que como personagem. Conferir quantos degraus tem o farol de verdade.',
      label: 'red', status: 'First Draft', target_word_count: 2500,
    }),
    doc('c2', 'Capítulo 2 – A neblina', 'f-man', 1, '<p>A neblina chegou às quatro e dez.</p>', { label: 'red' }),
    doc('c3', 'Capítulo 3 – O degrau', 'f-man', 2, '', { label: 'red' }),
    doc('p1', 'Elena', 'f-per', 0, '<p>Vinte e nove anos. Faroleira desde que o avô morreu.</p>', {}, 'characters'),
    doc('l1', 'O farol de Cabo Sereno', 'f-lug', 0, '<p>Cento e quarenta degraus de pedra.</p>', {}, 'places'),
    doc('r1', 'Notas', 'f-pes', 0, '', {}, 'research'),
  ],
};

// Simula apenas a persistência do servidor entre recargas deste teste.
// A fila e o editor continuam sendo os componentes reais do app.
try {
  const saved = localStorage.getItem('mobile-test-tables');
  if (saved) Object.assign(tables, JSON.parse(saved));
} catch { /* Armazenamento opcional na fixture. */ }

class Query implements PromiseLike<{ data: any; error: null }> {
  private filters: Array<(r: Row) => boolean> = [];
  private op: 'select' | 'insert' | 'update' | 'delete' | 'upsert' = 'select';
  private payload: any = null;
  private wantsRows = false;
  private one: 'single' | 'maybe' | null = null;
  constructor(private table: string) {}
  select() { this.wantsRows = true; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  upsert(p: any) { this.op = 'upsert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.filters.push((r) => r[c] === v); return this; }
  neq(c: string, v: any) { this.filters.push((r) => r[c] !== v); return this; }
  in(c: string, vs: any[]) { this.filters.push((r) => vs.includes(r[c])); return this; }
  is(c: string, v: any) { this.filters.push((r) => (r[c] ?? null) === v); return this; }
  order() { return this; }
  limit() { return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  private run() {
    const rows = (tables[this.table] ??= []);
    const match = (r: Row) => this.filters.every((f) => f(r));
    let data: any = null;
    if (this.op === 'insert' || this.op === 'upsert') {
      const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((r: Row) => structuredClone(r));
      rows.push(...list);
      data = this.wantsRows ? list : null;
    } else if (this.op === 'update') {
      const hit = rows.filter(match);
      hit.forEach((r) => Object.assign(r, structuredClone(this.payload)));
      data = this.wantsRows ? hit.map((r) => ({ ...r })) : null;
    } else if (this.op === 'delete') {
      tables[this.table] = rows.filter((r) => !match(r));
    } else {
      data = structuredClone(rows.filter(match));
    }
    if (this.op !== 'select') localStorage.setItem('mobile-test-tables', JSON.stringify(tables));
    if (this.one) data = Array.isArray(data) ? data[0] ?? null : data;
    return { data, error: null };
  }
  then<A, B>(ok?: ((v: { data: any; error: null }) => A | PromiseLike<A>) | null, fail?: ((e: any) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, fail);
  }
}

const session = { access_token: 'demo', user: { id: 'demo-user', email: 'leitora@exemplo.com', user_metadata: {} } };
const channel: any = { on: () => channel, subscribe: () => channel, unsubscribe: () => {} };

export const supabase: any = {
  from: (t: string) => new Query(t),
  channel: () => channel,
  removeChannel: () => {},
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: {}, error: null }),
    signInWithPassword: async () => ({ data: { session }, error: null }),
    signUp: async () => ({ data: {}, error: null }),
    resetPasswordForEmail: async () => ({ data: {}, error: null }),
  },
};
export const supabaseUrl = 'http://demo.invalid';
export const supabaseAnonKey = 'demo';
