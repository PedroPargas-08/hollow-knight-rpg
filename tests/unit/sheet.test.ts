import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTES, clampInt, defaultSheet, friendlyError, normalizeSheet } from '../../src/lib/sheet.ts';

test('normalizeSheet: entrada inválida vira ficha padrão', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}]) assert.deepEqual(normalizeSheet(bad), defaultSheet());
});
test('normalizeSheet: limita números, corta textos e mantém PV atual <= máximo', () => {
  const s = normalizeSheet({ pv: { now: 900, max: 12 }, defense: -4, attributes: { Vigor: 99, Agilidade: 'abc' }, concept: 'x'.repeat(999), abilities: 'nao-lista' });
  assert.equal(s.pv.max, 12); assert.equal(s.pv.now, 12); assert.equal(s.defense, 0);
  assert.equal(s.attributes.Vigor, 30); assert.equal(s.attributes.Agilidade, 10);
  assert.equal(s.concept.length, 300); assert.deepEqual(s.abilities, []);
  assert.deepEqual(Object.keys(s.attributes), [...ATTRIBUTES]);
});
test('normalizeSheet: ignora campos desconhecidos (não os propaga)', () => {
  assert.equal('role' in normalizeSheet({ role: 'mestre', hack: 1 }), false);
});
test('clampInt', () => {
  assert.equal(clampInt('7', 0, 10, 1), 7); assert.equal(clampInt(99, 0, 10, 1), 10); assert.equal(clampInt('', 0, 10, 3), 3); assert.equal(clampInt(2.9, 0, 10, 1), 2);
});
test('friendlyError: mensagens claras e sem vazar detalhes internos', () => {
  assert.match(friendlyError({ message: 'Failed to fetch' }), /Sem conexão/);
  assert.match(friendlyError({ name: 'AuthRetryableFetchError', message: 'x' }), /Sem conexão/);
  assert.equal(friendlyError({ message: 'Invalid login credentials' }), 'E-mail ou senha incorretos.');
  assert.match(friendlyError({ message: 'Email not confirmed' }), /Confirme seu e-mail/);
  assert.match(friendlyError({ message: 'New password should be different from the old password.' }), /diferente da atual/);
  assert.match(friendlyError({ code: 'weak_password', message: 'Password should be at least 8 characters.' }), /fraca demais/);
  assert.match(friendlyError({ code: '42501', message: 'new row violates row-level security policy for table "characters"' }), /não tem permissão/);
  assert.match(friendlyError({ code: '22023', message: 'Convite inválido ou expirado' }), /Convite inválido/);
  assert.match(friendlyError({ code: 'NOT_FOUND_OR_DENIED', message: 'x' }), /sem permissão/);
  const generic = friendlyError({ code: 'XX000', message: 'relation "public.secret_table" does not exist' });
  assert.ok(!/secret_table|relation/.test(generic), 'não deve vazar a mensagem interna');
});
