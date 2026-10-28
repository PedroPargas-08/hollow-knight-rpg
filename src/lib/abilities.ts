// =====================================================================
// FASE 3 — SISTEMA DE HABILIDADES
// Habilidades ativas, passivas, custos, alcances, alvos e efeitos
// =====================================================================

import type { Attribute, DiceType } from './rules';

/** Tipo de habilidade */
export type AbilityType = 'ativa' | 'passiva' | 'reacao';

/** Tipo de alvo da habilidade */
export type TargetType = 'self' | 'single' | 'area' | 'cone' | 'line' | 'all_allies' | 'all_enemies';

/** Tipo de dano ou efeito */
export type DamageType = 'fisico' | 'magico' | 'mental' | 'verdadeiro';

/** Tipo de efeito de habilidade */
export type EffectType =
  | 'dano'           // Causa dano direto
  | 'cura'           // Restaura PV
  | 'buff'           // Aumenta atributos/status
  | 'debuff'         // Reduz atributos/status
  | 'condicao'       // Aplica uma condição de status
  | 'movimento'      // Movimentação especial
  | 'utilidade';     // Outros efeitos (teleporte, invisibilidade, etc.)

/** Requisitos para usar uma habilidade */
export interface AbilityRequirements {
  minStage?: number;              // Estágio mínimo necessário
  attributes?: Partial<Record<Attribute, number>>;  // Atributos mínimos
  abilities?: string[];           // IDs de habilidades pré-requisito
}

/** Custo para usar uma habilidade */
export interface AbilityCost {
  alma?: number;                  // Custo em ALMA
  pv?: number;                    // Custo em PV (habilidades de sangue)
  cooldown?: number;              // Turnos de recarga após uso
  usesPerRest?: number;          // Usos limitados por descanso
}

/** Alcance da habilidade */
export interface AbilityRange {
  min: number;                    // Alcance mínimo em metros/células
  max: number;                    // Alcance máximo em metros/células
}

/** Área de efeito */
export interface AreaOfEffect {
  shape: 'circle' | 'cone' | 'line' | 'square';
  size: number;                   // Raio/comprimento/largura em metros
}

/** Rolagem de dano/cura */
export interface AbilityRoll {
  quantity: number;               // Quantidade de dados
  sides: DiceType;                // Tipo de dado
  bonus: number;                  // Bônus fixo
  scalesWith?: Attribute;         // Escala com modificador de atributo
}

/** Efeito de uma habilidade */
export interface AbilityEffect {
  type: EffectType;
  damageType?: DamageType;
  roll?: AbilityRoll;             // Para dano/cura
  attributeMod?: Partial<Record<Attribute, number>>;  // Para buff/debuff
  conditionId?: string;           // ID da condição a aplicar
  duration?: number;              // Duração em turnos (0 = instantâneo)
  description: string;
}

/** Definição completa de uma habilidade */
export interface Ability {
  id: string;                     // ID único
  name: string;                   // Nome da habilidade
  description: string;            // Descrição completa
  type: AbilityType;

  requirements?: AbilityRequirements;
  cost: AbilityCost;

  targetType: TargetType;
  range?: AbilityRange;           // Não usado para self
  areaOfEffect?: AreaOfEffect;    // Para habilidades de área

  effects: AbilityEffect[];

  // Metadados
  icon?: string;
  tags?: string[];                // Tags para filtros (ofensiva, defensiva, suporte, etc.)
}

/** Estado de uso de uma habilidade em combate */
export interface AbilityUsageState {
  abilityId: string;
  cooldownRemaining: number;      // Turnos restantes de cooldown
  usesRemaining?: number;         // Usos restantes (se usesPerRest está definido)
  lastUsedTurn?: number;          // Último turno em que foi usada
}

// ========== FUNÇÕES DE VALIDAÇÃO ==========

/**
 * Verifica se o personagem atende aos requisitos da habilidade
 */
