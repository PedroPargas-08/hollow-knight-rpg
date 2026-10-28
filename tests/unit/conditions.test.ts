import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyCondition,
  removeCondition,
  reduceConditionStack,
  processEndOfTurn,
  calculateConditionModifiers,
  calculateDamageOverTime,
  createConditionMap,
  type Condition,
  type ActiveCondition
} from '../../src/lib/conditions.ts';

// ========== APLICAÇÃO DE CONDIÇÕES ==========

test('applyCondition: aplica nova condição', () => {
  const condition: Condition = {
    id: 'test_condition',
    type: 'envenenado',
    name: 'Test',
    description: 'Test condition',
    severity: 'leve',
    effects: [],
    duration: 3,
    stackingRules: { canStack: false }
  };

  const result = applyCondition([], condition, 1);

  assert.equal(result.length, 1);
  assert.equal(result[0].conditionId, 'test_condition');
  assert.equal(result[0].remainingDuration, 3);
  assert.equal(result[0].stacks, 1);
});

test('applyCondition: renova condição que não empilha', () => {
  const condition: Condition = {
    id: 'test',
    type: 'atordoado',
    name: 'Test',
    description: 'Test',
    severity: 'leve',
    effects: [],
    duration: 2,
    stackingRules: { canStack: false }
  };

  const existing: ActiveCondition[] = [{
    conditionId: 'test',
    appliedAtTurn: 1,
    remainingDuration: 1,
    stacks: 1,
    severity: 'leve'
  }];

  const result = applyCondition(existing, condition, 2);

  assert.equal(result.length, 1);
  assert.equal(result[0].remainingDuration, 2); // Renovada
  assert.equal(result[0].stacks, 1); // Não empilha
});

test('applyCondition: empilha e renova (refresh)', () => {
  const condition: Condition = {
    id: 'test',
    type: 'envenenado',
    name: 'Test',
    description: 'Test',
    severity: 'leve',
    effects: [],
    duration: 3,
    stackingRules: { canStack: true, maxStacks: 5, stackBehavior: 'refresh' }
  };

  const existing: ActiveCondition[] = [{
    conditionId: 'test',
    appliedAtTurn: 1,
    remainingDuration: 1,
    stacks: 2,
    severity: 'leve'
  }];

  const result = applyCondition(existing, condition, 2);

  assert.equal(result[0].stacks, 3);
  assert.equal(result[0].remainingDuration, 3); // Renovada
});

test('applyCondition: empilha e estende (extend)', () => {
  const condition: Condition = {
    id: 'test',
    type: 'queimando',
    name: 'Test',
    description: 'Test',
    severity: 'moderada',
    effects: [],
    duration: 2,
    stackingRules: { canStack: true, maxStacks: 3, stackBehavior: 'extend' }
  };

  const existing: ActiveCondition[] = [{
    conditionId: 'test',
    appliedAtTurn: 1,
    remainingDuration: 2,
    stacks: 1,
    severity: 'moderada'
  }];

  const result = applyCondition(existing, condition, 2);

  assert.equal(result[0].stacks, 2);
  assert.equal(result[0].remainingDuration, 4); // 2 + 2 = estendida
});

test('applyCondition: respeita máximo de pilhas', () => {
  const condition: Condition = {
    id: 'test',
    type: 'envenenado',
    name: 'Test',
    description: 'Test',
    severity: 'leve',
    effects: [],
    duration: 3,
    stackingRules: { canStack: true, maxStacks: 3 }
  };

  const existing: ActiveCondition[] = [{
    conditionId: 'test',
    appliedAtTurn: 1,
    remainingDuration: 2,
    stacks: 3,
    severity: 'leve'
  }];

  const result = applyCondition(existing, condition, 2);

  assert.equal(result[0].stacks, 3); // Não excede máximo
});

// ========== REMOÇÃO DE CONDIÇÕES ==========

test('removeCondition: remove condição específica', () => {
  const conditions: ActiveCondition[] = [
    { conditionId: 'poison', appliedAtTurn: 1, remainingDuration: 2, stacks: 1, severity: 'leve' },
    { conditionId: 'stun', appliedAtTurn: 1, remainingDuration: 1, stacks: 1, severity: 'severa' }
  ];

  const result = removeCondition(conditions, 'poison');

  assert.equal(result.length, 1);
  assert.equal(result[0].conditionId, 'stun');
});

test('reduceConditionStack: reduz pilha e mantém condição se pilhas > 0', () => {
  const conditions: ActiveCondition[] = [{
    conditionId: 'test',
    appliedAtTurn: 1,
    remainingDuration: 3,
    stacks: 3,
    severity: 'moderada'
  }];

  const result = reduceConditionStack(conditions, 'test');

  assert.equal(result.length, 1);
  assert.equal(result[0].stacks, 2);
});

test('reduceConditionStack: remove condição se pilhas chegam a 0', () => {
  const conditions: ActiveCondition[] = [{
    conditionId: 'test',
    appliedAtTurn: 1,
    remainingDuration: 3,
    stacks: 1,
    severity: 'leve'
  }];

  const result = reduceConditionStack(conditions, 'test');

  assert.equal(result.length, 0);
});

// ========== FIM DE TURNO ==========

