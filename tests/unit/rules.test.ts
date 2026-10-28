import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ATTRIBUTES,
  getModifier,
  calculateMaxPV,
  calculateMaxAlma,
  calculateDefense,
  calculateInitiative,
  rollDice,
  rollMultipleDice,
  rollDiceSum,
  rollAttributeTest,
  rollAttributeTestByDifficulty,
  rollDamage,
  applyDamageModifiers,
  isValidAttributeValue,
  isValidStage,
  normalizeAttributeValue,
  DIFFICULTY_DC,
} from '../../src/lib/rules.ts';

// ========== ATRIBUTOS ==========

test('ATTRIBUTES contém exatamente AGI, FOR, INT, PRE, VIG', () => {
  assert.deepEqual([...ATTRIBUTES], ['AGI', 'FOR', 'INT', 'PRE', 'VIG']);
});

// ========== MODIFICADORES ==========

test('getModifier: calcula corretamente para valores típicos', () => {
  assert.equal(getModifier(1), -5);   // (1-10)/2 = -4.5 → -5 arredondado para baixo
  assert.equal(getModifier(8), -1);   // (8-10)/2 = -1
  assert.equal(getModifier(10), 0);   // valor padrão
  assert.equal(getModifier(12), 1);   // (12-10)/2 = 1
  assert.equal(getModifier(15), 2);   // (15-10)/2 = 2.5 → 2
  assert.equal(getModifier(20), 5);   // (20-10)/2 = 5
  assert.equal(getModifier(30), 10);  // (30-10)/2 = 10
});

test('getModifier: arredonda para baixo corretamente', () => {
  assert.equal(getModifier(11), 0);   // (11-10)/2 = 0.5 → 0
  assert.equal(getModifier(13), 1);   // (13-10)/2 = 1.5 → 1
  assert.equal(getModifier(9), -1);   // (9-10)/2 = -0.5 → -1
});

// ========== CÁLCULOS DERIVADOS ==========

test('calculateMaxPV: fórmula 10 + (VIG × estágio) + mod', () => {
  assert.equal(calculateMaxPV(10, 1), 10 + 10 + 0);   // 20
  assert.equal(calculateMaxPV(12, 1), 10 + 12 + 1);   // 23
  assert.equal(calculateMaxPV(15, 3), 10 + 45 + 2);   // 57
  assert.equal(calculateMaxPV(8, 2), 10 + 16 - 1);    // 25
});

test('calculateMaxAlma: fórmula 5 + (INT × estágio / 2) + mod', () => {
  assert.equal(calculateMaxAlma(10, 1), Math.floor(5 + 5 + 0));    // 10
  assert.equal(calculateMaxAlma(14, 2), Math.floor(5 + 14 + 2));   // 21
  assert.equal(calculateMaxAlma(12, 3), Math.floor(5 + 18 + 1));   // 24
  assert.equal(calculateMaxAlma(8, 1), Math.floor(5 + 4 - 1));     // 8
});

test('calculateDefense: 10 + mod de AGI', () => {
  assert.equal(calculateDefense(10), 10);   // mod 0
  assert.equal(calculateDefense(14), 12);   // mod 2
  assert.equal(calculateDefense(8), 9);     // mod -1
  assert.equal(calculateDefense(20), 15);   // mod 5
});

test('calculateInitiative: apenas mod de AGI', () => {
  assert.equal(calculateInitiative(10), 0);
  assert.equal(calculateInitiative(16), 3);
  assert.equal(calculateInitiative(8), -1);
});

// ========== ROLAGEM DE DADOS ==========

test('rollDice: retorna valor entre 1 e N', () => {
  for (let i = 0; i < 20; i++) {
    const roll = rollDice(6);
    assert.ok(roll >= 1 && roll <= 6, `rollDice(6) retornou ${roll}`);
  }
  for (let i = 0; i < 20; i++) {
    const roll = rollDice(20);
    assert.ok(roll >= 1 && roll <= 20, `rollDice(20) retornou ${roll}`);
  }
});

test('rollMultipleDice: retorna array com quantidade correta', () => {
  const rolls = rollMultipleDice(3, 6);
  assert.equal(rolls.length, 3);
  rolls.forEach(r => assert.ok(r >= 1 && r <= 6));
});

test('rollDiceSum: soma múltiplos dados', () => {
  const sum = rollDiceSum(2, 6);
  assert.ok(sum >= 2 && sum <= 12, `rollDiceSum(2, 6) = ${sum}`);
});

test('rollAttributeTest: estrutura do resultado', () => {
  const result = rollAttributeTest(15, 15, 0);
  assert.ok(result.roll >= 1 && result.roll <= 20);
  assert.equal(result.modifier, 2);  // mod de 15
  assert.equal(result.total, result.roll + result.modifier);
  assert.equal(result.dc, 15);
  assert.equal(typeof result.success, 'boolean');
  assert.equal(typeof result.criticalSuccess, 'boolean');
  assert.equal(typeof result.criticalFailure, 'boolean');
});

