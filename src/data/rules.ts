import type { IconName } from '../types';

export const PROVISORIO = 'Exemplo demonstrativo — regra ainda não definida';

export type Block =
  | { t: 'p'; text: string }
  | { t: 'h'; text: string }
  | { t: 'example'; text: string }
  | { t: 'warn'; text: string }
  | { t: 'list'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] };

export interface Category { slug: string; n: number; title: string; summary: string; icon: IconName; masterOnly?: boolean }
export interface Article { slug: string; category: string; title: string; summary: string; scope: 'global' | 'mestre'; tags: string[]; blocks: Block[] }

export const categories: Category[] = [
  { slug: 'introducao', n: 1, title: 'Introdução ao sistema', summary: 'O que é o jogo, o tom e como ler este compêndio.', icon: 'book' },
  { slug: 'fundamentais', n: 2, title: 'Regras fundamentais', summary: 'Princípios que valem para toda mesa.', icon: 'scroll' },
  { slug: 'criacao', n: 3, title: 'Criação de personagem', summary: 'Do conceito à primeira ficha.', icon: 'user' },
  { slug: 'atributos', n: 4, title: 'Atributos e ficha', summary: 'Como ler e organizar a ficha.', icon: 'sheet' },
  { slug: 'recursos', n: 5, title: 'PV, ALMA e recursos', summary: 'Vida, energia espiritual e outros recursos.', icon: 'heart' },
  { slug: 'testes', n: 6, title: 'Dados, rolagens e testes', summary: 'Como o acaso decide o desfecho.', icon: 'dice' },
  { slug: 'combate', n: 7, title: 'Combate, turnos e ações', summary: 'Ordem, ações e consequências.', icon: 'sword' },
  { slug: 'habilidades', n: 8, title: 'Habilidades e poderes', summary: 'Técnicas, magias e talentos.', icon: 'spark' },
  { slug: 'equipamentos', n: 9, title: 'Equipamentos, armas e inventário', summary: 'O que se carrega e como pesa.', icon: 'pack' },
  { slug: 'condicoes', n: 10, title: 'Condições, efeitos e estados', summary: 'Alterações temporárias no personagem.', icon: 'alert' },
  { slug: 'exploracao', n: 11, title: 'Exploração, mapas e descobertas', summary: 'Regiões, segredos e o que se revela.', icon: 'map' },
  { slug: 'missoes', n: 12, title: 'Missões, recompensas e progressão', summary: 'Objetivos, ganhos e evolução.', icon: 'flag' },
  { slug: 'criaturas', n: 13, title: 'Criaturas, inimigos e chefes', summary: 'Modelo de ficha para o que habita as ruínas.', icon: 'skull' },
  { slug: 'mestre', n: 14, title: 'Regras e ferramentas exclusivas do mestre', summary: 'Conteúdo reservado a quem conduz a campanha.', icon: 'crown', masterOnly: true },
  { slug: 'glossario', n: 15, title: 'Glossário', summary: 'Termos usados no sistema.', icon: 'feather' },
  { slug: 'exemplos', n: 16, title: 'Exemplos práticos', summary: 'Cenas completas, passo a passo.', icon: 'hourglass' },
];

const A = (category: string, slug: string, title: string, summary: string, blocks: Block[], tags: string[] = [], scope: Article['scope'] = 'global'): Article =>
  ({ category, slug, title, summary, blocks, tags, scope });

