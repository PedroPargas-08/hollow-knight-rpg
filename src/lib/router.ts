export type Params = Record<string, string>;

/** Compara um padrão como `/regras/:cat/:art` com um caminho. Retorna os parâmetros ou null. */
export function matchRoute(pattern: string, path: string): Params | null {
  const a = pattern.split('/').filter(Boolean);
  const b = path.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params: Params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) {
      try { params[a[i].slice(1)] = decodeURIComponent(b[i]); } catch { return null; }
    } else if (a[i] !== b[i]) return null;
  }
  return params;
}

/** Converte `#/rota?x=1` em caminho normalizado + query. */
export function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const raw = hash.replace(/^#/, '') || '/';
  const [p, q = ''] = raw.split('?');
  return { path: '/' + p.split('/').filter(Boolean).join('/'), query: new URLSearchParams(q) };
}

/** Um item de menu `to` (com ou sem `?aba=`) está ativo para a rota atual? */
export function isActiveTo(to: string, path: string, query: URLSearchParams, defaultTab?: string): boolean {
  const [p, q] = to.split('?');
  const target = '/' + p.split('/').filter(Boolean).join('/');
  if (target !== path) return false;
  if (!q) return true;
  const want = new URLSearchParams(q).get('aba');
  return (query.get('aba') ?? defaultTab ?? '') === want;
}
