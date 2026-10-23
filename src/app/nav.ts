import type { IconName } from '../types';

export interface NavLeaf { label: string; to: string }
export interface NavItem { label: string; to: string; icon: IconName; children?: NavLeaf[]; tag?: string }
export interface NavGroup { label?: string; items: NavItem[] }

export const SHEET_TABS = [
  { id: 'identidade', label: 'Identidade', icon: 'user' },
  { id: 'atributos', label: 'Atributos', icon: 'star' },
  { id: 'combate', label: 'Combate', icon: 'shield' },
  { id: 'habilidades', label: 'Habilidades', icon: 'spark' },
  { id: 'equipamento', label: 'Equipamento', icon: 'pack' },
  { id: 'narrativa', label: 'Narrativa', icon: 'feather' },
] as const;
export type SheetTab = (typeof SHEET_TABS)[number]['id'];

export const MASTER_SECTIONS = [
  { id: 'visao', label: 'Visão geral', to: '/mestre' },
  { id: 'sessao', label: 'Sessão', to: '/mestre/sessao' },
  { id: 'jogadores', label: 'Jogadores e personagens', to: '/mestre/jogadores' },
  { id: 'missoes', label: 'Missões e objetivos', to: '/mestre/missoes' },
  { id: 'bestiario', label: 'NPCs, criaturas e chefes', to: '/mestre/bestiario' },
  { id: 'mapas', label: 'Mapas e regiões', to: '/mestre/mapas' },
  { id: 'encontros', label: 'Encontros e combates', to: '/mestre/encontros' },
  { id: 'recompensas', label: 'Recompensas e progressão', to: '/mestre/recompensas' },
  { id: 'diario', label: 'Diário privado', to: '/mestre/diario' },
  { id: 'regras', label: 'Regras da campanha', to: '/mestre/regras' },
] as const;
export type MasterSection = (typeof MASTER_SECTIONS)[number]['id'];

const planned: NavGroup = { label: 'Estrutura planejada', items: [{ label: 'Administração global', to: '/admin', icon: 'lock', tag: 'futuro' }] };
const account: NavGroup = { label: 'Conta', items: [{ label: 'Perfil e configurações', to: '/perfil', icon: 'gear' }] };

export const playerNav: NavGroup[] = [
  { items: [
    { label: 'Painel do jogador', to: '/jogador', icon: 'home' },
    { label: 'Minha ficha', to: '/jogador/ficha', icon: 'sheet', children: SHEET_TABS.map((t) => ({ label: t.label, to: `/jogador/ficha?aba=${t.id}` })) },
    { label: 'Campanhas', to: '/campanhas', icon: 'flag' },
  ] },
  { label: 'Compêndio', items: [{ label: 'Regras e mecânicas', to: '/regras', icon: 'scroll' }] },
  account, planned,
];

export const masterNav: NavGroup[] = [
  { items: [
    { label: 'Painel do mestre', to: '/mestre', icon: 'crown', children: MASTER_SECTIONS.map((s) => ({ label: s.label, to: s.to })) },
    { label: 'Campanhas', to: '/campanhas', icon: 'flag' },
  ] },
  { label: 'Compêndio', items: [{ label: 'Regras e mecânicas', to: '/regras', icon: 'scroll' }] },
  account, planned,
];
