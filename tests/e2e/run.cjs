// Testes de interface (Playwright + Chromium) contra o build com CLIENTE FALSO (FAKE_SUPABASE=1).
// Validam a UI: fluxos, guardas de rota, estados de erro/carregamento e persistência na recarga.
// NÃO provam segurança nem a integração com o Supabase real: isso é papel de supabase/tests/rls_security.test.sql.
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
const PW = 'Senha1234';

(async () => {
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch(); const errors = [];
  const open = async (opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts }); const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    await page.goto(base); await page.waitForTimeout(150); return page;
  };
  const go = async (p, h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(120); };
  const hash = (p, h, ms = 3000) => p.waitForFunction((x) => location.hash === x, h, { timeout: ms });
  const hashRe = (p, re, ms = 3000) => p.waitForFunction((s) => new RegExp(s).test(location.hash), re, { timeout: ms });
  const see = (p, text, ms = 3000) => (typeof text === 'string' ? p.getByText(text, { exact: false }) : p.getByText(text)).first().waitFor({ state: 'visible', timeout: ms });
  const gone = async (p, text) => { await p.waitForTimeout(150); ok((await p.getByText(text).count()) === 0, 'não deveria aparecer: ' + text); };
  const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'f2-' + n + '.png') }); };
  const fake = (p, fn, arg) => p.evaluate(fn, arg);
  const register = async (p, name, email) => {
    await go(p, '/entrar'); await go(p, '/cadastro'); await p.fill('#reg-name', name); await p.fill('#reg-email', email); await p.fill('#reg-pw', PW); await p.fill('#reg-confirm', PW);
    await p.getByRole('checkbox').check(); await p.getByRole('button', { name: 'Criar conta' }).click(); await see(p, 'Confirme seu e-mail');
  };
  const login = async (p, email, pw = PW) => { await go(p, '/entrar'); await p.fill('#login-email', email); await p.fill('#login-pw', pw); await p.getByRole('button', { name: 'Entrar', exact: true }).click(); };
  const logout = async (p) => { await p.getByRole('button', { name: 'Sair' }).first().click(); await hash(p, '#/'); };
  const newPlayer = async (p, name, email) => { await register(p, name, email); await fake(p, (e) => window.__fake.confirm(e), email); await login(p, email); await hash(p, '#/jogador'); };

  const p = await open();
  console.log('Visitante e guardas de rota');
  await t('home pública carrega sem sessão', async () => { ok((await p.locator('h1').first().innerText()).toLowerCase().includes('valdrim'), 'h1'); });
  await t('rotas privadas redirecionam o visitante para o login', async () => {
    for (const h of ['/jogador', '/jogador/ficha', '/campanhas', '/perfil', '/mestre', '/mestre/jogadores', '/admin']) { await go(p, h); await hash(p, '#/entrar'); }
  });
  await t('regras públicas continuam acessíveis; categoria do mestre bloqueada', async () => {
    await go(p, '/regras'); ok((await p.locator('.cat').count()) === 16, '16 categorias'); await p.fill('#rules-q', 'alma'); await p.locator('[aria-label="Resultados da pesquisa"] li').first().waitFor();
    await go(p, '/regras/mestre'); await see(p, 'Conteúdo restrito ao mestre');
  });

  console.log('Cadastro, confirmação e login');
  await t('cadastro valida campos e não permite escolher papel', async () => {
    await go(p, '/cadastro'); ok((await p.locator('select, input[type=radio]').count()) === 0, 'sem campo de papel');
    await p.fill('#reg-name', 'I'); await p.fill('#reg-email', 'x'); await p.fill('#reg-pw', 'abc'); await p.fill('#reg-confirm', 'zzz'); await p.getByRole('button', { name: 'Criar conta' }).click();
    for (const m of [/ao menos 2 caracteres/, /e-mail parece incompleto/, /ao menos 8 caracteres/, /não são iguais/, /aceitar os termos/]) await see(p, m);
    await shot(p, 'cadastro-erros');
  });
  await t('cadastro real: pede confirmação de e-mail; e-mail repetido recebe resposta idêntica', async () => {
    await register(p, 'Jogador A', 'ja@exemplo.test'); await shot(p, 'cadastro-ok');
    await register(p, 'Outro Nome', 'ja@exemplo.test');   // mesma resposta: não revela que a conta existe
    ok((await fake(p, () => window.__fake.db().users.length)) === 1, 'não duplicou usuário');
  });
  await t('login: e-mail não confirmado, senha errada e erro de rede mostram mensagens claras', async () => {
    await login(p, 'ja@exemplo.test'); await see(p, /Confirme seu e-mail antes de entrar/);
    await fake(p, () => window.__fake.confirm('ja@exemplo.test'));
    await login(p, 'ja@exemplo.test', 'errada123'); await see(p, 'E-mail ou senha incorretos.');
    await login(p, 'naoexiste@exemplo.test'); await see(p, 'E-mail ou senha incorretos.');   // mesma mensagem: não revela contas
    await fake(p, () => { window.__fake.offline = true; }); await login(p, 'ja@exemplo.test'); await see(p, /Sem conexão/); await fake(p, () => { window.__fake.offline = false; });
    await shot(p, 'login-erro');
  });
  await t('login válido leva ao painel do jogador e a sessão sobrevive à recarga', async () => {
    await login(p, 'ja@exemplo.test'); await hash(p, '#/jogador'); await see(p, 'Bem-vindo de volta, Jogador A');
    await p.reload(); await see(p, 'Bem-vindo de volta, Jogador A'); ok(p.url().endsWith('#/jogador'), 'continua no painel (sem piscar para o login)');
    await go(p, '/campanhas'); await p.reload(); await see(p, 'Você ainda não participa de campanhas');
  });
  await t('usuário logado não vê login/cadastro; jogador não entra na área do mestre', async () => {
    await go(p, '/entrar'); await hash(p, '#/jogador'); await go(p, '/mestre'); await hash(p, '#/jogador'); await go(p, '/mestre/mapas'); await hash(p, '#/jogador');
  });
  await t('painel não exibe dados fictícios da Fase 1', async () => {
    await go(p, '/jogador'); await see(p, 'Nenhum personagem ainda');
    for (const x of ['Ilvane', 'Cartógrafa', 'Dados fictícios', 'As Cinzas']) await gone(p, x);
  });
  await t('logout encerra a sessão e bloqueia o acesso depois', async () => {
    await logout(p); await go(p, '/jogador'); await hash(p, '#/entrar'); await p.reload(); await hash(p, '#/entrar');
    ok((await fake(p, () => localStorage.getItem('fake_session'))) === null, 'sessão removida');
  });
  await t('sessão expirada: volta ao login com aviso', async () => {
    await login(p, 'ja@exemplo.test'); await hash(p, '#/jogador'); await fake(p, () => window.__fake.expireSession()); await hash(p, '#/entrar'); await see(p, 'Sua sessão expirou');
  });

  console.log('Recuperação de senha');
  await t('pedido de recuperação responde igual para qualquer e-mail', async () => {
    await go(p, '/recuperar'); await p.getByRole('button', { name: 'Enviar link' }).click(); await see(p, 'Informe o e-mail da conta.');
    await p.fill('#rec-email', 'naoexiste@exemplo.test'); await p.getByRole('button', { name: 'Enviar link' }).click(); await see(p, /Se existir uma conta/);
  });
  await t('/redefinir-senha sem link válido mostra erro, nunca o formulário', async () => {
    await go(p, '/redefinir-senha'); await see(p, 'Link inválido ou expirado'); ok((await p.locator('#new-pw').count()) === 0, 'sem formulário');
  });
  await t('com link válido: valida, recusa a senha antiga e define a nova', async () => {
    await fake(p, () => window.__fake.openRecoveryLink('ja@exemplo.test')); await go(p, '/redefinir-senha'); await p.locator('#new-pw').waitFor();
    await p.fill('#new-pw', 'curta'); await p.fill('#new-confirm', 'outra'); await p.getByRole('button', { name: 'Salvar nova senha' }).click(); await see(p, /ao menos 8 caracteres/); await see(p, /não são iguais/);
    await p.fill('#new-pw', PW); await p.fill('#new-confirm', PW); await p.getByRole('button', { name: 'Salvar nova senha' }).click(); await see(p, /Escolha uma senha diferente/);
    await p.fill('#new-pw', 'NovaSenha99'); await p.fill('#new-confirm', 'NovaSenha99'); await p.getByRole('button', { name: 'Salvar nova senha' }).click(); await see(p, 'Senha atualizada'); await shot(p, 'senha-ok');
    await p.getByRole('button', { name: 'Continuar' }).click(); await p.waitForTimeout(150);
    await fake(p, () => window.__fake.expireSession()); await login(p, 'ja@exemplo.test', 'NovaSenha99'); await hash(p, '#/jogador');
  });
  await logout(p);

  console.log('Campanha, convite e fichas');
  let tokenA, charUrl;
  await register(p, 'Mestre A', 'ma@exemplo.test'); await fake(p, () => { window.__fake.confirm('ma@exemplo.test'); window.__fake.promote('ma@exemplo.test'); });
  await t('mestre entra no painel do mestre e cria uma campanha privada', async () => {
    await login(p, 'ma@exemplo.test'); await hash(p, '#/mestre'); await see(p, 'Você ainda não administra campanhas');
    await go(p, '/campanhas'); await p.getByRole('button', { name: 'Nova campanha' }).first().click(); await p.fill('#nc-name', 'As Cinzas'); await p.fill('#nc-desc', 'Campanha privada de teste');
    await p.getByRole('dialog').getByRole('button', { name: 'Criar campanha' }).click(); await see(p, 'Você é o dono'); await shot(p, 'campanhas-mestre');
  });
  await t('mestre gera convite (token mostrado uma vez)', async () => {
    await p.getByRole('button', { name: 'Abrir detalhes' }).first().click(); await p.getByRole('button', { name: 'Gerar convite' }).click();
    tokenA = await p.locator('[data-testid=invite-token]').innerText(); ok(tokenA.length >= 32, 'token longo'); await see(p, /não será mostrado de novo/); await p.keyboard.press('Escape');
  });
  await logout(p);
  await t('jogador A: convite inválido é recusado; convite válido entra na campanha', async () => {
    await login(p, 'ja@exemplo.test', 'NovaSenha99'); await hash(p, '#/jogador'); await go(p, '/campanhas');
    await p.getByRole('button', { name: 'Entrar com convite' }).first().click(); await p.fill('#inv-token', 'chute-invalido-123'); await p.getByRole('dialog').getByRole('button', { name: 'Entrar na campanha' }).click(); await see(p, 'Convite inválido ou expirado.');
    await p.fill('#inv-token', tokenA); await p.getByRole('dialog').getByRole('button', { name: 'Entrar na campanha' }).click(); await see(p, 'As Cinzas'); await see(p, 'Você participa');
  });
  await t('convite é de uso único', async () => {
    await p.getByRole('button', { name: 'Entrar com convite' }).first().click(); await p.fill('#inv-token', tokenA); await p.getByRole('dialog').getByRole('button', { name: 'Entrar na campanha' }).click();
    await p.getByText(/Convite inválido ou expirado|já participa/).first().waitFor(); await p.keyboard.press('Escape');
  });
  await t('jogador A cria personagem, edita, salva e os dados persistem após recarregar', async () => {
    await go(p, '/jogador'); await p.getByRole('button', { name: 'Novo personagem' }).first().click(); await p.fill('#nch-name', 'Ilvane'); await p.getByRole('dialog').getByRole('button', { name: 'Criar', exact: true }).click();
    await hashRe(p, '^#/jogador/ficha\\?id='); charUrl = await p.evaluate(() => location.hash.slice(1)); await see(p, 'Estágio 1');
    await p.fill('#f-concept', 'Mapeia ruínas'); ok(await p.getByText('Alterações não salvas').first().isVisible(), 'indica não salvo');
    await p.getByRole('tab', { name: 'Combate' }).click(); await p.fill('#f-pv-max', '24'); await p.fill('#f-pv-now', '18');
    await p.getByRole('button', { name: 'Salvar ficha' }).click(); await see(p, 'Ficha salva.'); await shot(p, 'ficha-salva');
    await p.reload(); await p.getByRole('tab', { name: 'Combate' }).click(); await p.waitForFunction(() => document.querySelector('#f-pv-now')?.value === '18');
    ok((await p.inputValue('#f-pv-max')) === '24', 'PV máx persistiu'); await p.getByRole('tab', { name: 'Identidade' }).click(); await p.waitForFunction(() => document.querySelector('#f-concept')?.value === 'Mapeia ruínas');
  });
  await t('jogador não vê campo de progressão; falha de rede ao salvar preserva o rascunho', async () => {
    ok((await p.locator('#f-stage').count()) === 0, 'sem campo de estágio'); await p.fill('#f-concept', 'Rascunho novo');
    await fake(p, () => { window.__fake.offline = true; }); await p.getByRole('button', { name: 'Salvar ficha' }).click(); await see(p, /Sem conexão/);
    ok((await p.inputValue('#f-concept')) === 'Rascunho novo', 'rascunho mantido'); await fake(p, () => { window.__fake.offline = false; });
    await p.getByRole('button', { name: 'Salvar ficha' }).click(); await see(p, 'Ficha salva.');
  });
  await logout(p);
  await t('mestre vê participantes e a ficha do jogador e altera a progressão', async () => {
    await login(p, 'ma@exemplo.test'); await hash(p, '#/mestre'); await see(p, 'As Cinzas'); await go(p, '/mestre/jogadores'); await see(p, 'Jogador A'); await see(p, 'Ilvane');
    await p.getByRole('link', { name: 'Abrir ficha' }).click(); await p.locator('#f-stage').waitFor(); await p.fill('#f-stage', '3'); await p.getByRole('button', { name: 'Salvar ficha' }).click(); await see(p, 'Ficha salva.');
  });
  await t('seções futuras do mestre não exibem dados inventados', async () => {
    for (const s of ['missoes', 'bestiario', 'mapas', 'encontros', 'recompensas', 'diario']) { await go(p, '/mestre/' + s); await see(p, 'Planejado para uma fase futura'); }
    await go(p, '/mestre/invalida'); await see(p, 'ainda não foi mapeada');
  });
  await logout(p);
  await t('jogador A vê a progressão definida pelo mestre', async () => { await login(p, 'ja@exemplo.test', 'NovaSenha99'); await hash(p, '#/jogador'); await go(p, charUrl); await see(p, 'Estágio 3'); });
  await logout(p);

  console.log('Isolamento entre usuários');
  await newPlayer(p, 'Jogador B', 'jb@exemplo.test');
  await t('jogador B sem vínculo: não vê campanha nem ficha de outros', async () => {
    await go(p, '/campanhas'); await see(p, 'Você ainda não participa de campanhas'); await gone(p, 'As Cinzas');
    await go(p, charUrl); await see(p, 'Ficha não encontrada'); await gone(p, 'Mapeia ruínas'); await gone(p, 'Ilvane');
    await go(p, '/jogador'); await see(p, 'Nenhum personagem ainda'); await shot(p, 'isolamento');
  });
  await t('painel do jogador B não lista dados do jogador A', async () => { const txt = await p.locator('main').innerText(); ok(!/Ilvane|As Cinzas|Jogador A|Mestre A/.test(txt), 'vazou'); });
  await t('perfil: altera o nome de exibição e o papel é somente leitura', async () => {
    await go(p, '/perfil'); await p.fill('#prof-name', 'Jogador Bravo'); await p.getByRole('button', { name: 'Salvar nome' }).click(); await see(p, 'Nome atualizado.');
    ok((await p.locator('select').count()) === 0, 'sem seletor de papel'); await see(p, /não pode ser alterado aqui/);
    await go(p, '/jogador'); await see(p, 'Bem-vindo de volta, Jogador Bravo');
  });
  await p.context().close();

  console.log('Celular (390×844)');
  const m = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await newPlayer(m, 'Jogador M', 'jm@exemplo.test');
  await t('menu móvel abre, navega e fecha', async () => {
    await m.getByRole('button', { name: 'Abrir menu' }).tap(); await m.waitForTimeout(350); await shot(m, 'mobile-menu');
    await m.locator('.sidebar').getByRole('link', { name: 'Campanhas' }).tap(); await hash(m, '#/campanhas'); await m.waitForTimeout(350);
    ok(!(await m.locator('.sidebar').evaluate((e) => e.getBoundingClientRect().right > 10)), 'fechou');
  });
  await t('sem rolagem horizontal nem painéis fora da tela', async () => {
    for (const h of ['/jogador', '/campanhas', '/perfil', '/regras', '/entrar']) {
      if (h === '/entrar') { await logout(m); }
      await go(m, h); await m.waitForTimeout(200);
      ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'overflow em ' + h);
      const wide = await m.evaluate(() => [...document.querySelectorAll('main .panel, main .tabs, main h1, main .input')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).length); ok(wide === 0, wide + ' além da borda em ' + h);
    }
    await shot(m, 'mobile-login');
  });
  await m.context().close();

  console.log('Console');
  await t('nenhum erro de página ou de console', async () => ok(errors.length === 0, errors.slice(0, 3).join(' | ')));
  await browser.close(); server.close();
  console.log(`\nResultado E2E (cliente falso): ${pass} aprovados, ${fail} falharam.`); if (fail) console.log('Falhas:', failures.join('; '));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
