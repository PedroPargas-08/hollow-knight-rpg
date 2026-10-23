import { useEffect, useMemo, useRef } from 'react';
import { DemoProvider, useDemo } from './demo';
import { useRoute } from './router';
import { notFound, routes, type RouteDef } from './routes';
import { matchRoute, type Params } from '../lib/router';
import { ToastProvider } from '../components/overlay';
import { AppShell, AuthLayout, PublicLayout } from '../components/layout';
import { AccessGate } from '../pages/Misc';
import { APP_NAME } from '../data/demo';

function resolve(path: string): { def: RouteDef; params: Params } {
  for (const def of routes) { const params = matchRoute(def.pattern, path); if (params) return { def, params }; }
  return { def: notFound, params: {} };
}

function RouteView() {
  const { path } = useRoute();
  const { role } = useDemo();
  const { def, params } = useMemo(() => resolve(path), [path]);
  const first = useRef(true);
  useEffect(() => {
    document.title = `${def.title} — ${APP_NAME}`;
    window.scrollTo(0, 0);
    if (first.current) { first.current = false; return; }
    document.getElementById('main')?.focus({ preventScroll: true });
  }, [path, def.title]);

  const logged = role !== 'visitante';
  const blocked = (def.access === 'auth' && !logged) || (def.access === 'jogador' && role !== 'jogador') || (def.access === 'mestre' && role !== 'mestre');
  const content = blocked ? <AccessGate required={def.access as 'auth' | 'jogador' | 'mestre'} /> : def.render(params);

  if (def.layout === 'auth') return <AuthLayout>{content}</AuthLayout>;
  if (def.layout === 'public') return <PublicLayout>{content}</PublicLayout>;
  return logged ? <AppShell>{content}</AppShell> : <PublicLayout><div className="pub-wrap">{content}</div></PublicLayout>;
}

export function App() {
  return <DemoProvider><ToastProvider><RouteView /></ToastProvider></DemoProvider>;
}
