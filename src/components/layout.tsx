import { useEffect, useState, type ReactNode } from 'react';
import { Link, navigate, useRoute } from '../app/router';
import { useAuth } from '../app/auth';
import { masterNav, playerNav, type NavGroup, type NavItem } from '../app/nav';
import { isActiveTo } from '../lib/router';
import { APP_NAME } from '../data/brand';
import { Icon } from './Icon';
import { Backdrop, MaskGlyph } from './domain';
import { Button, LinkButton } from './ui';
import { useToast } from './overlay';
import { friendlyError } from '../lib/sheet';

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

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const toast = useToast();
  const { path } = useRoute();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1100);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  const role = profile?.role ?? 'jogador';
  const groups: NavGroup[] = role === 'mestre' ? masterNav : playerNav;
  const leave = async () => {
    setLeaving(true);
    try { await signOut(); navigate('/'); } catch (e) { toast(friendlyError(e), 'bad'); setLeaving(false); }
  };

  return (
    <div className="shell" data-role={role} data-collapsed={collapsed}>
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
        <div className="sb-foot small muted">Conectado como <strong>{profile?.display_name}</strong>.</div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}

      <div className="shell-main">
        <header className="topbar">
          <Button variant="ghost" className="btn-icon menu-btn" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}><Icon name="menu" /></Button>
          <Button variant="ghost" className="btn-icon collapse-btn" onClick={() => setCollapsed((c) => !c)} aria-label={collapsed ? 'Expandir menu lateral' : 'Recolher menu lateral'} aria-pressed={collapsed}><Icon name="menu" /></Button>
          <span className="where">{role === 'mestre' ? 'Mesa do mestre' : 'Mesa do jogador'}</span>
          <span style={{ marginLeft: 'auto' }} className="row">
            <LinkButton to="/perfil" variant="ghost" className="btn-icon"><Icon name="user" label="Perfil e configurações" /></LinkButton>
            <Button variant="ghost" size="sm" icon="logout" loading={leaving} onClick={leave}>Sair</Button>
          </span>
        </header>
        <main id="main" tabIndex={-1} className="content">{children}</main>
        <footer className="footnote">{APP_NAME} · Fase 2 — contas e dados reais. As permissões são aplicadas pelo banco (RLS), não pela interface.</footer>
      </div>
    </div>
  );
}
