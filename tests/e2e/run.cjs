// Testes de navegação ponta a ponta (Playwright + Chromium). Requer `npm run build` antes.
const http = require('node:http'); const fs = require('node:fs'); const path = require('node:path');
const { chromium } = require('playwright');
const DIST = path.resolve(__dirname, '../../dist'); const SHOTS = process.env.SHOTS_DIR;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  const f = path.join(DIST, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
  if (!f.startsWith(DIST) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' }); res.end(fs.readFileSync(f));
});
let pass = 0, fail = 0; const failures = [];
async function t(name, fn) { try { await fn(); pass++; console.log('  ✓', name); } catch (e) { fail++; failures.push(name); console.log('  ✗', name, '\n     ', String(e.message).split('\n')[0]); } }
const ok = (c, m) => { if (!c) throw new Error(m); };

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const errors = [];
  // No Playwright, isVisible() não espera. Aqui ele aguarda até 1,5 s pelo primeiro elemento correspondente.
  const proto = Object.getPrototypeOf((await browser.newContext().then((c) => c.newPage())).locator('body'));
  proto.isVisible = async function () { try { await this.first().waitFor({ state: 'visible', timeout: 1500 }); return true; } catch { return false; } };
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(base); return page;
  };
  const go = async (page, hash) => { await page.evaluate((h) => { location.hash = h; }, hash); await page.waitForTimeout(80); };
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
  const h1 = (page) => page.locator('h1').first().innerText();

  console.log('Visitante');
  const p = await open();
  await t('página inicial mostra nome, entrar, criar conta e regras', async () => {
    ok((await h1(p)).toLowerCase().includes('valdrim'), 'título');
    for (const n of ['Entrar', 'Criar conta']) ok(await p.getByRole('link', { name: n }).first().isVisible(), n);
    ok(await p.getByRole('link', { name: /regras públicas/i }).isVisible(), 'link regras');
  });
  await shot(p, 'home');
  await t('rotas públicas navegam (entrar, cadastro, recuperar, regras)', async () => {
    for (const [h, t1] of [['/entrar', 'Entrar'], ['/cadastro', 'Criar conta'], ['/recuperar', 'Recuperar acesso'], ['/regras', 'Regras e mecânicas']]) { await go(p, h); ok((await h1(p)).includes(t1), h); }
  });
  await t('visitante é bloqueado em painel, ficha, campanhas e mestre', async () => {
    for (const h of ['/jogador', '/jogador/ficha', '/campanhas', '/mestre', '/mestre/mapas']) { await go(p, h); ok(await p.getByText(/Entre para ver|Área do jogador|exclusiva do mestre/).first().isVisible(), h); }
  });
  await t('rota inexistente mostra página de não encontrado', async () => { await go(p, '/nada-aqui'); ok(await p.getByText('ainda não foi mapeada').isVisible(), '404'); });
  await t('login: botão desabilitado, erro de validação e estado demonstrativo', async () => {
    await go(p, '/entrar');
    const btn = p.getByRole('button', { name: 'Entrar', exact: true }); ok(await btn.isDisabled(), 'desabilitado');
    await p.fill('#login-id', 'abc@'); await p.fill('#login-pw', 'x'); await btn.click();
    ok(await p.getByText(/e-mail parece incompleto/).isVisible(), 'erro e-mail');
    await shot(p, 'login-erro');
    await p.fill('#login-id', 'viajante@exemplo.invalid'); await btn.click();
    await p.getByText(/Nenhuma autenticação real/).waitFor({ timeout: 3000 });
  });
  await t('login: mostrar/ocultar senha e simulação de erro', async () => {
    await go(p, '/entrar'); await p.fill('#login-pw', 'segredo');
    await p.getByRole('button', { name: 'Mostrar senha' }).click(); ok((await p.locator('#login-pw').getAttribute('type')) === 'text', 'visível');
    await p.getByRole('button', { name: 'Simular mensagem de erro' }).click(); ok(await p.getByRole('alert').first().isVisible(), 'alerta');
  });
  await t('cadastro: validação, sem escolha de papel e sem criar conta real', async () => {
    await go(p, '/cadastro');
    ok((await p.getByText(/administrador/i).count()) === 0 || !(await p.locator('select, input[type=radio]').count()), 'sem campo de papel');
    await p.fill('#reg-name', 'I'); await p.fill('#reg-email', 'x'); await p.fill('#reg-pw', 'abc'); await p.fill('#reg-confirm', 'zzz');
    await p.getByRole('button', { name: 'Criar conta' }).click();
    for (const m of [/ao menos 2 caracteres/, /e-mail parece incompleto/, /ao menos 8 caracteres/, /não são iguais/, /aceitar os termos/]) ok(await p.getByText(m).first().isVisible(), String(m));
    await shot(p, 'cadastro-erros');
    await p.fill('#reg-name', 'Ilvane'); await p.fill('#reg-email', 'ilvane@exemplo.invalid'); await p.fill('#reg-pw', 'senha1234'); await p.fill('#reg-confirm', 'senha1234'); await p.getByRole('checkbox').check();
    await p.getByRole('button', { name: 'Criar conta' }).click(); await p.getByText(/Nenhuma conta foi criada/).waitFor({ timeout: 3000 });
  });
  await t('recuperação: valida e mostra resposta demonstrativa', async () => {
    await go(p, '/recuperar'); await p.getByRole('button', { name: /Solicitar/ }).click(); ok(await p.getByText(/Informe o e-mail/).isVisible(), 'erro');
    await p.fill('#rec-email', 'a@b.co'); await p.getByRole('button', { name: /Solicitar/ }).click(); await p.getByText(/Nenhum e-mail foi enviado/).waitFor({ timeout: 3000 });
  });
  await t('regras: categorias, artigo, voltar, busca e restrição do mestre', async () => {
    await go(p, '/regras'); ok((await p.locator('.cat').count()) === 16, '16 categorias');
    await p.locator('.cat', { hasText: 'Combate, turnos e ações' }).click(); await p.locator('h2', { hasText: 'Combate, turnos' }).first().waitFor({ timeout: 2000 });
    await p.getByRole('link', { name: 'Ordem de turnos' }).first().click(); ok(await p.getByText('Exemplo demonstrativo — regra ainda não definida').first().isVisible(), 'aviso provisório');
    await p.getByRole('link', { name: 'Voltar à categoria' }).click(); await p.waitForFunction(() => location.hash === '#/regras/combate', null, { timeout: 2000 });
    await go(p, '/regras'); await p.fill('#rules-q', 'alma'); ok((await p.locator('[aria-label="Resultados da pesquisa"] li').count()) > 0, 'resultados'); await shot(p, 'regras-busca');
    await p.fill('#rules-q', 'zzzxqw'); ok(await p.getByText('Nada encontrado').isVisible(), 'vazio');
    await go(p, '/regras/mestre'); ok(await p.getByText('Conteúdo restrito ao mestre').isVisible(), 'restrito');
  });
  await shot(p, 'regras');

  console.log('Jogador');
  await go(p, '/entrar'); await p.fill('#login-id', 'demo@exemplo.invalid'); await p.fill('#login-pw', 'x'); await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  await p.getByRole('button', { name: 'Entrar como jogador (demo)' }).click(); await p.waitForTimeout(150);
  await t('painel do jogador exibe personagem, PV/ALMA, missões e aviso de privacidade', async () => {
    ok((await h1(p)).includes('Bem-vindo'), 'h1');
    for (const m of ['Personagem principal', 'Missões conhecidas', 'Mapas e regiões reveladas', 'Diário pessoal']) ok(await p.getByRole('heading', { name: m }).isVisible(), m);
    ok((await p.locator('[role=meter]').count()) >= 2, 'medidores');
  });
  await shot(p, 'jogador');
  await t('painel do jogador NÃO mostra segredos do mestre', async () => {
    const txt = await p.locator('main').innerText();
    for (const s of ['Poço Silente', 'Cripta do Sineiro', 'O Badalo Oco', 'Quem toca o último sino', 'sineiro nunca partiu']) ok(!txt.includes(s), 'vazou: ' + s);
  });
  await t('ficha: 6 abas navegáveis, valores marcados como fictícios', async () => {
    await go(p, '/jogador/ficha'); ok(await p.getByText('Dados fictícios').first().isVisible(), 'badge');
    for (const [aba, texto] of [['Atributos', /demonstrativos/], ['Combate', /Condições e estados/], ['Habilidades', /Indisponível/], ['Equipamento', /Consumíveis/], ['Narrativa', /História e personalidade/], ['Identidade', /Conceito/]]) {
      await p.getByRole('tab', { name: aba }).click(); ok(await p.getByText(texto).first().isVisible(), aba);
    }
    await p.getByRole('tab', { name: 'Habilidades' }).click(); await p.getByRole('button', { name: 'Disponíveis', exact: true }).click(); ok((await p.getByText('Indisponível').count()) === 0, 'filtro');
    await p.getByRole('tab', { name: 'Atributos' }).focus(); await p.keyboard.press('ArrowRight'); await p.locator('[role=tab][aria-selected=true]', { hasText: 'Combate' }).waitFor({ timeout: 2000 });
  });
  await shot(p, 'ficha');
  await t('ficha: editar mostra "planejada para a próxima fase"', async () => { await p.getByRole('button', { name: 'Editar ficha' }).click(); ok(await p.getByText(/Funcionalidade planejada para a próxima fase/).isVisible(), 'toast'); });
  await t('jogador não acessa o painel do mestre', async () => { await go(p, '/mestre'); ok(await p.getByText('Área exclusiva do mestre').isVisible(), 'bloqueio'); });
  await t('campanhas do jogador: filtro, detalhes, estado vazio e campanha privada bloqueada', async () => {
    await go(p, '/campanhas'); ok((await p.locator('.camp').count()) === 2, '2 campanhas'); ok(!(await p.getByText('Os Sinos do Poço Silente').count()), 'não mostra campanha do mestre');
    await p.getByRole('button', { name: 'Abrir detalhes' }).first().click(); ok(await p.getByRole('dialog').isVisible(), 'modal'); await p.keyboard.press('Escape'); ok(!(await p.getByRole('dialog').count()), 'esc fecha');
    await p.fill('#camp-q', 'zzz'); ok(await p.getByText('Nenhuma campanha encontrada').isVisible(), 'vazio busca'); await p.fill('#camp-q', '');
    ok(await p.getByText(/não tem acesso/).isVisible(), 'privada'); ok(await p.getByRole('button', { name: /Sem acesso/ }).isDisabled(), 'botão desabilitado');
  });
  await t('"Simular dados vazios" mostra estados vazios', async () => {
    await p.getByLabel('Simular dados vazios').check(); ok(await p.getByText('Você ainda não participa de campanhas').isVisible(), 'vazio campanhas');
    await go(p, '/jogador'); ok(await p.getByText('Nenhuma campanha ainda').isVisible(), 'vazio painel'); await p.getByLabel('Simular dados vazios').uncheck();
  });
  await t('perfil: preferências aplicam-se à interface; sair volta a visitante', async () => {
    await go(p, '/perfil'); await p.getByRole('switch', { name: 'Contraste alto' }).click(); ok((await p.evaluate(() => document.documentElement.dataset.contrast)) === 'alto', 'contraste');
    await p.getByRole('switch', { name: /Reduzir efeitos/ }).click(); ok((await p.evaluate(() => document.documentElement.dataset.effects)) === 'reduzidos', 'efeitos');
    await p.getByRole('button', { name: 'Grande' }).click(); ok((await p.evaluate(() => document.documentElement.style.fontSize)) === '112.5%', 'texto');
    await p.getByRole('button', { name: 'Normal' }).click(); await p.getByRole('switch', { name: 'Contraste alto' }).click();
    await p.getByRole('button', { name: 'Sair' }).click(); await p.getByRole('dialog').getByRole('button', { name: 'Sair' }).click(); await p.waitForTimeout(100);
    await p.waitForFunction(() => location.hash === '#/', null, { timeout: 2000 }); ok(await p.getByRole('link', { name: 'Criar conta' }).first().isVisible(), 'visitante');
  });

  console.log('Mestre');
  await go(p, '/mestre'); await p.getByRole('button', { name: 'Ver como mestre (demo)' }).click(); await p.waitForTimeout(150);
  await t('painel do mestre: visão geral, tarefas frequentes e legenda de visibilidade', async () => {
    ok(await p.getByRole('heading', { name: 'Tarefas frequentes' }).isVisible(), 'tarefas'); ok(await p.getByText('Privado do mestre').first().isVisible(), 'legenda'); ok((await p.locator('.shell').getAttribute('data-role')) === 'mestre', 'tema do mestre');
  });
  await shot(p, 'mestre');
  await t('submenus do mestre: as 10 seções navegam', async () => {
    const secs = ['', 'sessao', 'jogadores', 'missoes', 'bestiario', 'mapas', 'encontros', 'recompensas', 'diario', 'regras'];
    for (const s of secs) { await go(p, '/mestre' + (s ? '/' + s : '')); ok((await p.locator('main h1').count()) === 1, s); }
    await go(p, '/mestre/invalida'); ok(await p.getByText('ainda não foi mapeada').isVisible(), 'seção inválida');
  });
  await t('mapas: mestre vê regiões secretas e alterna revelação (demo)', async () => {
    await go(p, '/mestre/mapas'); ok(await p.getByText('Cripta do Sineiro').first().isVisible(), 'secreta visível ao mestre');
    await p.getByRole('button', { name: 'Revelar' }).first().click(); ok(await p.getByText(/apenas nesta tela de demonstração/).isVisible(), 'toast');
  });
  await t('mestre: missões filtram, bestiário alterna abas, recompensas pedem confirmação', async () => {
    await go(p, '/mestre/missoes'); await p.getByRole('button', { name: 'Secretas' }).click(); ok(await p.getByText('Quem toca o último sino').isVisible(), 'secreta');
    await go(p, '/mestre/bestiario'); await p.getByRole('tab', { name: 'Chefes' }).click(); ok(await p.getByText('O Badalo Oco').isVisible(), 'chefe');
    await go(p, '/mestre/recompensas'); await p.getByRole('button', { name: 'Conceder' }).first().click(); ok(await p.getByRole('dialog').isVisible(), 'modal'); await p.getByRole('button', { name: 'Confirmar' }).click(); ok(await p.getByText(/planejada para a próxima fase/).isVisible(), 'planejado');
  });
  await t('mestre: seletor de campanha sem jogadores e estado vazio global', async () => {
    await go(p, '/mestre/jogadores'); await p.selectOption('#camp-sel', 'sinos'); ok(await p.getByText('Nenhum jogador ainda').isVisible(), 'sem jogadores');
    await p.getByLabel('Simular dados vazios').check(); ok(await p.getByText('Nenhuma campanha para administrar').isVisible(), 'sem campanhas'); await p.getByLabel('Simular dados vazios').uncheck();
  });
  await t('mestre vê campanhas próprias e botão Administrar; regras do mestre liberadas', async () => {
    await go(p, '/campanhas'); ok(await p.getByRole('button', { name: 'Administrar' }).first().isVisible(), 'administrar'); ok(await p.getByText('Os Sinos do Poço Silente').first().isVisible(), 'sinos');
    await go(p, '/regras/mestre'); ok(await p.getByRole('link', { name: 'Ferramentas do mestre' }).first().isVisible(), 'liberado');
  });
  await t('administração global é só estrutura planejada, sem privilégios', async () => { await go(p, '/admin'); ok(await p.getByText(/Não existe conta de administrador/).isVisible(), 'aviso'); ok((await p.getByText('Planejado').count()) >= 5, '5 áreas'); });
  await p.context().close();

  console.log('Celular (390×844)');
  const m = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await t('home sem rolagem horizontal', async () => ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'overflow'));
  await shot(m, 'mobile-home');
  await go(m, '/entrar'); await m.fill('#login-id', 'demo@exemplo.invalid'); await m.fill('#login-pw', 'x'); await m.getByRole('button', { name: 'Entrar', exact: true }).tap(); await m.getByRole('button', { name: 'Entrar como jogador (demo)' }).tap(); await m.waitForTimeout(150);
  await t('menu móvel abre, navega e fecha', async () => {
    ok(!(await m.locator('.sidebar').evaluate((e) => e.getBoundingClientRect().right > 10)), 'menu fechado');
    await m.getByRole('button', { name: 'Abrir menu' }).tap(); await m.waitForTimeout(350); ok(await m.locator('.sidebar').evaluate((e) => e.getBoundingClientRect().left >= 0), 'aberto'); await shot(m, 'mobile-menu');
    await m.locator('.sidebar').getByRole('link', { name: 'Campanhas' }).tap(); await m.waitForTimeout(350); await m.waitForFunction(() => location.hash === '#/campanhas', null, { timeout: 2000 }); ok(!(await m.locator('.sidebar').evaluate((e) => e.getBoundingClientRect().right > 10)), 'fechou');
  });
  await t('painel, ficha e regras sem rolagem horizontal no celular', async () => {
    for (const h of ['/jogador', '/jogador/ficha?aba=habilidades', '/jogador/ficha?aba=equipamento', '/campanhas', '/regras', '/regras/combate/acoes', '/perfil']) { await go(m, h); await m.waitForTimeout(60); ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'overflow em ' + h); const wide = await m.evaluate(() => [...document.querySelectorAll('main .panel, main .tabs, main h1, main .input')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).length); ok(wide === 0, wide + ' elemento(s) além da borda em ' + h); }
  });
  await go(m, '/jogador'); await shot(m, 'mobile-jogador'); await go(m, '/jogador/ficha?aba=atributos'); await shot(m, 'mobile-ficha');
  await t('botões e campos têm área de toque ≥ 44px', async () => {
    await go(m, '/campanhas');
    const small = await m.evaluate(() => [...document.querySelectorAll('main .btn:not(.btn-sm), main input.input')].filter((e) => e.getBoundingClientRect().height && e.getBoundingClientRect().height < 43).length); ok(small === 0, small + ' pequenos');
  });
  await m.context().close();

  console.log('Tablet (820×1180)');
  const tb = await open({ viewport: { width: 820, height: 1180 } });
  await t('tablet: home sem overflow', async () => ok(await tb.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'overflow'));
  await go(tb, '/regras'); await shot(tb, 'tablet-regras'); await tb.context().close();

  console.log('Console');
  await t('nenhum erro de página ou de console durante todos os testes', async () => ok(errors.length === 0, errors.slice(0, 3).join(' | ')));

  await browser.close(); server.close();
  console.log(`\nResultado E2E: ${pass} aprovados, ${fail} falharam.`); if (fail) console.log('Falhas:', failures.join('; '));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
