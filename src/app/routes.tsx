import type { ReactNode } from 'react';
import type { Params } from '../lib/router';
import { MASTER_SECTIONS, type MasterSection } from './nav';
import { HomePage } from '../pages/Home';
import { LoginPage, RecoverPage, RegisterPage, ResetPasswordPage } from '../pages/Auth';
import { AdminPlannedPage, NotFoundPage, ProfilePage } from '../pages/Misc';
import { CharacterSheetPage, PlayerDashboard } from '../pages/Player';
import { CampaignsPage } from '../pages/Campaigns';
import { RulesPage } from '../pages/Rules';
import { MasterPage } from '../pages/Master';

/** public: qualquer pessoa · auth: exige login · mestre: exige papel "mestre" no perfil (conferido no banco) */
export type Access = 'public' | 'auth' | 'mestre';
export type LayoutKind = 'public' | 'auth' | 'content' | 'app';
export interface RouteDef { pattern: string; title: string; access: Access; layout: LayoutKind; guestOnly?: boolean; render: (p: Params) => ReactNode }

const validSection = (s: string) => MASTER_SECTIONS.some((m) => m.id === s);
export const routes: RouteDef[] = [
  { pattern: '/', title: 'Início', access: 'public', layout: 'public', render: () => <HomePage /> },
  { pattern: '/entrar', title: 'Entrar', access: 'public', layout: 'auth', guestOnly: true, render: () => <LoginPage /> },
  { pattern: '/cadastro', title: 'Criar conta', access: 'public', layout: 'auth', guestOnly: true, render: () => <RegisterPage /> },
  { pattern: '/recuperar', title: 'Recuperar acesso', access: 'public', layout: 'auth', guestOnly: true, render: () => <RecoverPage /> },
  { pattern: '/redefinir-senha', title: 'Nova senha', access: 'public', layout: 'auth', render: () => <ResetPasswordPage /> },
  { pattern: '/regras', title: 'Regras e mecânicas', access: 'public', layout: 'content', render: () => <RulesPage /> },
  { pattern: '/regras/:cat', title: 'Regras e mecânicas', access: 'public', layout: 'content', render: (p) => <RulesPage cat={p.cat} /> },
  { pattern: '/regras/:cat/:art', title: 'Regras e mecânicas', access: 'public', layout: 'content', render: (p) => <RulesPage cat={p.cat} art={p.art} /> },
  { pattern: '/jogador', title: 'Painel do jogador', access: 'auth', layout: 'app', render: () => <PlayerDashboard /> },
  { pattern: '/jogador/ficha', title: 'Ficha de personagem', access: 'auth', layout: 'app', render: () => <CharacterSheetPage /> },
  { pattern: '/campanhas', title: 'Campanhas', access: 'auth', layout: 'app', render: () => <CampaignsPage /> },
  { pattern: '/mestre', title: 'Painel do mestre', access: 'mestre', layout: 'app', render: () => <MasterPage section="visao" /> },
  { pattern: '/mestre/:secao', title: 'Painel do mestre', access: 'mestre', layout: 'app', render: (p) => (validSection(p.secao) ? <MasterPage section={p.secao as MasterSection} /> : <NotFoundPage />) },
  { pattern: '/perfil', title: 'Perfil e configurações', access: 'auth', layout: 'app', render: () => <ProfilePage /> },
  { pattern: '/admin', title: 'Administração global (planejada)', access: 'auth', layout: 'app', render: () => <AdminPlannedPage /> },
];
export const notFound: RouteDef = { pattern: '*', title: 'Página não encontrada', access: 'public', layout: 'public', render: () => <NotFoundPage /> };
