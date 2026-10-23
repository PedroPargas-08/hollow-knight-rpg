import { useEffect, useState, type ReactNode } from 'react';
import { Link, navigate, useRoute } from '../app/router';
import { useDemo } from '../app/demo';
import { masterNav, playerNav, type NavGroup, type NavItem } from '../app/nav';
import { isActiveTo } from '../lib/router';
import { APP_NAME, DEMO_NOTE, notifications } from '../data/demo';
import { Icon } from './Icon';
import { Backdrop, MaskGlyph } from './domain';
import { Button, LinkButton, Seg } from './ui';
import { Modal } from './overlay';
import type { Role } from '../types';

const focusMain = () => document.getElementById('main')?.focus();
const SkipLink = () => <button className="skip" onClick={focusMain}>Pular para o conteúdo</button>;
const Brand = () => <Link to="/" className="brand" aria-label={`${APP_NAME} — página inicial`}><MaskGlyph /><span className="brand-name">{APP_NAME}</span></Link>;

/* ---------- Layouts públicos ---------- */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="pub">
      <SkipLink /><Backdrop />
      <header className="pub-header">
        <Brand />
        <nav className="pub-nav" aria-label="Principal">
          <LinkButton to="/regras" variant="ghost" size="sm" icon="scroll">Regras</LinkButton>
          <LinkButton to="/entrar" size="sm">Entrar</LinkButton>
          <LinkButton to="/cadastro" variant="primary" size="sm">Criar conta</LinkButton>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="pub-main">{children}</main>
      <footer className="pub-footer">
        <span>{APP_NAME} — nome provisório · protótipo de interface (Fase 1)</span>
        <span>Projeto independente, sem vínculo com Hollow Knight ou Team Cherry.</span>
      </footer>
    </div>
  );
}

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-wrap">
      <SkipLink /><Backdrop ruins={false} />
      <main id="main" tabIndex={-1} className="auth-card panel fade-in">
        <Brand />
        {children}
      </main>
    </div>
  );
}

/* ---------- Shell autenticado ---------- */
function NavEntry({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const { path, query } = useRoute();
  const anyChildActive = item.children?.some((c) => isActiveTo(c.to, path, query, c.to.includes('ficha') ? 'identidade' : undefined)) ?? false;
  const selfActive = !item.children && isActiveTo(item.to, path, query);
  const sameArea = item.children && (path === item.to || path.startsWith(item.to + '/'));
  const [open, setOpen] = useState(!!sameArea);
  useEffect(() => { if (sameArea) setOpen(true); }, [sameArea]);

  if (!item.children) {
    return (
      <Link to={item.to} className="sb-link" aria-current={selfActive ? 'page' : undefined} title={collapsed ? item.label : undefined}>
        <Icon name={item.icon} /><span className="sb-text">{item.label}</span>{item.tag && <span className="sb-tag">{item.tag}</span>}
      </Link>
    );
  }
  const desktopCollapsed = collapsed && window.matchMedia('(min-width: 861px)').matches;
  return (
    <>
      <button type="button" className="sb-link" data-active={anyChildActive || !!sameArea} aria-expanded={open} title={collapsed ? item.label : undefined}
        onClick={() => (desktopCollapsed ? navigate(item.to) : setOpen((o) => !o))}>
        <Icon name={item.icon} /><span className="sb-text">{item.label}</span><Icon name="chevron" className="sb-chev" />
      </button>
      {open && (
        <div className="sb-sub">
          {item.children.map((c) => (
            <Link key={c.to} to={c.to} className="sb-link" aria-current={isActiveTo(c.to, path, query, c.to.includes('ficha') ? 'identidade' : undefined) ? 'page' : undefined}>{c.label}</Link>
          ))}
        </div>
      )}
    </>
  );
}

const ROLE_LABEL: Record<Exclude<Role, 'visitante'>, string> = { jogador: 'Mesa do jogador', mestre: 'Mesa do mestre' };

export function AppShell({ children }: { children: ReactNode }) {
  const { role, setRole, empty, setEmpty } = useDemo();
  const { path } = useRoute();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100);
  const [open, setOpen] = useState(false);
  const [bell, setBell] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  const groups: NavGroup[] = role === 'mestre' ? masterNav : playerNav;
  const r = role === 'visitante' ? 'jogador' : role;
  const switchTo = (next: 'jogador' | 'mestre') => { setRole(next); navigate(next === 'mestre' ? '/mestre' : '/jogador'); };

  return (
    <div className="shell" data-role={r} data-collapsed={collapsed}>
      <SkipLink />
      <aside className="sidebar" data-open={open} aria-label="Navegação principal">
        <div className="sb-brand"><Brand /></div>
        <nav aria-label="Menu">
          {groups.map((g, i) => (
            <div className="sb-group" key={i}>
              {g.label && <div className="sb-label">{g.label}</div>}
              {g.items.map((it) => <NavEntry key={it.to + it.label} item={it} collapsed={collapsed} />)}
            </div>
          ))}
        </nav>
        <div className="sb-foot small muted">{DEMO_NOTE}. Nada é salvo nesta fase.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="shell-main">
        <div className="demobar" role="region" aria-label="Controles da demonstração">
          <strong>Modo demonstração</strong>
          <span>Ver como:</span>
          <Seg<'jogador' | 'mestre'> label="Perfil de demonstração" value={r} onChange={switchTo} items={[{ id: 'jogador', label: 'Jogador' }, { id: 'mestre', label: 'Mestre' }]} />
          <label className="check" style={{ minHeight: 32, padding: 0 }}>
            <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} /> <span>Simular dados vazios</span>
          </label>
        </div>
        <header className="topbar">
          <Button variant="ghost" className="btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}><Icon name="menu" /></Button>
          <Button variant="ghost" className="btn-icon collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-pressed={collapsed}><Icon name="menu" /></Button>
          <span className="where">{ROLE_LABEL[r]}</span>
          <span style={{ marginLeft: 'auto' }} className="row">
            <Button variant="ghost" className="btn-icon" onClick={() => setBell(true)} aria-label={`Notificações (${notifications.length} de demonstração)`}><Icon name="bell" /></Button>
            <LinkButton to="/perfil" variant="ghost" className="btn-icon" ><Icon name="user" label="Perfil e configurações" /></LinkButton>
          </span>
        </header>
        <main id="main" tabIndex={-1} className="content">{children}</main>
        <footer className="footnote">{APP_NAME} · Fase 1 — interface demonstrativa. Esconder botões não é segurança: as permissões reais serão aplicadas no servidor e no banco de dados.</footer>
      </div>

      {bell && (
        <Modal title="Notificações" onClose={() => setBell(false)} actions={<Button onClick={() => setBell(false)}>Fechar</Button>}>
          <p className="hint">Exemplos fictícios — nenhuma notificação real existe nesta fase.</p>
          <ul className="list">{notifications.map((n) => <li className="list-row" key={n.id}><div className="grow"><strong>{n.text}</strong><span className="muted small">{n.when}</span></div></li>)}</ul>
        </Modal>
      )}
    </div>
  );
}
