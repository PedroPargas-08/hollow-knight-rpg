// =====================================================================
// FASE 3 — SISTEMA DE CONDIÇÕES DE STATUS
// Condições que afetam personagens (envenenado, atordoado, etc.)
// =====================================================================

import type { Attribute } from './rules';

/** Tipo de condição */
export type ConditionType =
  | 'envenenado'
  | 'atordoado'
  | 'imobilizado'
  | 'protegido'
  | 'oculto'
  | 'amedrontado'
  | 'cego'
  | 'surdo'
  | 'silenciado'
  | 'queimando'
  | 'congelado'
  | 'invisivel'
  | 'voando'
  | 'caido'
  | 'concentrando';

/** Severidade da condição (para empilhamento) */
export type ConditionSeverity = 'leve' | 'moderada' | 'severa' | 'critica';

/** Efeito de uma condição */
export interface ConditionEffect {
  type: 'attribute_mod' | 'damage_over_time' | 'movement_mod' | 'action_restriction' | 'special';

  // Para modificadores de atributo
  attributeMods?: Partial<Record<Attribute, number>>;

  // Para dano ao longo do tempo
  damagePerTurn?: number;
  damageType?: 'fisico' | 'magico' | 'verdadeiro';

  // Para modificadores de movimento
  movementMultiplier?: number; // 0 = imóvel, 0.5 = metade, 2 = dobro

  // Para restrições de ação
  cannotAttack?: boolean;
  cannotCast?: boolean;
  cannotMove?: boolean;
  cannotReact?: boolean;

  // Descrição do efeito
  description: string;
}

/** Regras de empilhamento */
export interface StackingRules {
  canStack: boolean;              // Pode empilhar múltiplas instâncias?
  maxStacks?: number;             // Máximo de pilhas
  stackBehavior?: 'refresh' | 'extend' | 'intensify';
  // refresh: renova a duração
  // extend: adiciona à duração existente
  // intensify: aumenta a severidade
}

/** Definição de uma condição */
export interface Condition {
  id: string;
  type: ConditionType;
  name: string;
  description: string;

  severity: ConditionSeverity;

  effects: ConditionEffect[];

  duration: number;               // Turnos (-1 = permanente até remover)

  stackingRules: StackingRules;

  // Condições de remoção
  endsOnDamage?: boolean;         // Remove ao receber dano
  savingThrow?: {                 // Teste para remover no início do turno
    attribute: Attribute;
    dc: number;
  };

  // Visual
  icon?: string;
  color?: string;
}

/** Instância de uma condição afetando um personagem */
export interface ActiveCondition {
  conditionId: string;
  appliedBy?: string;             // ID de quem aplicou
  appliedAtTurn: number;          // Turno em que foi aplicada
  remainingDuration: number;      // Turnos restantes
  stacks: number;                 // Número de pilhas
  severity: ConditionSeverity;    // Pode mudar com empilhamento
}

// ========== FUNÇÕES DE GESTÃO DE CONDIÇÕES ==========

/**
 * Aplica uma condição a um personagem
 */
export function applyCondition(
  activeConditions: ActiveCondition[],
  condition: Condition,
  currentTurn: number
): ActiveCondition[] {
  const existing = activeConditions.find(c => c.conditionId === condition.id);

  if (!existing) {
    // Nova condição
    return [
      ...activeConditions,
      {
        conditionId: condition.id,
        appliedAtTurn: currentTurn,
        remainingDuration: condition.duration,
        stacks: 1,
        severity: condition.severity
      }
    ];
  }

  // Condição já existe
  const { canStack, maxStacks = 1, stackBehavior = 'refresh' } = condition.stackingRules;

  if (!canStack) {
    // Não empilha - apenas renova
    return activeConditions.map(c =>
      c.conditionId === condition.id
        ? { ...c, remainingDuration: condition.duration }
        : c
    );
  }

  // Empilhamento permitido
  return activeConditions.map(c => {
    if (c.conditionId !== condition.id) return c;

    const newStacks = Math.min(c.stacks + 1, maxStacks);

    switch (stackBehavior) {
      case 'refresh':
        return { ...c, remainingDuration: condition.duration, stacks: newStacks };

      case 'extend':
        return { ...c, remainingDuration: c.remainingDuration + condition.duration, stacks: newStacks };

      case 'intensify':
        return {
          ...c,
          stacks: newStacks,
          severity: intensifySeverity(c.severity, newStacks)
        };

      default:
        return c;
    }
  });
}

/**
 * Remove uma condição específica
 */
export function removeCondition(
  activeConditions: ActiveCondition[],
  conditionId: string
): ActiveCondition[] {
  return activeConditions.filter(c => c.conditionId !== conditionId);
}

/**
 * Reduz uma pilha de uma condição
 */
export function reduceConditionStack(
  activeConditions: ActiveCondition[],
  conditionId: string
): ActiveCondition[] {
  return activeConditions
    .map(c => {
      if (c.conditionId !== conditionId) return c;
      return { ...c, stacks: c.stacks - 1 };
    })
    .filter(c => c.stacks > 0);
}

/**
 * Processa o fim de turno para condições (reduz duração)
 */
export function processEndOfTurn(
  activeConditions: ActiveCondition[]
): ActiveCondition[] {
  return activeConditions
    .map(c => ({
      ...c,
      remainingDuration: c.remainingDuration > 0 ? c.remainingDuration - 1 : c.remainingDuration
    }))
    .filter(c => c.remainingDuration !== 0); // Remove condições expiradas (mas mantém -1 = permanente)
}

/**
 * Intensifica a severidade baseado no número de pilhas
 */
