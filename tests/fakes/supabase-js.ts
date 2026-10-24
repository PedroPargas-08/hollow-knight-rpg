// CLIENTE FALSO — usado SOMENTE nos testes de interface (build com FAKE_SUPABASE=1). NÃO é o Supabase.
// Imita a API de @supabase/supabase-js e espelha a visibilidade do RLS para exercitar a UI. Não prova segurança.
const KEY = 'fake_db', SES = 'fake_session';
const w = window as any;
const load = () => JSON.parse(localStorage.getItem(KEY) || '{"users":[],"campaigns":[],"members":[],"characters":[],"invites":[]}');
const save = (db: any) => localStorage.setItem(KEY, JSON.stringify(db));
const uuid = () => crypto.randomUUID();
const listeners = new Set<(e: string, s: any) => void>();
const emit = (e: string, s: any) => listeners.forEach((l) => setTimeout(() => l(e, s), 0));
const sessionOf = (db = load()) => { const id = localStorage.getItem(SES); const u = db.users.find((x: any) => x.id === id); return u ? { access_token: 'fake', user: { id: u.id, email: u.email } } : null; };
const offline = () => w.__fake?.offline === true;
const fetchErr = () => ({ message: 'Failed to fetch', name: 'TypeError' });

w.__fake = {
  offline: false, lastReset: null as string | null,
  reset() { localStorage.removeItem(KEY); localStorage.removeItem(SES); },
  promote(email: string) { const db = load(); db.users.find((u: any) => u.email === email).role = 'mestre'; save(db); },
  confirm(email: string) { const db = load(); db.users.find((u: any) => u.email === email).confirmed = true; save(db); },
  expireSession() { localStorage.removeItem(SES); emit('SIGNED_OUT', null); },
  openRecoveryLink(email: string) { const db = load(); const u = db.users.find((x: any) => x.email === email); localStorage.setItem(SES, u.id); emit('PASSWORD_RECOVERY', sessionOf(db)); },
  db: () => load(),
};

const me = (db: any) => db.users.find((u: any) => u.id === localStorage.getItem(SES));
const isOwner = (db: any, cid: string, uid: string) => db.campaigns.some((c: any) => c.id === cid && c.owner_id === uid);
const isMember = (db: any, cid: string, uid: string) => isOwner(db, cid, uid) || db.members.some((m: any) => m.campaign_id === cid && m.user_id === uid);
const isAdmin = (db: any, cid: string, u: any) => u.role === 'mestre' && (isOwner(db, cid, u.id) || db.members.some((m: any) => m.campaign_id === cid && m.user_id === u.id && m.member_role === 'co_mestre'));
const deny = () => ({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } });

