import { useEffect, useMemo, useState } from 'react';
import { Link, navigate } from '../app/router';
import { useDemo } from '../app/demo';
import { Alert, Badge, EmptyState, LinkButton, PageHead, Panel } from '../components/ui';
import { Icon } from '../components/Icon';
import { articles, articlesOf, categories, categoryBySlug, findArticle, PROVISORIO, type Article, type Block } from '../data/rules';
import { searchArticles } from '../lib/search';
import { NotFoundPage } from './Misc';

function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="prose">{blocks.map((b, i) => {
      switch (b.t) {
        case 'p': return <p key={i}>{b.text}</p>;
        case 'h': return <h3 key={i}>{b.text}</h3>;
        case 'list': return <ul key={i}>{b.items.map((x) => <li key={x}>{x}</li>)}</ul>;
        case 'example': return <aside key={i} className="callout callout-example"><strong>Exemplo</strong><p>{b.text}</p></aside>;
        case 'warn': return <aside key={i} className="callout callout-warn"><strong>Aviso</strong><p>{b.text}</p></aside>;
        case 'table': return <div key={i} className="table-wrap"><table><thead><tr>{b.head.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k}>{c}</td>)}</tr>)}</tbody></table></div>;
      }
    })}</div>
  );
}

function Locked({ title }: { title: string }) {
  return <Panel><EmptyState icon="lock" title="Conteúdo restrito ao mestre" action={<LinkButton to="/regras">Voltar ao compêndio</LinkButton>}>“{title}” é reservado ao mestre. Na Fase 1 a restrição é apenas visual; a imposição real virá no servidor.</EmptyState></Panel>;
}

