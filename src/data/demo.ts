// DADOS FICTÍCIOS — usados apenas para visualizar as telas da Fase 1.
import type { Visibility } from '../types';

export const APP_NAME = 'Valdrim';
export const APP_TAGLINE = 'Ecos do reino esquecido';
export const DEMO_NOTE = 'Dados fictícios de demonstração';

export const demoUsers = {
  jogador: { name: 'Viajante Demo', email: 'viajante@exemplo.invalid' },
  mestre: { name: 'Mestre Demo', email: 'mestre@exemplo.invalid' },
} as const;

/* ---------- Campanhas ---------- */
export type CampaignState = 'Em andamento' | 'Em preparação' | 'Pausada';
export interface Campaign {
  id: string; name: string; description: string; master: string; players: string[]; state: CampaignState;
  lastSession: string; lastSessionDate: string; art: 'cinzas' | 'coro' | 'sinos';
  /** Papéis do usuário de demonstração nessa campanha */
  asPlayer: boolean; asMaster: boolean;
}
export const campaigns: Campaign[] = [
  { id: 'cinzas', name: 'As Cinzas de Valdrim', art: 'cinzas', state: 'Em andamento', master: 'Mestre Demo', players: ['Viajante Demo', 'Corvina', 'Tâmaro', 'Seren'], asPlayer: true, asMaster: true,
    description: 'O grupo desce às ruínas da cidade-sino em busca de um eco que ninguém deveria encontrar.',
    lastSession: 'O grupo atravessou a Ponte Rachada e ouviu um sino distante vindo de muito abaixo.', lastSessionDate: '12 out (fictício)' },
  { id: 'coro', name: 'O Coro Submerso', art: 'coro', state: 'Em andamento', master: 'Oriel', players: ['Viajante Demo', 'Maren', 'Quill'], asPlayer: true, asMaster: false,
    description: 'Vozes sob o lago chamam por nomes esquecidos. Quem responde, não volta igual.',
    lastSession: 'Maren aceitou o chamado e a margem do lago ficou em silêncio.', lastSessionDate: '05 out (fictício)' },
  { id: 'sinos', name: 'Os Sinos do Poço Silente', art: 'sinos', state: 'Em preparação', master: 'Mestre Demo', players: ['Convite pendente (demo)'], asPlayer: false, asMaster: true,
    description: 'Campanha ainda em preparação: mapas, criaturas e a primeira sessão estão sendo desenhados.',
    lastSession: 'Ainda não houve sessões.', lastSessionDate: '—' },
];
export const privateCampaignNote = 'Campanha privada de outro mestre — você não tem acesso.';