export const articles: Article[] = [
  A('introducao', 'o-que-e', 'O que é este sistema?', 'Visão geral do jogo e do tom da ambientação.', [
    { t: 'p', text: 'Valdrim é um RPG de mesa ambientado em um reino subterrâneo esquecido. Personagens exploram ruínas, colecionam ecos de almas e decidem o que lembrar — e o que deixar enterrado.' },
    { t: 'h', text: 'Como usar o compêndio' },
    { t: 'list', items: ['Navegue pelas categorias ou use a busca.', 'Regras globais valem para todas as campanhas.', 'Cada mestre poderá ter regras locais da sua campanha, sem alterar as globais.'] },
    { t: 'warn', text: 'Todo o texto desta página é um exemplo para testar o layout. O conteúdo real do sistema ainda será escrito.' },
  ], ['introdução', 'ambientação']),
  A('fundamentais', 'principios', 'Princípios do jogo', 'As ideias-base que orientam as demais regras.', [
    { t: 'p', text: 'A mesa conta uma história em conjunto. O mestre descreve o mundo; jogadores descrevem o que seus personagens tentam fazer; as regras ajudam a decidir o que acontece.' },
    { t: 'list', items: ['Primeiro a ficção, depois a regra.', 'Na dúvida, o mestre decide e a mesa segue.', 'Falhar também faz a história avançar.'] },
    { t: 'example', text: 'Exemplo: “Ilvane tenta atravessar a ponte rachada.” O mestre decide se é preciso um teste e qual o risco.' },
  ], ['princípios', 'mesa']),
  A('fundamentais', 'papeis', 'Papéis à mesa', 'Diferença entre jogador, mestre e administração da plataforma.', [
    { t: 'table', head: ['Papel', 'Faz', 'Não faz'], rows: [
      ['Jogador', 'Controla seu personagem e consulta o que lhe foi revelado.', 'Não vê informações privadas do mestre.'],
      ['Mestre', 'Conduz uma ou mais campanhas próprias.', 'Não administra a plataforma nem campanhas de outros.'],
      ['Administração global', 'Cuida da plataforma (papel separado, futuro).', 'Não é escolhida no cadastro.'],
    ] },
    { t: 'warn', text: 'Tabela de exemplo para testar o componente de regras.' },
  ], ['papéis', 'permissões']),
  A('criacao', 'passo-a-passo', 'Passo a passo (esboço)', 'Etapas previstas para criar um personagem.', [
    { t: 'list', items: ['Conceito: quem é e o que busca.', 'Origem ou arquétipo (se existirem no sistema).', 'Atributos: valores a definir.', 'Habilidades iniciais: a definir.', 'Equipamento inicial: a definir.', 'História e vínculos.'] },
    { t: 'example', text: 'Exemplo: Ilvane, a cartógrafa silente, quer mapear o que o reino tenta esquecer.' },
  ], ['personagem', 'ficha']),
  A('atributos', 'lendo-a-ficha', 'Lendo a ficha', 'Onde fica cada informação.', [
    { t: 'p', text: 'A ficha é dividida em áreas: identidade, atributos, combate e sobrevivência, habilidades, equipamento e narrativa.' },
    { t: 'table', head: ['Área', 'Conteúdo previsto'], rows: [['Identidade', 'Nome, retrato, conceito, nível'], ['Atributos', 'Valores-base e modificadores (a definir)'], ['Combate', 'PV, ALMA, defesa, condições'], ['Habilidades', 'Técnicas conhecidas e requisitos'], ['Equipamento', 'Armas, proteções, amuletos, consumíveis']] },
    { t: 'warn', text: 'A lista final de atributos e as fórmulas ainda não foram definidas.' },
  ], ['ficha', 'atributos']),
  A('recursos', 'pv-e-alma', 'PV e ALMA', 'Os dois recursos principais do personagem.', [
    { t: 'p', text: 'PV representa a integridade física. ALMA representa a energia espiritual usada por habilidades especiais. Valores máximos e recuperação: a definir.' },
    { t: 'example', text: 'Exemplo (fictício): uma habilidade custa 2 de ALMA; com ALMA 1, não pode ser usada.' },
  ], ['pv', 'alma', 'vida', 'energia']),
  A('testes', 'estrutura-de-um-teste', 'Estrutura de um teste', 'Como um teste é montado e resolvido.', [
    { t: 'list', items: ['1. O mestre define se há risco real.', '2. Escolhe-se o atributo relevante.', '3. Rola-se o dado do sistema (a definir).', '4. Compara-se com uma dificuldade (a definir).', '5. Narra-se o resultado.'] },
    { t: 'warn', text: 'A plataforma não rola dados nesta fase. Nenhuma fórmula real foi implementada.' },
  ], ['dados', 'rolagem', 'teste']),
  A('testes', 'dificuldades', 'Dificuldades (tabela provisória)', 'Escala de exemplo para o mestre.', [
    { t: 'table', head: ['Nível', 'Descrição', 'Valor'], rows: [['Trivial', 'Quase sem risco', 'a definir'], ['Comum', 'Exige atenção', 'a definir'], ['Difícil', 'Falha é provável', 'a definir'], ['Extremo', 'Quase impossível', 'a definir']] },
  ], ['dificuldade', 'tabela']),
  A('combate', 'ordem-de-turnos', 'Ordem de turnos', 'Quem age e quando.', [
    { t: 'p', text: 'Em combate, o tempo é dividido em rodadas. Em cada rodada, cada participante age uma vez, em uma ordem definida no início do encontro (método a definir).' },
    { t: 'example', text: 'Exemplo: o mestre anota a ordem em uma lista e avança o marcador a cada turno.' },
  ], ['turno', 'iniciativa', 'rodada']),
  A('combate', 'acoes', 'Ações possíveis', 'O que um personagem pode tentar no seu turno.', [
    { t: 'list', items: ['Mover-se.', 'Atacar.', 'Usar uma habilidade.', 'Usar um item.', 'Tentar algo criativo, a critério do mestre.'] },
    { t: 'warn', text: 'Lista ilustrativa. Quantidade e tipo de ações por turno: a definir.' },
  ], ['ação', 'ataque']),
  A('habilidades', 'anatomia', 'Anatomia de uma habilidade', 'Campos que toda habilidade deve ter.', [
    { t: 'table', head: ['Campo', 'Para que serve'], rows: [['Nome', 'Identifica a habilidade'], ['Custo', 'Recurso gasto (ex.: ALMA)'], ['Requisito', 'O que é preciso para aprender ou usar'], ['Efeito', 'O que acontece quando usada'], ['Alcance', 'Distância ou alvo']] },
  ], ['habilidade', 'poder']),
  A('equipamentos', 'categorias', 'Categorias de itens', 'Como os itens são agrupados na ficha.', [
    { t: 'list', items: ['Armas', 'Armaduras e proteções', 'Amuletos e acessórios', 'Consumíveis', 'Itens especiais'] },
    { t: 'example', text: 'Exemplo: “Frasco de Alma ×3” aparece como consumível, com quantidade e descrição.' },
  ], ['inventário', 'itens', 'armas']),
  A('condicoes', 'lendo-uma-condicao', 'Lendo uma condição', 'Como condições são descritas.', [
    { t: 'p', text: 'Cada condição terá nome, efeito, duração e forma de terminar. Exemplos de nomes (fictícios): Atordoado, Eco Fraco, Enraizado.' },
    { t: 'warn', text: 'Nenhum efeito mecânico real foi definido ainda.' },
  ], ['condição', 'efeito', 'estado']),
  A('exploracao', 'regioes', 'Regiões reveladas e secretas', 'O que o jogador sabe e o que só o mestre sabe.', [
    { t: 'p', text: 'Cada região tem um estado: secreta (só o mestre vê) ou revelada (visível para os jogadores). Quem controla a revelação é o mestre.' },
    { t: 'example', text: 'Exemplo: uma região chamada “Câmara Velada” permanece secreta até o grupo encontrar a chave.' },
  ], ['mapa', 'região', 'segredo']),
  A('missoes', 'objetivos', 'Missões e objetivos', 'Como objetivos são registrados.', [
    { t: 'list', items: ['Missão ativa: visível para os jogadores.', 'Missão concluída: vai para o histórico.', 'Missão secreta: só o mestre vê.'] },
    { t: 'warn', text: 'Recompensas e progressão: a definir.' },
  ], ['missão', 'recompensa', 'progressão']),
  A('criaturas', 'modelo-de-ficha', 'Ficha de criatura (modelo)', 'Campos de uma criatura, inimigo ou chefe.', [
    { t: 'table', head: ['Campo', 'Exemplo (fictício)'], rows: [['Nome', 'Verme de Cinza'], ['Ameaça', 'a definir'], ['PV', '—'], ['Comportamento', 'Foge da luz'], ['Notas do mestre', 'Visíveis apenas ao mestre']] },
  ], ['criatura', 'inimigo', 'chefe', 'bestiário']),
  A('mestre', 'ferramentas', 'Ferramentas do mestre', 'Resumo do que o painel do mestre oferece.', [
    { t: 'list', items: ['Ferramentas de sessão', 'Missões, NPCs e criaturas', 'Encontros e recompensas', 'Regiões reveladas e secretas', 'Diário privado'] },
    { t: 'warn', text: 'Este conteúdo é restrito ao mestre. Na Fase 1 a restrição é só visual; a imposição real virá no servidor.' },
  ], ['mestre', 'ferramentas'], 'mestre'),
  A('mestre', 'regras-locais', 'Regras locais da campanha', 'Como cada mestre poderá ajustar a própria mesa.', [
    { t: 'p', text: 'O mestre poderá ativar regras opcionais ou ajustes locais apenas na sua campanha. As regras globais continuam iguais para todos.' },
    { t: 'warn', text: 'Funcionalidade planejada para uma fase futura.' },
  ], ['regras locais', 'campanha'], 'mestre'),
  A('glossario', 'termos', 'Termos provisórios', 'Vocabulário usado nesta demonstração.', [
    { t: 'table', head: ['Termo', 'Significado provisório'], rows: [['PV', 'Pontos de vida'], ['ALMA', 'Recurso espiritual do sistema'], ['Eco', 'Vestígio de uma alma, usado como elemento narrativo'], ['Mestre', 'Quem conduz uma campanha'], ['Região', 'Área do mapa, revelada ou secreta']] },
  ], ['glossário', 'termos']),
  A('exemplos', 'cena-de-exploracao', 'Uma cena de exploração (exemplo)', 'Uma cena narrada do início ao fim.', [
    { t: 'p', text: 'O grupo chega a uma ponte rachada sobre um abismo escuro.' },
    { t: 'list', items: ['O mestre descreve a ponte e o eco de um sino distante.', 'Ilvane diz que quer atravessar com cuidado.', 'O mestre pede um teste (regra a definir).', 'O resultado é narrado e a região pode ser revelada.'] },
    { t: 'example', text: 'Cena fictícia criada apenas para demonstrar o componente de exemplo.' },
  ], ['exemplo', 'cena']),
];

export const categoryBySlug = (slug: string) => categories.find((c) => c.slug === slug);
export const articlesOf = (slug: string) => articles.filter((a) => a.category === slug);
export const findArticle = (cat: string, art: string) => articles.find((a) => a.category === cat && a.slug === art);
