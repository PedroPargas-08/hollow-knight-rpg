// =====================================================================
// FASE 4 — COMPATIBILIDADE DE FICHAS LEGADAS
// Adapter entre atributos legados (6 attrs PT) e Fase 3 (5 attrs EN)
// =====================================================================

import type { Sheet, Attribute } from './sheet';
import type { CharacterAttributes } from './api';
import { ATTRIBUTES, type Attribute as RuleAttribute } from './rules';

/** Atributos legados (nomes em PT no JSONB) */
export const LEGACY_ATTRIBUTES = [
  'Agilidade', 'Intelecto', 'Vigor', 'Percepção', 'Presença', 'Vontade'
] as const;
export type LegacyAttribute = typeof LEGACY_ATTRIBUTES[number];

/** Mapeamento legado → Fase 3 */
export interface LegacyMapping {
  /** Chave: atributo legado, Valor: atributo Fase 3 */
  mapping: Record<LegacyAttribute, Attribute>;
  /** Regras de merge para atributos Fase 3 que recebem múltiplos legados */
  mergeRules: Record<Attribute, 'max' | 'avg' | 'direct' | 'sum'>;
}

/** Tipo auxiliar para chaves de CharacterAttributes (lowercase) */
type AttrKey = keyof CharacterAttributes;
const ATTR_KEYS: Record<Attribute, AttrKey> = {
  AGI: 'agi',
  FOR: 'for',
  INT: 'int',
  PRE: 'pre',
  VIG: 'vig',
};

/** Mapeamento padrão sugerido */
export const DEFAULT_LEGACY_MAPPING: LegacyMapping = {
  mapping: {
    Agilidade: 'AGI',
    Intelecto: 'INT',
    Vigor: 'VIG',
    Percepção: 'PRE',
    Presença: 'PRE',
    Vontade: 'FOR',
  },
  mergeRules: {
    AGI: 'direct',
    FOR: 'direct',
    INT: 'direct',
    PRE: 'max',   // Percepção + Presença → PRE (usa o maior)
    VIG: 'direct',
  },
};

/**
 * Converte atributos legados do JSONB para o formato Fase 3
 * Retorna objeto parcial para upsert em character_attributes
 * NÃO preenche valores ausentes com defaults — retorna undefined para decidir depois
 */
export function legacyAttributesToPhase3(
  sheet: Sheet,
  mapping: LegacyMapping = DEFAULT_LEGACY_MAPPING
): Partial<CharacterAttributes> {
  const legacy = sheet.attributes as unknown as Record<LegacyAttribute, number | undefined>;
  const result: Partial<CharacterAttributes> = {};
  const groups: Record<Attribute, number[]> = {
    AGI: [], FOR: [], INT: [], PRE: [], VIG: [],
  };

  // Agrupa valores legados por atributo Fase 3 destino
  for (const [legacyAttr, phase3Attr] of Object.entries(mapping.mapping)) {
    const value = legacy[legacyAttr as LegacyAttribute];
    if (value !== undefined && value !== null) {
      groups[phase3Attr].push(value);
    }
  }

  // Aplica regras de merge
  for (const [attr, values] of Object.entries(groups)) {
    const key = attr as Attribute;
    const rule = mapping.mergeRules[key] ?? 'direct';
    const validValues = values.filter(v => v >= 1 && v <= 30);

    if (validValues.length === 0) {
      continue; // não preenche — deixa undefined para o mestre decidir
    }

    const dbKey = ATTR_KEYS[key];
    const mergedValue = (() => {
      switch (rule) {
        case 'max': return Math.max(...validValues);
        case 'avg': return Math.round(validValues.reduce((a, b) => a + b, 0) / validValues.length);
        case 'sum': return validValues.reduce((a, b) => a + b, 0);
        case 'direct':
        default: return validValues[0];
      }
    })();

    (result as Record<string, number>)[dbKey] = mergedValue;
  }

  // Calcula derivados se temos os attrs base necessários
  const stage = 1; // será sobrescrito pelo chamador com o stage real
  if (result.vig !== undefined) {
    result.pv_max = 10 + (result.vig * stage) + Math.floor((result.vig - 10) / 2);
  }
  if (result.int !== undefined) {
    result.alma_max = Math.floor(5 + (result.int * stage / 2) + Math.floor((result.int - 10) / 2));
  }
  if (result.agi !== undefined) {
    result.defense = 10 + Math.floor((result.agi - 10) / 2);
  }

  // Preserva PV/ALMA atuais do JSONB (clampados aos novos máximos)
  if (result.pv_max !== undefined) {
    result.pv_now = Math.min(sheet.pv.now, result.pv_max);
  }
  if (result.alma_max !== undefined) {
    result.alma_now = Math.min(sheet.alma.now, result.alma_max);
  }

  return result;
}

