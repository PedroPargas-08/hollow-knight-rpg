import { LinkButton, Panel } from '../components/ui';
import { Icon } from '../components/Icon';
import { MaskGlyph } from '../components/domain';
import { Link } from '../app/router';
import { APP_NAME, APP_TAGLINE } from '../data/demo';
import { categories } from '../data/rules';
import type { IconName } from '../types';

const pillars: { n: string; icon: IconName; title: string; text: string }[] = [
  { n: 'I', icon: 'sheet', title: 'Fichas vivas', text: 'Atributos, PV, ALMA, habilidades e equipamento organizados em abas legíveis — no computador ou no celular.' },
  { n: 'II', icon: 'crown', title: 'A mesa do mestre', text: 'Sessão, missões, criaturas, mapas e recompensas separados do que os jogadores enxergam.' },
  { n: 'III', icon: 'scroll', title: 'Compêndio de regras', text: 'Um livro de regras navegável por categorias e busca, com espaço para regras locais de cada campanha.' },
];
const doors: { icon: IconName; who: string; text: string }[] = [
  { icon: 'eye', who: 'Visitante', text: 'Lê a apresentação e as regras públicas. Não vê fichas, campanhas privadas nem mapas secretos.' },
  { icon: 'user', who: 'Jogador', text: 'Acompanha seu personagem, suas campanhas e as regiões que lhe foram reveladas.' },
  { icon: 'crown', who: 'Mestre', text: 'Conduz as próprias campanhas. Não administra a plataforma nem campanhas alheias.' },
];

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="hero-mask" aria-hidden="true"><span className="ring r1" /><span className="ring r2" /><span className="ring r3" /><MaskGlyph className="mask-big" /></div>
        <p className="eyebrow">RPG de mesa · reino subterrâneo</p>
        <h1 className="hero-title">{APP_NAME}</h1>
        <p className="hero-sub">{APP_TAGLINE}</p>
        <p className="hero-lead">Desça às ruínas, colecione ecos de almas e decida o que o reino deve lembrar. Uma plataforma para conduzir e jogar campanhas — fichas, missões, mapas e regras num só lugar.</p>
        <div className="row hero-cta">
          <LinkButton to="/entrar" variant="primary" icon="door">Entrar</LinkButton>
          <LinkButton to="/cadastro" icon="user">Criar conta</LinkButton>
          <Link to="/regras" className="hero-link">Consultar as regras públicas →</Link>
        </div>
        <span className="badge badge-demo" style={{ marginTop: '1.2rem' }}>Nome provisório · demonstração da Fase 1</span>
      </section>

      <div className="pub-wrap">
        <ol className="pillars" aria-label="O que a plataforma guarda">
          {pillars.map((p) => (
            <li key={p.n}>
              <span className="numeral" aria-hidden="true">{p.n}</span>
              <div><h2><Icon name={p.icon} /> {p.title}</h2><p>{p.text}</p></div>
            </li>
          ))}
        </ol>

        <h2 className="center-title">Três portas, três limites</h2>
        <div className="doors">
          {doors.map((d) => (
            <div key={d.who} className="door"><Icon name={d.icon} /><h3>{d.who}</h3><p className="dim">{d.text}</p></div>
          ))}
        </div>

        <Panel title="Um vislumbre do compêndio" icon="scroll" className="peek">
          <p className="dim">Dezesseis capítulos previstos, do básico às ferramentas do mestre. O conteúdo atual é apenas ilustrativo.</p>
          <div className="chips">
            {categories.filter((c) => !c.masterOnly).slice(0, 8).map((c) => <Link key={c.slug} to={`/regras/${c.slug}`} className="chip">{c.title}</Link>)}
            <Link to="/regras" className="chip chip-more">Ver todas →</Link>
          </div>
        </Panel>
      </div>
    </>
  );
}