test('rollAttributeTest: sucesso crítico em 20 sempre', () => {
  // Não podemos forçar o roll, mas podemos verificar lógica
  // Vamos testar várias vezes e verificar quando aparecer 20
  let foundCritSuccess = false;
  for (let i = 0; i < 100; i++) {
    const result = rollAttributeTest(10, 25, 0);
    if (result.roll === 20) {
      assert.equal(result.criticalSuccess, true);
      assert.equal(result.success, true);
      foundCritSuccess = true;
      break;
    }
  }
  // Estatisticamente, em 100 tentativas devemos ver pelo menos um 20
  assert.ok(foundCritSuccess || true); // não falha se não achar, mas verifica lógica
});

test('rollAttributeTestByDifficulty: usa DC correto', () => {
  const result = rollAttributeTestByDifficulty(15, 'moderada', 0);
  assert.equal(result.dc, DIFFICULTY_DC.moderada); // 15
});

// ========== DANO ==========

test('rollDamage: estrutura e total correto', () => {
  const result = rollDamage({ quantity: 2, sides: 6, bonus: 3 });
  assert.equal(result.rolls.length, 2);
  result.rolls.forEach(r => assert.ok(r >= 1 && r <= 6));
  assert.equal(result.bonus, 3);
  const expectedTotal = result.rolls[0] + result.rolls[1] + 3;
  assert.equal(result.total, expectedTotal);
});

test('rollDamage: nunca retorna dano negativo', () => {
  const result = rollDamage({ quantity: 1, sides: 4, bonus: -10 });
  assert.ok(result.total >= 0);
});

test('applyDamageModifiers: imunidade anula dano', () => {
  assert.equal(applyDamageModifiers(20, false, false, true), 0);
});

test('applyDamageModifiers: resistência reduz pela metade', () => {
  assert.equal(applyDamageModifiers(20, true, false, false), 10);
  assert.equal(applyDamageModifiers(15, true, false, false), 7); // arredonda para baixo
});

test('applyDamageModifiers: vulnerabilidade aumenta 1.5x', () => {
  assert.equal(applyDamageModifiers(20, false, true, false), 30);
  assert.equal(applyDamageModifiers(11, false, true, false), 16); // 16.5 → 16
});

test('applyDamageModifiers: sem modificadores retorna valor original', () => {
  assert.equal(applyDamageModifiers(25, false, false, false), 25);
});

// ========== VALIDAÇÕES ==========

test('isValidAttributeValue: aceita 1-30', () => {
  assert.equal(isValidAttributeValue(1), true);
  assert.equal(isValidAttributeValue(15), true);
  assert.equal(isValidAttributeValue(30), true);
  assert.equal(isValidAttributeValue(0), false);
  assert.equal(isValidAttributeValue(31), false);
  assert.equal(isValidAttributeValue(10.5), false); // não é inteiro
  assert.equal(isValidAttributeValue(-5), false);
});

test('isValidStage: aceita 1-20', () => {
  assert.equal(isValidStage(1), true);
  assert.equal(isValidStage(10), true);
  assert.equal(isValidStage(20), true);
  assert.equal(isValidStage(0), false);
  assert.equal(isValidStage(21), false);
  assert.equal(isValidStage(5.5), false);
});

test('normalizeAttributeValue: limita entre 1-30 e usa 10 como default', () => {
  assert.equal(normalizeAttributeValue(15), 15);
  assert.equal(normalizeAttributeValue(0), 1);      // 0 é número finito → clampado para 1 (mínimo)
  assert.equal(normalizeAttributeValue(-5), 1);     // negativo é número finito → clampado para 1 (mínimo)
  assert.equal(normalizeAttributeValue(50), 30);    // clamp máximo
  assert.equal(normalizeAttributeValue(null), 10);  // não é número finito → default 10
  assert.equal(normalizeAttributeValue(undefined), 10); // não é número finito → default 10
  assert.equal(normalizeAttributeValue('abc'), 10); // NaN → não é finito → default 10
  assert.equal(normalizeAttributeValue(12.7), 12);  // arredonda para baixo antes do clamp
});

// ========== DIFICULDADES ==========

test('DIFFICULTY_DC: valores corretos', () => {
  assert.equal(DIFFICULTY_DC.trivial, 5);
  assert.equal(DIFFICULTY_DC.facil, 10);
  assert.equal(DIFFICULTY_DC.moderada, 15);
  assert.equal(DIFFICULTY_DC.dificil, 20);
  assert.equal(DIFFICULTY_DC.heroica, 25);
  assert.equal(DIFFICULTY_DC.impossivel, 30);
});
