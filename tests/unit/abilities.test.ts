import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  meetsRequirements,
  canPayCost,
  applyCost,
  isInRange,
  calculateAbilityRoll,
  createBasicAttack,
  type Ability,
  type AbilityUsageState
} from '../../src/lib/abilities.ts';

// ========== REQUISITOS ==========

test('meetsRequirements: personagem atende todos os requisitos', () => {
  const ability: Ability = {
    id: 'test',
    name: 'Test',
    description: 'Test ability',
    type: 'ativa',
    cost: {},
    targetType: 'single',
    effects: [],
    requirements: {
      minStage: 2,
      attributes: { FOR: 12, AGI: 10 },
      abilities: ['basic_attack']
    }
  };

  const result = meetsRequirements(ability, {
    stage: 3,
    attributes: { AGI: 10, FOR: 14, INT: 10, PRE: 10, VIG: 10 },
    knownAbilities: ['basic_attack', 'dodge']
  });

  assert.equal(result.valid, true);
});

test('meetsRequirements: falha por estágio insuficiente', () => {
  const ability: Ability = {
    id: 'test',
    name: 'Test',
    description: 'Test',
    type: 'ativa',
    cost: {},
    targetType: 'single',
    effects: [],
    requirements: { minStage: 5 }
  };

  const result = meetsRequirements(ability, {
    stage: 3,
    attributes: { AGI: 10, FOR: 10, INT: 10, PRE: 10, VIG: 10 },
    knownAbilities: []
  });

  assert.equal(result.valid, false);
  assert.match(result.reason!, /estágio/i);
});

test('meetsRequirements: falha por atributo insuficiente', () => {
  const ability: Ability = {
    id: 'test',
    name: 'Test',
    description: 'Test',
    type: 'ativa',
    cost: {},
    targetType: 'single',
    effects: [],
    requirements: { attributes: { FOR: 15 } }
  };

  const result = meetsRequirements(ability, {
    stage: 1,
    attributes: { AGI: 10, FOR: 10, INT: 10, PRE: 10, VIG: 10 },
    knownAbilities: []
  });

  assert.equal(result.valid, false);
  assert.match(result.reason!, /FOR/);
});

// ========== CUSTOS ==========

test('canPayCost: pode pagar custo normal', () => {
  const result = canPayCost(
    { alma: 5, pv: 2 },
    { pv: 20, alma: 10 }
  );

  assert.equal(result.valid, true);
});

test('canPayCost: ALMA insuficiente', () => {
  const result = canPayCost(
    { alma: 10 },
    { pv: 20, alma: 5 }
  );

  assert.equal(result.valid, false);
  assert.match(result.reason!, /ALMA/i);
});

test('canPayCost: habilidade em cooldown', () => {
  const usageState: AbilityUsageState = {
    abilityId: 'test',
    cooldownRemaining: 2
  };

  const result = canPayCost({ alma: 5 }, { pv: 20, alma: 10 }, usageState);

  assert.equal(result.valid, false);
  assert.match(result.reason!, /recarga|cooldown/i);
});

test('canPayCost: sem usos restantes', () => {
  const usageState: AbilityUsageState = {
    abilityId: 'test',
    cooldownRemaining: 0,
    usesRemaining: 0
  };

  const result = canPayCost(
    { alma: 5, usesPerRest: 3 },
    { pv: 20, alma: 10 },
    usageState
  );

  assert.equal(result.valid, false);
  assert.match(result.reason!, /usos/i);
});

test('applyCost: consome recursos corretamente', () => {
  const { newResources, newUsageState } = applyCost(
    { alma: 5, pv: 3, cooldown: 2 },
    { pv: 20, alma: 10 }
  );

  assert.equal(newResources.alma, 5);
  assert.equal(newResources.pv, 17);
  assert.equal(newUsageState.cooldownRemaining, 2);
});

test('applyCost: nunca reduz PV a 0', () => {
  const { newResources } = applyCost(
    { pv: 5 },
    { pv: 3, alma: 10 }
  );

  assert.equal(newResources.pv, 1); // Mínimo de 1
});

// ========== ALCANCE ==========

test('isInRange: dentro do alcance', () => {
  assert.equal(isInRange(5, { min: 0, max: 10 }), true);
  assert.equal(isInRange(0, { min: 0, max: 5 }), true);
  assert.equal(isInRange(10, { min: 5, max: 10 }), true);
});

test('isInRange: fora do alcance', () => {
  assert.equal(isInRange(15, { min: 0, max: 10 }), false);
  assert.equal(isInRange(3, { min: 5, max: 10 }), false);
});

test('isInRange: sem alcance definido (self) sempre válido', () => {
  assert.equal(isInRange(100, undefined), true);
});

// ========== ROLAGENS ==========

test('calculateAbilityRoll: calcula média dos dados + bônus', () => {
  const roll = { quantity: 2, sides: 6 as const, bonus: 3, scalesWith: undefined };
  const result = calculateAbilityRoll(roll);

  // Média de 2d6 = 2 * 3.5 = 7, + 3 = 10
  assert.equal(result, 10);
});

test('calculateAbilityRoll: escala com atributo', () => {
  const roll = { quantity: 1, sides: 8 as const, bonus: 2, scalesWith: 'FOR' as const };
  const result = calculateAbilityRoll(roll, 3); // +3 modificador de FOR

  // Média de 1d8 = 4.5 arredondado = 5, + 2 + 3 = 10
  assert.equal(result, 10);
});

// ========== HABILIDADES PRÉ-DEFINIDAS ==========

test('createBasicAttack: cria ataque básico válido', () => {
  const ability = createBasicAttack();

  assert.equal(ability.id, 'basic_attack');
  assert.equal(ability.type, 'ativa');
  assert.equal(ability.cost.alma, 0);
  assert.equal(ability.targetType, 'single');
  assert.ok(ability.range);
  assert.equal(ability.effects.length, 1);
  assert.equal(ability.effects[0].type, 'dano');
});