/**
 * Verifica se uma ficha tem atributos legados válidos
 */
export function hasLegacyAttributes(sheet: Sheet): boolean {
  const attrs = sheet.attributes as Record<string, unknown>;
  return LEGACY_ATTRIBUTES.some(attr =>
    attrs[attr] !== undefined && typeof attrs[attr] === 'number'
  );
}

/**
 * Retorna lista de conflitos/ambiguidades no mapeamento
 */
export function getMappingConflicts(mapping: LegacyMapping): string[] {
  const conflicts: string[] = [];
  const reverseMap: Record<Attribute, LegacyAttribute[]> = {
    AGI: [], FOR: [], INT: [], PRE: [], VIG: [],
  };

  for (const [legacy, phase3] of Object.entries(mapping.mapping)) {
    const p3 = phase3 as Attribute;
    reverseMap[p3].push(legacy as LegacyAttribute);
  }

  for (const phase3 of ATTRIBUTES) {
    const legacies = reverseMap[phase3];
    if (legacies.length > 1) {
      conflicts.push(
        `Atributo Fase 3 "${phase3}" recebe múltiplos legados: ${legacies.join(', ')}. ` +
        `Regra de merge: ${mapping.mergeRules[phase3]}.`
      );
    }
    if (legacies.length === 0) {
      conflicts.push(`Atributo Fase 3 "${phase3}" não recebe nenhum atributo legado.`);
    }
  }

  // Verifica legados não mapeados
  const mappedLegacies = new Set(Object.keys(mapping.mapping));
  for (const legacy of LEGACY_ATTRIBUTES) {
    if (!mappedLegacies.has(legacy)) {
      conflicts.push(`Atributo legado "${legacy}" não tem mapeamento definido.`);
    }
  }

  return conflicts;
}

/**
 * Gera sugestão de mapeamento baseada na ficha
 * Útil para pré-preencher a UI de migração assistida
 */
export function generateMappingSuggestion(sheet: Sheet): LegacyMappingSuggestion {
  const legacy = sheet.attributes as unknown as Record<LegacyAttribute, number | undefined>;
  const legacyAttrs: Record<string, number> = {};

  for (const attr of LEGACY_ATTRIBUTES) {
    if (legacy[attr] !== undefined && typeof legacy[attr] === 'number') {
      legacyAttrs[attr] = legacy[attr];
    }
  }

  return {
    source: 'sheet',
    legacy_attributes: legacyAttrs,
    mapping: { ...DEFAULT_LEGACY_MAPPING.mapping } as Record<string, string>,
    merge_rules: { ...DEFAULT_LEGACY_MAPPING.mergeRules } as Record<string, string>,
    suggested_at: new Date().toISOString(),
    suggested_by: null, // preenchido pelo backend
  };
}

export interface LegacyMappingSuggestion {
  source: string;
  legacy_attributes: Record<string, number>;
  mapping: Record<string, string>;
  merge_rules: Record<string, string>;
  suggested_at: string;
  suggested_by: string | null;
}