/* ---------- Personagem do jogador ---------- */
export const character = {
  name: 'Ilvane, a Cartógrafa Silente', short: 'Ilvane', campaignId: 'cinzas', campaign: 'As Cinzas de Valdrim',
  concept: 'Mapeia o que o reino tenta esquecer. Fala pouco, anota tudo.',
  stage: 'Estágio 3', archetype: 'Exploradora (exemplo)', origin: 'Cidade-sino (exemplo)',
  pv: { now: 18, max: 24 }, alma: { now: 9, max: 14 }, defense: 12,
  conditions: [{ name: 'Eco Fraco', note: 'Exemplo: sussurros atrapalham a concentração.' }, { name: 'Atenta', note: 'Exemplo: percebe detalhes no ambiente.' }],
  attributes: [
    { key: 'Vigor', value: 8, mod: '+0', note: 'Resistência do corpo.' },
    { key: 'Agilidade', value: 14, mod: '+2', note: 'Rapidez e equilíbrio.' },
    { key: 'Intelecto', value: 13, mod: '+1', note: 'Raciocínio e memória.' },
    { key: 'Percepção', value: 15, mod: '+2', note: 'Atenção ao entorno.' },
    { key: 'Presença', value: 9, mod: '+0', note: 'Força de vontade social.' },
    { key: 'Vontade', value: 12, mod: '+1', note: 'Domínio sobre a ALMA.' },
  ],
  abilities: [
    { name: 'Traço de Cinza', cost: 'ALMA 2', ok: true, text: 'Marca um ponto do mapa que só ela enxerga.', req: 'Nenhum' },
    { name: 'Passo Silente', cost: 'ALMA 1', ok: true, text: 'Move-se sem ecoar por um breve instante.', req: 'Agilidade 12+ (exemplo)' },
    { name: 'Olhar de Lanterna', cost: '—', ok: true, text: 'Enxerga pistas em lugares escuros.', req: 'Percepção 13+ (exemplo)' },
    { name: 'Fôlego do Eco', cost: 'ALMA 3', ok: true, text: 'Recupera um pouco de PV usando um eco guardado.', req: 'Nenhum' },
    { name: 'Chamado do Coro', cost: 'ALMA 5', ok: false, text: 'Convoca vozes para auxiliar o grupo.', req: 'Estágio 5 (exemplo)' },
    { name: 'Selo da Fenda', cost: 'ALMA 4', ok: false, text: 'Fecha uma passagem por algum tempo.', req: 'Item: Chave Rachada reparada (exemplo)' },
  ],
  equipment: {
    armas: [{ name: 'Lâmina de Fenda', qty: 1, text: 'Lâmina fina de metal escuro (exemplo).' }],
    protecoes: [{ name: 'Manto de Cinzas', qty: 1, text: 'Tecido pesado que abafa passos (exemplo).' }],
    amuletos: [{ name: 'Amuleto do Primeiro Eco', qty: 1, text: 'Zumbe de leve perto de segredos (exemplo).' }],
    consumiveis: [{ name: 'Frasco de Alma', qty: 3, text: 'Restaura um pouco de ALMA (exemplo).' }, { name: 'Sal de Ruínas', qty: 5, text: 'Marca caminhos no chão (exemplo).' }],
    especiais: [{ name: 'Chave Rachada', qty: 1, text: 'Abre algo que ainda não foi encontrado.' }],
  },
  history: 'Ilvane cresceu entre sinos silenciados. Aprendeu a desenhar mapas de memória para não esquecer os caminhos que a cidade apagava. Hoje desce às ruínas para descobrir quem tocou o último sino. (Texto fictício.)',
  personality: 'Curiosa, reservada, teimosa com detalhes.',
  notes: ['Perguntar à Corvina sobre o símbolo da ponte.', 'Anotar ecos novos no caderno.'],
  progression: [{ when: 'Sessão 1', what: 'Chegada às ruínas.' }, { when: 'Sessão 2', what: 'Primeiro eco coletado.' }, { when: 'Sessão 3', what: 'Subiu para o Estágio 3 (exemplo).' }],
};

/* ---------- Missões ---------- */
export interface Quest { id: string; title: string; status: 'Ativa' | 'Concluída' | 'Secreta'; text: string; visibility: Visibility }
export const quests: Quest[] = [
  { id: 'q1', title: 'O sino que ainda toca', status: 'Ativa', visibility: 'jogadores', text: 'Descobrir de onde vem o som do sino distante.' },
  { id: 'q2', title: 'Mapa da Ponte Rachada', status: 'Concluída', visibility: 'jogadores', text: 'Registrar a travessia no caderno de Ilvane.' },
  { id: 'q3', title: 'A chave sem porta', status: 'Ativa', visibility: 'jogadores', text: 'Encontrar a fechadura da Chave Rachada.' },
  { id: 'q4', title: 'Quem toca o último sino', status: 'Secreta', visibility: 'mestre', text: 'Revelação planejada para a sessão 6: o sineiro nunca partiu.' },
];

/* ---------- Regiões do mapa ---------- */
export interface Region { id: string; name: string; revealed: boolean; x: number; y: number; links: string[]; note: string }
export const regions: Region[] = [
  { id: 'portao', name: 'Portão de Cinzas', revealed: true, x: 12, y: 50, links: ['ponte'], note: 'Entrada das ruínas.' },
  { id: 'ponte', name: 'Ponte Rachada', revealed: true, x: 32, y: 28, links: ['portao', 'galeria', 'pocos'], note: 'Atravessada na sessão 3.' },
  { id: 'galeria', name: 'Galeria dos Ecos', revealed: true, x: 55, y: 62, links: ['ponte', 'cripta'], note: 'Paredes que repetem frases.' },
  { id: 'pocos', name: 'Poço Silente', revealed: false, x: 62, y: 20, links: ['ponte', 'cripta'], note: 'SEGREDO: o sino ainda está lá embaixo.' },
  { id: 'cripta', name: 'Cripta do Sineiro', revealed: false, x: 82, y: 46, links: ['galeria', 'pocos'], note: 'SEGREDO: contém o sineiro.' },
];

