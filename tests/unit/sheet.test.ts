import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ATTRIBUTES, clampInt, defaultSheet, friendlyError, normalizeSheet, getEffectiveAttribute, getEffectiveModifier, recalculateDerivedStats, applyRecalculatedStats } from '../../src/lib/sheet.ts';

test('normalizeSheet: entrada inválida vira ficha padrão', () => {
  for (const bad of [null, undefined, 5, 'x', [], {}]) assert.deepEqual(normalizeSheet(bad), defaultSheet());
});

test('normalizeSheet: limita números, corta textos e mantém PV atual <= máximo', () => {
  const s = normalizeSheet({
    pv: { now: 900, max: 12 },
    defense: -4,
    attributes: { VIG: 99, AGI: 'abc' },
    concept: 'x'.repeat(999),
    abilities: 'nao-lista'
  });
  assert.equal(s.pv.max, 12);
  assert.equal(s.pv.now, 12);
  assert.equal(s.defense, 0);
  assert.equal(s.attributes.VIG, 30);
  assert.equal(s.attributes.AGI, 10);
  assert.equal(s.concept.length, 300);
  assert.deepEqual(s.abilities, []);
  assert.deepEqual(Object.keys(s.attributes).sort(), [...ATTRIBUTES].sort());
});

test('normalizeSheet: ignora campos desconhecidos (não os propaga)', () => {
  assert.equal('role' in normalizeSheet({ role: 'mestre', hack: 1 }), false);
});

test('normalizeSheet: normaliza attributeBonuses', () => {
  const s = normalizeSheet({ attributeBonuses: { AGI: 5, FOR: -3, INT: 20 } });
  assert.equal(s.attributeBonuses.AGI, 5);
  assert.equal(s.attributeBonuses.FOR, -3);
  assert.equal(s.attributeBonuses.INT, 10); // clamped to max 10
});

test('clampInt', () => {
  assert.equal(clampInt('7', 0, 10, 1), 7);
  assert.equal(clampInt(99, 0, 10, 1), 10);
  assert.equal(clampInt('', 0, 10, 3), 3);
  assert.equal(clampInt(2.9, 0, 10, 1), 2);
});

test('getEffectiveAttribute: soma base + bônus', () => {
  const sheet = defaultSheet();
  sheet.attributes.AGI = 14;
  sheet.attributeBonuses.AGI = 2;
  assert.equal(getEffectiveAttribute(sheet, 'AGI'), 16);
});

test('getEffectiveModifier: calcula modificador do valor efetivo', () => {
  const sheet = defaultSheet();
  sheet.attributes.FOR = 12;
  sheet.attributeBonuses.FOR = 2;
  // Efetivo = 14, mod = (14-10)/2 = 2
  assert.equal(getEffectiveModifier(sheet, 'FOR'), 2);
});

test('recalculateDerivedStats: recalcula PV, ALMA e defesa', () => {
  const sheet = defaultSheet();
  sheet.attributes.VIG = 14;
  sheet.attributes.INT = 16;
  sheet.attributes.AGI = 12;

  const derived = recalculateDerivedStats(sheet, 2);

  // PV = 10 + (14 × 2) + mod(14) = 10 + 28 + 2 = 40
  assert.equal(derived.pv.max, 40);

  // ALMA = 5 + (16 × 2 / 2) + mod(16) = 5 + 16 + 3 = 24
  assert.equal(derived.alma.max, 24);

  // Defesa = 10 + mod(12) = 10 + 1 = 11
  assert.equal(derived.defense, 11);
});

test('applyRecalculatedStats: mantém PV/ALMA atual dentro dos novos máximos', () => {
  const sheet = defaultSheet();
  sheet.attributes.VIG = 14;
  sheet.attributes.INT = 16;
  sheet.pv.now = 100;
  sheet.alma.now = 100;

  const updated = applyRecalculatedStats(sheet, 2);

  // PV máximo = 40, então atual deve ser clamped para 40
  assert.ok(updated.pv.now <= updated.pv.max);
  assert.equal(updated.pv.now, 40);

  // ALMA máxima = 24, então atual deve ser clamped para 24
  assert.ok(updated.alma.now <= updated.alma.max);
  assert.equal(updated.alma.now, 24);
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
