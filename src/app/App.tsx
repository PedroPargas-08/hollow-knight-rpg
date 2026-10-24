import { useEffect, useMemo, useRef } from 'react';
import { PrefsProvider } from './prefs';
import { AuthProvider, useAuth } from './auth';
import { navigate, useRoute } from './router';
import { notFound, routes, type RouteDef } from './routes';
import { matchRoute, type Params } from '../lib/router';
import { ToastProvider } from '../components/overlay';
import { AppShell, AuthLayout, PublicLayout } from '../components/layout';
import { Alert, Button, EmptyState, Panel } from '../components/ui';
import { isConfigured } from '../lib/supabase';
import { APP_NAME } from '../data/brand';

function resolve(path: string): { def: RouteDef; params: Params } {
  for (const def of routes) { const params = matchRoute(def.pattern, path); if (params) return { def, params }; }
  return { def: notFound, params: {} };
}
const Centered = ({ children }: { children: React.ReactNode }) => <div className="gate fade-in"><Panel>{children}</Panel></div>;

function RouteView() {
  const { path } = useRoute();
  const auth = useAuth();
  const { def, params } = useMemo(() => resolve(path), [path]);
  const first = useRef(true);
  const loading = auth.status === 'loading' || (auth.status === 'authed' && !auth.profile && !auth.profileError);
  const logged = auth.status === 'authed' && !!auth.profile;
  const role = auth.profile?.role;
  const home = role === 'mestre' ? '/mestre' : '/jogador';

  // Redirecionamentos só depois que a sessão inicial foi resolvida (evita "piscar" a tela de login ao recarregar).
  const target = loading ? null
    : def.access !== 'public' && !logged ? '/entrar'
    : def.guestOnly && logged && !auth.recovery ? home
    : def.access === 'mestre' && logged && role !== 'mestre' ? '/jogador' : null;
  useEffect(() => { if (target) navigate(target); }, [target]);

  useEffect(() => {
    document.title = `${def.title} — ${APP_NAME}`;
    window.scrollTo(0, 0);
    if (first.current) { first.current = false; return; }
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [path, def.title]);

  if (!isConfigured) return <PublicLayout><div className="pub-wrap"><Centered><EmptyState icon="gear" title="Configuração do Supabase ausente">
    Defina <code>SUPABASE_URL</code> e <code>SUPABASE_PUBLISHABLE_KEY</code> em <code>.env.local</code> e rode o build novamente. Veja o README.</EmptyState></Centered></div></PublicLayout>;
  if (loading) return <PublicLayout><div className="pub-wrap"><Centered><EmptyState icon="hourglass" title="Carregando…"><span className="spinner" role="status" aria-label="Carregando" /></EmptyState></Centered></div></PublicLayout>;
  if (auth.status === 'authed' && auth.profileError) return <PublicLayout><div className="pub-wrap"><Centered><EmptyState icon="alert" title="Não foi possível carregar seu perfil" action={<div className="row"><Button onClick={auth.refreshProfile}>Tentar de novo</Button><Button variant="ghost" onClick={() => auth.signOut()}>Sair</Button></div>}>{auth.profileError}</EmptyState></Centered></div></PublicLayout>;
  if (target) return null;

  const content = def.render(params);
  if (def.layout === 'auth') return <AuthLayout>{content}</AuthLayout>;
  if (def.layout === 'public') return <PublicLayout>{content}</PublicLayout>;
  return logged ? <AppShell>{content}</AppShell> : <PublicLayout><div className="pub-wrap">{content}</div></PublicLayout>;
}

export function App() {
  return (
    <AuthProvider>
      <PrefsProvider>
        <ToastProvider>
          <RouteView />
        </ToastProvider>
      </PrefsProvider>
    </AuthProvider>
  );
}