export function meetsRequirements(
  ability: Ability,
  characterData: {
    stage: number;
    attributes: Record<Attribute, number>;
    knownAbilities: string[];
  }
): { valid: boolean; reason?: string } {
  const req = ability.requirements;
  if (!req) return { valid: true };

  // Verifica estágio mínimo
  if (req.minStage && characterData.stage < req.minStage) {
    return { valid: false, reason: `Requer estágio ${req.minStage}` };
  }

  // Verifica atributos mínimos
  if (req.attributes) {
    for (const [attr, minValue] of Object.entries(req.attributes)) {
      if (characterData.attributes[attr as Attribute] < minValue) {
        return { valid: false, reason: `Requer ${attr} ${minValue}` };
      }
    }
  }

  // Verifica habilidades pré-requisito
  if (req.abilities) {
    const missing = req.abilities.find(id => !characterData.knownAbilities.includes(id));
    if (missing) {
      return { valid: false, reason: `Requer habilidade pré-requisito` };
    }
  }

  return { valid: true };
}

/**
 * Verifica se o personagem pode pagar o custo da habilidade
 */
export function canPayCost(
  cost: AbilityCost,
  resources: { pv: number; alma: number },
  usageState?: AbilityUsageState
): { valid: boolean; reason?: string } {
  // Verifica cooldown
  if (usageState && usageState.cooldownRemaining > 0) {
    return { valid: false, reason: `Em recarga (${usageState.cooldownRemaining} turnos)` };
  }

  // Verifica usos restantes
  if (usageState && cost.usesPerRest !== undefined) {
    if (usageState.usesRemaining === 0) {
      return { valid: false, reason: 'Sem usos restantes' };
    }
  }

  // Verifica ALMA
  if (cost.alma && resources.alma < cost.alma) {
    return { valid: false, reason: `ALMA insuficiente (requer ${cost.alma})` };
  }

  // Verifica PV
  if (cost.pv && resources.pv <= cost.pv) {
    return { valid: false, reason: `PV insuficiente (requer ${cost.pv})` };
  }

  return { valid: true };
}

/**
 * Aplica o custo da habilidade aos recursos do personagem
 */
export function applyCost(
  cost: AbilityCost,
  resources: { pv: number; alma: number },
  usageState?: AbilityUsageState
): { newResources: { pv: number; alma: number }; newUsageState: AbilityUsageState } {
  const newResources = { ...resources };

  if (cost.alma) {
    newResources.alma = Math.max(0, newResources.alma - cost.alma);
  }

  if (cost.pv) {
    newResources.pv = Math.max(1, newResources.pv - cost.pv); // Nunca reduz a 0
  }

  const newUsageState: AbilityUsageState = usageState
    ? { ...usageState }
    : { abilityId: '', cooldownRemaining: 0 };

  if (cost.cooldown) {
    newUsageState.cooldownRemaining = cost.cooldown;
  }

  if (cost.usesPerRest !== undefined && newUsageState.usesRemaining !== undefined) {
    newUsageState.usesRemaining = Math.max(0, newUsageState.usesRemaining - 1);
  }

  return { newResources, newUsageState };
}

/**
 * Verifica se um alvo está dentro do alcance
 */
export function isInRange(distance: number, range?: AbilityRange): boolean {
  if (!range) return true; // Habilidades sem alcance (self) sempre válidas
  return distance >= range.min && distance <= range.max;
}

/**
 * Calcula o dano/cura base de uma rolagem de habilidade
 */
export function calculateAbilityRoll(
  roll: AbilityRoll,
  attributeModifier: number = 0
): number {
  // Implementação simplificada - em combate real usará rollDice
  const diceAverage = (roll.sides + 1) / 2; // Média exata de um dado
  const diceTotal = Math.round(roll.quantity * diceAverage); // Arredonda o total
  const scalingBonus = roll.scalesWith ? attributeModifier : 0;
  return diceTotal + roll.bonus + scalingBonus;
}

// ========== HABILIDADES EXEMPLO ==========

/** Cria uma habilidade de ataque básico */
export function createBasicAttack(): Ability {
  return {
    id: 'basic_attack',
    name: 'Ataque Básico',
    description: 'Um ataque simples com sua arma equipada.',
    type: 'ativa',
    cost: { alma: 0 },
    targetType: 'single',
    range: { min: 0, max: 1.5 },
    effects: [{
      type: 'dano',
      damageType: 'fisico',
      roll: { quantity: 1, sides: 6, bonus: 0, scalesWith: 'FOR' },
      duration: 0,
      description: '1d6 + FOR de dano físico'
    }],
    tags: ['ofensiva', 'fisica']
  };
}