test('processEndOfTurn: reduz duração e remove expiradas', () => {
  const conditions: ActiveCondition[] = [
    { conditionId: 'poison', appliedAtTurn: 1, remainingDuration: 2, stacks: 1, severity: 'leve' },
    { conditionId: 'stun', appliedAtTurn: 1, remainingDuration: 1, stacks: 1, severity: 'severa' },
    { conditionId: 'buff', appliedAtTurn: 1, remainingDuration: -1, stacks: 1, severity: 'leve' } // Permanente
  ];

  const result = processEndOfTurn(conditions);

  assert.equal(result.length, 2); // Stun foi removida (chegou a 0)
  assert.equal(result[0].conditionId, 'poison');
  assert.equal(result[0].remainingDuration, 1);
  assert.equal(result[1].conditionId, 'buff');
  assert.equal(result[1].remainingDuration, -1); // Permanente não muda
});

// ========== CÁLCULO DE MODIFICADORES ==========

test('calculateConditionModifiers: soma modificadores de atributos', () => {
  const conditionMap = new Map<string, Condition>([
    ['buff1', {
      id: 'buff1',
      type: 'protegido',
      name: 'Buff 1',
      description: 'Test',
      severity: 'leve',
      effects: [{ type: 'attribute_mod', attributeMods: { FOR: 2, AGI: 1 }, description: 'Test' }],
      duration: 3,
      stackingRules: { canStack: false }
    }],
    ['debuff1', {
      id: 'debuff1',
      type: 'amedrontado',
      name: 'Debuff 1',
      description: 'Test',
      severity: 'moderada',
      effects: [{ type: 'attribute_mod', attributeMods: { FOR: -1 }, description: 'Test' }],
      duration: 2,
      stackingRules: { canStack: false }
    }]
  ]);

  const activeConditions: ActiveCondition[] = [
    { conditionId: 'buff1', appliedAtTurn: 1, remainingDuration: 2, stacks: 1, severity: 'leve' },
    { conditionId: 'debuff1', appliedAtTurn: 1, remainingDuration: 1, stacks: 1, severity: 'moderada' }
  ];

  const result = calculateConditionModifiers(activeConditions, conditionMap);

  assert.equal(result.attributeMods.FOR, 1); // +2 -1
  assert.equal(result.attributeMods.AGI, 1);
});

test('calculateConditionModifiers: aplica restrições de ação', () => {
  const conditionMap = new Map<string, Condition>([
    ['stun', {
      id: 'stun',
      type: 'atordoado',
      name: 'Stun',
      description: 'Test',
      severity: 'severa',
      effects: [{
        type: 'action_restriction',
        cannotAttack: true,
        cannotCast: true,
        description: 'Test'
      }],
      duration: 1,
      stackingRules: { canStack: false }
    }]
  ]);

  const activeConditions: ActiveCondition[] = [
    { conditionId: 'stun', appliedAtTurn: 1, remainingDuration: 1, stacks: 1, severity: 'severa' }
  ];

  const result = calculateConditionModifiers(activeConditions, conditionMap);

  assert.equal(result.restrictions.cannotAttack, true);
  assert.equal(result.restrictions.cannotCast, true);
});

test('calculateConditionModifiers: multiplica movimento', () => {
  const conditionMap = new Map<string, Condition>([
    ['immobile', {
      id: 'immobile',
      type: 'imobilizado',
      name: 'Immobile',
      description: 'Test',
      severity: 'moderada',
      effects: [{ type: 'movement_mod', movementMultiplier: 0, description: 'Test' }],
      duration: 2,
      stackingRules: { canStack: false }
    }]
  ]);

  const activeConditions: ActiveCondition[] = [
    { conditionId: 'immobile', appliedAtTurn: 1, remainingDuration: 2, stacks: 1, severity: 'moderada' }
  ];

  const result = calculateConditionModifiers(activeConditions, conditionMap);

  assert.equal(result.movementMultiplier, 0);
});

// ========== DANO AO LONGO DO TEMPO ==========

test('calculateDamageOverTime: soma dano de múltiplas condições', () => {
  const conditionMap = new Map<string, Condition>([
    ['poison', {
      id: 'poison',
      type: 'envenenado',
      name: 'Poison',
      description: 'Test',
      severity: 'moderada',
      effects: [{
        type: 'damage_over_time',
        damagePerTurn: 2,
        damageType: 'verdadeiro',
        description: 'Test'
      }],
      duration: 3,
      stackingRules: { canStack: true, maxStacks: 5 }
    }],
    ['burn', {
      id: 'burn',
      type: 'queimando',
      name: 'Burn',
      description: 'Test',
      severity: 'severa',
      effects: [{
        type: 'damage_over_time',
        damagePerTurn: 3,
        damageType: 'magico',
        description: 'Test'
      }],
      duration: 2,
      stackingRules: { canStack: true, maxStacks: 3 }
    }]
  ]);

  const activeConditions: ActiveCondition[] = [
    { conditionId: 'poison', appliedAtTurn: 1, remainingDuration: 2, stacks: 2, severity: 'moderada' },
    { conditionId: 'burn', appliedAtTurn: 1, remainingDuration: 1, stacks: 1, severity: 'severa' }
  ];

  const result = calculateDamageOverTime(activeConditions, conditionMap);

  assert.equal(result.total, 7); // (2 * 2) + (3 * 1)
  assert.equal(result.byType.get('verdadeiro'), 4);
  assert.equal(result.byType.get('magico'), 3);
});

// ========== CONDIÇÕES PRÉ-DEFINIDAS ==========

test('createConditionMap: cria mapa com condições pré-definidas', () => {
  const map = createConditionMap();

  assert.ok(map.has('envenenado'));
  assert.ok(map.has('atordoado'));
  assert.ok(map.has('imobilizado'));
  assert.ok(map.has('protegido'));
  assert.ok(map.has('amedrontado'));
  assert.ok(map.has('queimando'));
});
