import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isActiveTo, matchRoute, parseHash } from '../../src/lib/router.ts';
import { isEmail, passwordStrength, validateLogin, validateNewPassword, validateRecovery, validateRegister } from '../../src/lib/validation.ts';
import { searchArticles } from '../../src/lib/search.ts';
import { articles, categories } from '../../src/data/rules.ts';

test('matchRoute casa parâmetros e rejeita caminhos diferentes', () => {
  assert.deepEqual(matchRoute('/regras/:cat/:art', '/regras/combate/acoes'), { cat: 'combate', art: 'acoes' });
  assert.equal(matchRoute('/regras/:cat', '/regras'), null);
  assert.equal(matchRoute('/mestre', '/jogador'), null);
  assert.deepEqual(matchRoute('/', '/'), {});
});
test('parseHash normaliza caminho e lê query', () => {
  const r = parseHash('#/jogador/ficha?aba=combate');
  assert.equal(r.path, '/jogador/ficha'); assert.equal(r.query.get('aba'), 'combate');
  assert.equal(parseHash('').path, '/');
});
test('isActiveTo considera a aba', () => {
  const q = new URLSearchParams('aba=combate');
  assert.equal(isActiveTo('/jogador/ficha?aba=combate', '/jogador/ficha', q), true);
  assert.equal(isActiveTo('/jogador/ficha?aba=atributos', '/jogador/ficha', q), false);
  assert.equal(isActiveTo('/jogador/ficha?aba=identidade', '/jogador/ficha', new URLSearchParams(), 'identidade'), true);
});
test('validação de login (por e-mail)', () => {
  assert.ok(validateLogin({ email: '', password: '' }).email);
  assert.ok(validateLogin({ email: 'abc@', password: 'x' }).email);
  assert.ok(validateLogin({ email: 'nome@dominio.com', password: '' }).password);
  assert.deepEqual(validateLogin({ email: 'nome@dominio.com', password: 'x' }), {});
});
test('validação de nova senha', () => {
  assert.ok(validateNewPassword({ password: 'curta1', confirm: 'curta1' }).password);
  assert.ok(validateNewPassword({ password: 'somenteletras', confirm: 'somenteletras' }).password);
  assert.ok(validateNewPassword({ password: 'Senha1234', confirm: 'outra1234' }).confirm);
  assert.deepEqual(validateNewPassword({ password: 'Senha1234', confirm: 'Senha1234' }), {});
});
test('validação de cadastro: senhas, termos e nenhum campo de papel', () => {
  const ok = { displayName: 'Ilvane', email: 'a@b.co', password: 'senha1234', confirm: 'senha1234', terms: true };
  assert.deepEqual(validateRegister(ok), {});
  assert.ok(validateRegister({ ...ok, confirm: 'outra123' }).confirm);
  assert.ok(validateRegister({ ...ok, terms: false }).terms);
  assert.ok(validateRegister({ ...ok, password: 'somenteletras', confirm: 'somenteletras' }).password);
  assert.equal('role' in ok, false);
});
test('recuperação e e-mail', () => {
  assert.ok(validateRecovery({ email: '' }).email); assert.deepEqual(validateRecovery({ email: 'a@b.co' }), {});
  assert.equal(isEmail('x@y'), false);
});
test('força da senha cresce', () => {
  assert.equal(passwordStrength(''), 0);
  assert.ok(passwordStrength('Abcdefg1!') > passwordStrength('abc'));
});
test('busca ignora acentos e caixa e exige todos os termos', () => {
  assert.ok(searchArticles(articles, 'ALMA').length > 0);
  assert.ok(searchArticles(articles, 'inventario').some((a) => a.category === 'equipamentos'));
  assert.equal(searchArticles(articles, 'zzzxqw').length, 0);
  assert.equal(searchArticles(articles, 'a').length, 0);
});
test('compêndio tem as 16 categorias e todo artigo pertence a uma', () => {
  assert.equal(categories.length, 16);
  const slugs = new Set(categories.map((c) => c.slug));
  assert.ok(articles.every((a) => slugs.has(a.category)));
  assert.ok(categories.every((c) => articles.some((a) => a.category === c.slug)), 'toda categoria tem ao menos um artigo');
});