function intensifySeverity(current: ConditionSeverity, stacks: number): ConditionSeverity {
  if (stacks >= 4) return 'critica';
  if (stacks >= 3) return 'severa';
  if (stacks >= 2) return 'moderada';
  return 'leve';
}

/**
 * Calcula os modificadores totais de todas as condições ativas
 */
export function calculateConditionModifiers(
  activeConditions: ActiveCondition[],
  conditionDefinitions: Map<string, Condition>
): {
  attributeMods: Partial<Record<Attribute, number>>;
  movementMultiplier: number;
  restrictions: {
    cannotAttack: boolean;
    cannotCast: boolean;
    cannotMove: boolean;
    cannotReact: boolean;
  };
} {
  const attributeMods: Partial<Record<Attribute, number>> = {};
  let movementMultiplier = 1;
  const restrictions = {
    cannotAttack: false,
    cannotCast: false,
    cannotMove: false,
    cannotReact: false
  };

  for (const active of activeConditions) {
    const condition = conditionDefinitions.get(active.conditionId);
    if (!condition) continue;

    for (const effect of condition.effects) {
      // Modificadores de atributo
      if (effect.attributeMods) {
        for (const [attr, mod] of Object.entries(effect.attributeMods)) {
          const key = attr as Attribute;
          attributeMods[key] = (attributeMods[key] || 0) + mod * active.stacks;
        }
      }

      // Modificador de movimento
      if (effect.movementMultiplier !== undefined) {
        movementMultiplier *= effect.movementMultiplier;
      }

      // Restrições
      if (effect.cannotAttack) restrictions.cannotAttack = true;
      if (effect.cannotCast) restrictions.cannotCast = true;
      if (effect.cannotMove) restrictions.cannotMove = true;
      if (effect.cannotReact) restrictions.cannotReact = true;
    }
  }

  return { attributeMods, movementMultiplier, restrictions };
}

/**
 * Calcula dano ao longo do tempo de todas as condições
 */
export function calculateDamageOverTime(
  activeConditions: ActiveCondition[],
  conditionDefinitions: Map<string, Condition>
): { total: number; byType: Map<string, number> } {
  let total = 0;
  const byType = new Map<string, number>();

  for (const active of activeConditions) {
    const condition = conditionDefinitions.get(active.conditionId);
    if (!condition) continue;

    for (const effect of condition.effects) {
      if (effect.type === 'damage_over_time' && effect.damagePerTurn) {
        const damage = effect.damagePerTurn * active.stacks;
        total += damage;

        const type = effect.damageType || 'verdadeiro';
        byType.set(type, (byType.get(type) || 0) + damage);
      }
    }
  }

  return { total, byType };
}

// ========== CONDIÇÕES PRÉ-DEFINIDAS ==========

export const CONDITION_DEFINITIONS: Condition[] = [
  {
    id: 'envenenado',
    type: 'envenenado',
    name: 'Envenenado',
    description: 'Sofre dano ao longo do tempo devido a veneno.',
    severity: 'moderada',
    effects: [{
      type: 'damage_over_time',
      damagePerTurn: 2,
      damageType: 'verdadeiro',
      description: '2 de dano por turno'
    }],
    duration: 3,
    stackingRules: { canStack: true, maxStacks: 5, stackBehavior: 'intensify' },
    savingThrow: { attribute: 'VIG', dc: 12 }
  },
  {
    id: 'atordoado',
    type: 'atordoado',
    name: 'Atordoado',
    description: 'Não pode realizar ações.',
    severity: 'severa',
    effects: [{
      type: 'action_restriction',
      cannotAttack: true,
      cannotCast: true,
      cannotMove: true,
      description: 'Não pode agir'
    }],
    duration: 1,
    stackingRules: { canStack: false },
    endsOnDamage: true
  },
  {
    id: 'imobilizado',
    type: 'imobilizado',
    name: 'Imobilizado',
    description: 'Não pode se mover.',
    severity: 'moderada',
    effects: [{
      type: 'movement_mod',
      movementMultiplier: 0,
      description: 'Movimento reduzido a 0'
    }],
    duration: 2,
    stackingRules: { canStack: false },
    savingThrow: { attribute: 'FOR', dc: 13 }
  },
  {
    id: 'protegido',
    type: 'protegido',
    name: 'Protegido',
    description: 'Recebe bônus de defesa.',
    severity: 'leve',
    effects: [{
      type: 'attribute_mod',
      attributeMods: { AGI: 2 },
      description: '+2 AGI (defesa)'
    }],
    duration: 3,
    stackingRules: { canStack: true, maxStacks: 3, stackBehavior: 'refresh' },
    color: '#4a9eff'
  },
  {
    id: 'amedrontado',
    type: 'amedrontado',
    name: 'Amedrontado',
    description: 'Reduz capacidade ofensiva.',
    severity: 'moderada',
    effects: [{
      type: 'attribute_mod',
      attributeMods: { FOR: -2, PRE: -2 },
      description: '-2 FOR e PRE'
    }],
    duration: 2,
    stackingRules: { canStack: false },
    savingThrow: { attribute: 'PRE', dc: 14 }
  },
  {
    id: 'queimando',
    type: 'queimando',
    name: 'Queimando',
    description: 'Sofre dano de fogo contínuo.',
    severity: 'severa',
    effects: [{
      type: 'damage_over_time',
      damagePerTurn: 3,
      damageType: 'magico',
      description: '3 de dano de fogo por turno'
    }],
    duration: 2,
    stackingRules: { canStack: true, maxStacks: 3, stackBehavior: 'extend' }
  }
];

/**
 * Cria um mapa de condições para busca rápida
 */
export function createConditionMap(): Map<string, Condition> {
  return new Map(CONDITION_DEFINITIONS.map(c => [c.id, c]));
}