/* ---------- Painel do jogador ---------- */
export const rollHistory = [
  { when: 'Sessão 3', what: 'Teste de Percepção', result: '17 (exemplo)' },
  { when: 'Sessão 3', what: 'Teste de Agilidade', result: '9 (exemplo)' },
  { when: 'Sessão 2', what: 'Teste de Intelecto', result: '14 (exemplo)' },
];
export const notifications = [
  { id: 'n1', text: 'Mestre Demo revelou a região “Galeria dos Ecos”.', when: 'há 2 dias (fictício)' },
  { id: 'n2', text: 'Próxima sessão marcada para sábado (fictício).', when: 'há 3 dias (fictício)' },
  { id: 'n3', text: 'Novo item adicionado ao seu inventário.', when: 'há 5 dias (fictício)' },
];
export const nextObjectives = ['Procurar a fechadura da Chave Rachada.', 'Descer a Galeria dos Ecos com cuidado.', 'Reabastecer Frascos de Alma.'];

/* ---------- Painel do mestre ---------- */
export const masterPlayers = [
  { name: 'Viajante Demo', character: 'Ilvane', pv: [18, 24], alma: [9, 14], status: 'Presente' },
  { name: 'Corvina', character: 'Corvina Vess', pv: [22, 22], alma: [6, 10], status: 'Presente' },
  { name: 'Tâmaro', character: 'Tâmaro, o Remendador', pv: [10, 20], alma: [12, 12], status: 'Ausente' },
  { name: 'Seren', character: 'Seren de Pedra', pv: [26, 28], alma: [3, 8], status: 'Presente' },
];
export const bestiary = {
  npcs: [{ name: 'Sineiro Anônimo', note: 'Aparece apenas em sonhos.', visibility: 'mestre' as Visibility }, { name: 'Velha Orvalha', note: 'Vende mapas, mente sobre metade.', visibility: 'jogadores' as Visibility }],
  criaturas: [{ name: 'Verme de Cinza', note: 'Foge da luz.', visibility: 'jogadores' as Visibility }, { name: 'Sussurrante', note: 'Imita vozes conhecidas.', visibility: 'mestre' as Visibility }],
  chefes: [{ name: 'O Badalo Oco', note: 'Guardião do Poço Silente. Fases e fraquezas: a definir.', visibility: 'mestre' as Visibility }],
};
export const encounters = [
  { name: 'Emboscada na Ponte', state: 'Concluído', where: 'Ponte Rachada' },
  { name: 'Vozes na Galeria', state: 'Pronto', where: 'Galeria dos Ecos' },
  { name: 'O Badalo Oco', state: 'Em rascunho', where: 'Poço Silente' },
];
export const rewardPackages = [
  { name: 'Eco guardado ×2', for: 'Grupo', note: 'Sugestão de recompensa para a sessão 4.' },
  { name: 'Amuleto sem nome', for: 'Corvina', note: 'Item especial planejado.' },
];
export const eventLog = [
  { when: 'Sessão 3', text: 'Grupo revelou a Galeria dos Ecos.', visibility: 'jogadores' as Visibility },
  { when: 'Sessão 3', text: 'Tâmaro falhou ao ouvir o sino — sinal de que algo o chama.', visibility: 'mestre' as Visibility },
  { when: 'Sessão 2', text: 'Corvina encontrou o símbolo da ponte.', visibility: 'publico' as Visibility },
];
export const sessionAgenda = [
  { text: 'Recapitular a Ponte Rachada', done: true },
  { text: 'Apresentar a Galeria dos Ecos', done: false },
  { text: 'Encontro: Vozes na Galeria', done: false },
  { text: 'Gancho: o sino toca de novo', done: false },
];
