// =====================================================================
// FASE 3 — MOTOR DE REGRAS DO RPG
// Sistema de atributos, cálculos, rolagens, combate e mecânicas base
// =====================================================================

/** Atributos base do sistema (nomes oficiais da Fase 3) */
export const ATTRIBUTES = ['AGI', 'FOR', 'INT', 'PRE', 'VIG'] as const;
export type Attribute = typeof ATTRIBUTES[number];

/** Tipos de dados disponíveis */
export const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100] as const;
export type DiceType = typeof DICE_TYPES[number];

/** Dificuldades para testes */
export type Difficulty = 'trivial' | 'facil' | 'moderada' | 'dificil' | 'heroica' | 'impossivel';

/** Mapeamento de dificuldade para valor numérico */
export const DIFFICULTY_DC: Record<Difficulty, number> = {
  trivial: 5,
  facil: 10,
  moderada: 15,
  dificil: 20,
  heroica: 25,
  impossivel: 30,
};

// ========== CÁLCULO DE MODIFICADORES ==========

/**
 * Calcula o modificador de um atributo baseado em seu valor.
 * Regra: (valor - 10) / 2, arredondado para baixo
 */
export function getModifier(attributeValue: number): number {
  return Math.floor((attributeValue - 10) / 2);
}

/**
 * Calcula o modificador efetivo considerando valor base + bônus temporários
 */
export function getEffectiveModifier(base: number, bonus: number = 0): number {
  return getModifier(base + bonus);
}

// ========== CÁLCULOS DERIVADOS ==========

/**
 * Calcula PV máximo baseado em VIG e estágio
 * Fórmula: 10 + (VIG × estágio) + modificador de VIG
 */
export function calculateMaxPV(vigor: number, stage: number): number {
  const mod = getModifier(vigor);
  return 10 + (vigor * stage) + mod;
}

/**
 * Calcula ALMA máxima baseada em INT e estágio
 * Fórmula: 5 + (INT × estágio / 2) + modificador de INT
 */
export function calculateMaxAlma(intelecto: number, stage: number): number {
  const mod = getModifier(intelecto);
  return Math.floor(5 + (intelecto * stage / 2) + mod);
}

/**
 * Calcula Defesa baseada em AGI
 * Fórmula: 10 + modificador de AGI
 */
export function calculateDefense(agilidade: number): number {
  return 10 + getModifier(agilidade);
}

/**
 * Calcula Iniciativa baseada em AGI
 * Fórmula: modificador de AGI
 */
export function calculateInitiative(agilidade: number): number {
  return getModifier(agilidade);
}

// ========== SISTEMA DE ROLAGEM ==========

/**
 * Rola um dado de N lados
 */
export function rollDice(sides: DiceType): number {
  return Math.floor(Math.random() * sides) + 1;
}

/**
 * Rola múltiplos dados e retorna array de resultados individuais
 */
export function rollMultipleDice(quantity: number, sides: DiceType): number[] {
  return Array.from({ length: quantity }, () => rollDice(sides));
}

/**
 * Rola dados e retorna a soma total
 */
export function rollDiceSum(quantity: number, sides: DiceType): number {
  return rollMultipleDice(quantity, sides).reduce((sum, roll) => sum + roll, 0);
}

/**
 * Resultado de um teste de atributo
 */
export interface AttributeTestResult {
  roll: number;
  modifier: number;
  total: number;
  dc: number;
  success: boolean;
  criticalSuccess: boolean;
  criticalFailure: boolean;
}

/**
 * Realiza um teste de atributo (d20 + modificador vs DC)
 */
export function rollAttributeTest(
  attributeValue: number,
  dc: number,
  bonus: number = 0
): AttributeTestResult {
  const roll = rollDice(20);
  const modifier = getModifier(attributeValue) + bonus;
  const total = roll + modifier;
  const success = total >= dc;
  const criticalSuccess = roll === 20;
  const criticalFailure = roll === 1;

  return {
    roll,
    modifier,
    total,
    dc,
    success: criticalSuccess || (success && !criticalFailure),
    criticalSuccess,
    criticalFailure,
  };
}

/**
 * Realiza um teste de atributo usando uma dificuldade nomeada
 */
export function rollAttributeTestByDifficulty(
  attributeValue: number,
  difficulty: Difficulty,
  bonus: number = 0
): AttributeTestResult {
  return rollAttributeTest(attributeValue, DIFFICULTY_DC[difficulty], bonus);
}

// ========== SISTEMA DE DANO ==========

/**
 * Representação de dano (ex: 2d6+3)
 */
export interface DamageRoll {
  quantity: number;
  sides: DiceType;
  bonus: number;
}

/**
 * Resultado de uma rolagem de dano
 */
export interface DamageResult {
  rolls: number[];
  bonus: number;
  total: number;
}

/**
 * Rola dano e retorna o resultado detalhado
 */
export function rollDamage(damage: DamageRoll): DamageResult {
  const rolls = rollMultipleDice(damage.quantity, damage.sides);
  const total = rolls.reduce((sum, r) => sum + r, 0) + damage.bonus;

  return {
    rolls,
    bonus: damage.bonus,
    total: Math.max(0, total), // Dano nunca é negativo
  };
}

/**
 * Aplica resistência, vulnerabilidade ou imunidade ao dano
 */
export function applyDamageModifiers(
  baseDamage: number,
  resistant: boolean = false,
  vulnerable: boolean = false,
  immune: boolean = false
): number {
  if (immune) return 0;
  if (resistant) return Math.floor(baseDamage / 2);
  if (vulnerable) return Math.floor(baseDamage * 1.5);
  return baseDamage;
}

// ========== VALIDAÇÕES ==========

/**
 * Valida se um valor de atributo está dentro do range permitido
 */
export function isValidAttributeValue(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 30;
}

/**
 * Valida se um estágio está dentro do range permitido
 */
export function isValidStage(stage: number): boolean {
  return Number.isInteger(stage) && stage >= 1 && stage <= 20;
}

/**
 * Clamp um número dentro de um range
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Valida e normaliza um valor de atributo
 */
export function normalizeAttributeValue(value: unknown): number {
  // Trata null, undefined e NaN explicitamente como default
  if (value == null) return 10; // == null captura null e undefined
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return 10; // Default para NaN e Infinity
  return clamp(Math.floor(n), 1, 30);
}
