import type { Article } from '../data/rules';

/** Remove acentos e caixa para comparar textos em português. */
export const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function articleText(a: Article): string {
  const body = a.blocks.map((b) => {
    if (b.t === 'table') return [...b.head, ...b.rows.flat()].join(' ');
    if (b.t === 'list') return b.items.join(' ');
    return b.text;
  });
  return [a.title, a.summary, a.tags.join(' '), ...body].join(' ');
}

/** Busca simples por termos (todos devem aparecer). Título pesa mais que o corpo. */
export function searchArticles(articles: Article[], query: string): Article[] {
  const terms = normalize(query).split(/\s+/).filter((t) => t.length > 1);
  if (!terms.length) return [];
  return articles
    .map((a) => {
      const title = normalize(a.title + ' ' + a.tags.join(' '));
      const all = normalize(articleText(a));
      if (!terms.every((t) => all.includes(t))) return null;
      return { a, score: terms.reduce((n, t) => n + (title.includes(t) ? 3 : 1), 0) };
    })
    .filter((x): x is { a: Article; score: number } => x !== null)
    .sort((x, y) => y.score - x.score)
    .map((x) => x.a);
}