export function RulesPage({ cat, art }: { cat?: string; art?: string }) {
  const { role } = useDemo();
  const isMaster = role === 'mestre';
  const [q, setQ] = useState('');
  useEffect(() => setQ(''), [cat, art]); // navegar (ex.: abrir um resultado) encerra a pesquisa
  const visible = useMemo(() => articles.filter((a) => isMaster || a.scope !== 'mestre'), [isMaster]);
  const results = useMemo(() => searchArticles(visible, q), [visible, q]);
  const category = cat ? categoryBySlug(cat) : undefined;
  const article = cat && art ? findArticle(cat, art) : undefined;
  if ((cat && !category) || (art && !article)) return <NotFoundPage />;

  const searching = q.trim().length > 1;
  const catArticles = category ? articlesOf(category.slug) : [];
  const idx = article ? catArticles.findIndex((a) => a.slug === article.slug) : -1;

  return (
    <>
      <PageHead eyebrow="Compêndio" title="Regras e mecânicas">
        As regras gerais valem para todas as campanhas. Cada mestre poderá ter regras opcionais ou ajustes locais, sem mudar as regras globais.
      </PageHead>
      <div className="rules">
        <details className="rules-nav" open={typeof window !== 'undefined' && window.innerWidth >= 900}>
          <summary>Categorias</summary>
          <nav aria-label="Categorias de regras"><ol>{categories.map((c) => {
            const locked = !!c.masterOnly && !isMaster;
            return <li key={c.slug}><Link to={`/regras/${c.slug}`} aria-current={cat === c.slug ? 'page' : undefined}><span className="n">{c.n}</span><span>{c.title}</span>{locked && <Icon name="lock" label="Restrito ao mestre" />}</Link></li>;
          })}</ol></nav>
        </details>

        <div className="rules-main">
          <div className="input-wrap" style={{ marginBottom: '1rem' }}>
            <label className="sr-only" htmlFor="rules-q">Pesquisar nas regras</label>
            <input id="rules-q" className="input" type="search" placeholder="Pesquisar nas regras (ex.: ALMA, turno, inventário)…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {searching ? (
            <Panel title={`Resultados para “${q.trim()}”`} icon="search" actions={<Badge>{results.length}</Badge>}>
              {results.length === 0 ? <EmptyState icon="search" title="Nada encontrado">Nenhum artigo de demonstração contém esse termo. A pesquisa só considera os textos provisórios atuais.</EmptyState> : (
                <ul className="list" aria-label="Resultados da pesquisa">{results.map((a: Article) => (
                  <li key={a.category + a.slug} className="list-row"><div className="grow"><Link to={`/regras/${a.category}/${a.slug}`}><strong>{a.title}</strong></Link><span className="dim small">{a.summary}</span></div><Badge>{categoryBySlug(a.category)?.title}</Badge></li>))}</ul>)}
            </Panel>
          ) : !category ? (
            <>
              <Alert tone="warn">{PROVISORIO}. Todo o conteúdo abaixo é ilustrativo.</Alert>
              <div className="cat-list">{categories.map((c) => {
                const locked = !!c.masterOnly && !isMaster;
                return (
                  <Link key={c.slug} to={`/regras/${c.slug}`} className="cat" data-locked={locked || undefined}>
                    <span className="cat-n">{String(c.n).padStart(2, '0')}</span>
                    <span className="grow"><strong><Icon name={locked ? 'lock' : c.icon} /> {c.title}</strong><span className="dim small" style={{ display: 'block' }}>{locked ? 'Restrito ao mestre' : c.summary}</span></span>
                    <Icon name="chevron" />
                  </Link>);
              })}</div>
            </>
          ) : category.masterOnly && !isMaster ? <Locked title={category.title} /> : !article ? (
            <>
              <nav className="crumbs" aria-label="Você está em"><Link to="/regras">Regras</Link> <Icon name="chevron" /> <span>{category.title}</span></nav>
              <h2>{category.n}. {category.title}</h2><p className="dim">{category.summary}</p>
              <Alert tone="warn">{PROVISORIO}.</Alert>
              <ul className="list" style={{ marginTop: '1rem' }}>{catArticles.map((a) => <li key={a.slug} className="list-row"><Icon name="scroll" /><div className="grow"><Link to={`/regras/${category.slug}/${a.slug}`}><strong>{a.title}</strong></Link><span className="dim small">{a.summary}</span></div></li>)}</ul>
              <LinkButton to="/regras" icon="back" size="sm">Todas as categorias</LinkButton>
            </>
          ) : (
            <article className="fade-in">
              <nav className="crumbs" aria-label="Você está em"><Link to="/regras">Regras</Link> <Icon name="chevron" /> <Link to={`/regras/${category.slug}`}>{category.title}</Link> <Icon name="chevron" /> <span>{article.title}</span></nav>
              <div className="row" style={{ marginBottom: '.4rem' }}><Badge tone="accent">{article.scope === 'global' ? 'Regra global' : 'Exclusivo do mestre'}</Badge></div>
              <h2 style={{ fontSize: '1.7rem' }}>{article.title}</h2>
              <p className="dim">{article.summary}</p>
              <Alert tone="warn">{PROVISORIO}.</Alert>
              <Blocks blocks={article.blocks} />
              <Alert tone="info" icon="flag"><strong>Regras locais:</strong> uma campanha poderá ter variações deste artigo sem alterar a regra global. (Planejado)</Alert>
              <hr className="divider" />
              <div className="row row-between">
                <LinkButton to={`/regras/${category.slug}`} icon="back" size="sm">Voltar à categoria</LinkButton>
                <div className="row">
                  {idx > 0 && <LinkButton to={`/regras/${category.slug}/${catArticles[idx - 1].slug}`} size="sm" variant="ghost">← {catArticles[idx - 1].title}</LinkButton>}
                  {idx < catArticles.length - 1 && <LinkButton to={`/regras/${category.slug}/${catArticles[idx + 1].slug}`} size="sm" variant="ghost">{catArticles[idx + 1].title} →</LinkButton>}
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
    </>
  );
}
export const goToRules = () => navigate('/regras');