class Q {
  op = 'select'; f: ((r: any) => boolean)[] = []; payload: any; ret = false; ord: any; mode = '';
  constructor(public table: string) {}
  select() { if (this.op !== 'select') this.ret = true; return this; }
  insert(p: any) { this.op = 'insert'; this.payload = p; return this; }
  update(p: any) { this.op = 'update'; this.payload = p; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(c: string, v: any) { this.f.push((r) => r[c] === v); return this; }
  in(c: string, v: any[]) { this.f.push((r) => v.includes(r[c])); return this; }
  order(c: string, o: any) { this.ord = [c, o?.ascending !== false]; return this; }
  single() { this.mode = 'single'; return this; }
  maybeSingle() { this.mode = 'maybe'; return this; }
  then(res: any, rej: any) { return Promise.resolve(this.run()).then(res, rej); }

  visible(db: any, u: any): any[] {
    const t = this.table, id = u.id;
    if (t === 'profiles') return db.users.filter((x: any) => x.id === id || db.campaigns.some((c: any) => isMember(db, c.id, id) && isMember(db, c.id, x.id))).map((x: any) => ({ id: x.id, display_name: x.display_name, role: x.role }));
    if (t === 'campaigns') return db.campaigns.filter((c: any) => isMember(db, c.id, id));
    if (t === 'campaign_members') return db.members.filter((m: any) => isMember(db, m.campaign_id, id));
    return db.characters.filter((c: any) => (c.owner_id === id && isMember(db, c.campaign_id, id)) || isAdmin(db, c.campaign_id, u));
  }
  run(): any {
    if (offline()) return { data: null, error: fetchErr() };
    const db = load(), u = me(db);
    if (!u) return { data: null, error: { code: 'PGRST301', message: 'JWT expired' } };
    const now = new Date().toISOString(), t = this.table;
    const fin = (rows: any[]) => {
      if (this.ord) rows = [...rows].sort((a, b) => (a[this.ord[0]] > b[this.ord[0]] ? 1 : -1) * (this.ord[1] ? 1 : -1));
      if (this.mode === 'single') return rows.length === 1 ? { data: rows[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
      if (this.mode === 'maybe') return { data: rows[0] ?? null, error: null };
      return { data: rows, error: null };
    };
    if (this.op === 'select') return fin(this.visible(db, u).filter((r) => this.f.every((g) => g(r))));
    if (this.op === 'insert') {
      const p = this.payload;
      if (t === 'campaigns') { if (u.role !== 'mestre') return deny(); const r = { id: uuid(), status: 'preparacao', description: '', ...p, owner_id: u.id, created_at: now }; db.campaigns.push(r); save(db); return fin([r]); }
      if (t === 'characters') {
        if (!isMember(db, p.campaign_id, u.id)) return deny();
        if (p.stage && p.stage !== 1 && !isAdmin(db, p.campaign_id, u)) return deny();
        const r = { id: uuid(), stage: 1, ...p, owner_id: u.id, updated_at: now }; db.characters.push(r); save(db); return fin([r]);
      }
      return deny();
    }
    const rows = this.visible(db, u).filter((r) => this.f.every((g) => g(r)));
    if (this.op === 'update') {
      const out: any[] = [];
      for (const r of rows) {
        if (t === 'profiles') { if (r.id !== u.id) continue; db.users.find((x: any) => x.id === r.id).display_name = this.payload.display_name; out.push({ id: r.id }); }
        else if (t === 'characters') {
          const real = db.characters.find((c: any) => c.id === r.id);
          if (this.payload.stage !== undefined && this.payload.stage !== real.stage && !isAdmin(db, real.campaign_id, u)) return deny();
          Object.assign(real, this.payload, { updated_at: new Date().toISOString() }); out.push(real);
        }
      }
      save(db); return fin(out);
    }
    // delete
    const ids = new Set<string>();
    for (const r of rows) {
      if (t === 'campaigns' && r.owner_id === u.id && u.role === 'mestre') ids.add(r.id);
      if (t === 'campaign_members' && (r.user_id === u.id || isOwner(db, r.campaign_id, u.id))) ids.add(r.id);
      if (t === 'characters') ids.add(r.id);
    }
    const key = t === 'campaigns' ? 'campaigns' : t === 'campaign_members' ? 'members' : 'characters';
    const gone = db[key].filter((r: any) => ids.has(r.id)); db[key] = db[key].filter((r: any) => !ids.has(r.id));
    if (t === 'campaigns') { db.members = db.members.filter((m: any) => !ids.has(m.campaign_id)); db.characters = db.characters.filter((c: any) => !ids.has(c.campaign_id)); }
    save(db); return fin(gone.map((g: any) => ({ id: g.id })));
  }
}

export function createClient(_url: string, _key: string, _opts?: any) {
  return {
    from: (t: string) => new Q(t),
    async rpc(name: string, a: any) {
      if (offline()) return { data: null, error: fetchErr() };
      const db = load(), u = me(db); if (!u) return { data: null, error: { code: '28000', message: 'autenticação necessária' } };
      if (name === 'create_campaign_invite') {
        if (!isAdmin(db, a.p_campaign_id, u)) return { data: null, error: { code: '42501', message: 'permissão negada' } };
        const token = uuid().replace(/-/g, '') + uuid().replace(/-/g, ''); db.invites.push({ token, campaign_id: a.p_campaign_id, role: a.p_member_role, used: false }); save(db); return { data: token, error: null };
      }
      const inv = db.invites.find((i: any) => i.token === a.p_token && !i.used);
      if (!inv) return { data: null, error: { code: '22023', message: 'Convite inválido ou expirado' } };
      if (isMember(db, inv.campaign_id, u.id)) return { data: null, error: { code: '23505', message: 'Você já participa desta campanha' } };
      inv.used = true; db.members.push({ id: uuid(), campaign_id: inv.campaign_id, user_id: u.id, member_role: inv.role, created_at: new Date().toISOString() }); save(db);
      return { data: inv.campaign_id, error: null };
    },
    auth: {
      onAuthStateChange(cb: any) { listeners.add(cb); setTimeout(() => cb('INITIAL_SESSION', sessionOf()), 0); return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }; },
      async signInWithPassword({ email, password }: any) {
        if (offline()) return { data: {}, error: fetchErr() };
        const db = load(), user = db.users.find((x: any) => x.email === email);
        if (!user || user.password !== password) return { data: {}, error: { message: 'Invalid login credentials' } };
        if (!user.confirmed) return { data: {}, error: { message: 'Email not confirmed' } };
        localStorage.setItem(SES, user.id); const s = sessionOf(db); emit('SIGNED_IN', s); return { data: { session: s }, error: null };
      },
      async signUp({ email, password, options }: any) {
        if (offline()) return { data: {}, error: fetchErr() };
        const db = load();
        if (!db.users.some((x: any) => x.email === email)) { db.users.push({ id: uuid(), email, password, display_name: options?.data?.display_name || email.split('@')[0], role: 'jogador', confirmed: false }); save(db); }
        return { data: { session: null, user: {} }, error: null };   // resposta idêntica com ou sem conta existente
      },
      async signOut() { if (offline()) return { error: fetchErr() }; localStorage.removeItem(SES); emit('SIGNED_OUT', null); return { error: null }; },
      async resetPasswordForEmail(email: string) { if (offline()) return { error: fetchErr() }; w.__fake.lastReset = email; return { error: null }; },
      async updateUser({ password }: any) {
        const db = load(), u = me(db); if (!u) return { error: { message: 'Auth session missing' } };
        if (u.password === password) return { error: { message: 'New password should be different from the old password.' } };
        u.password = password; save(db); return { error: null };
      },
    },
  };
}
