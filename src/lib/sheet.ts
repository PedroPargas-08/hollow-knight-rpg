// Forma da ficha (JSONB `characters.sheet`) e utilidades puras.
import { ATTRIBUTES, calculateDefense, calculateMaxAlma, calculateMaxPV, getModifier, normalizeAttributeValue, type Attribute } from './rules';

export { ATTRIBUTES };
export type { Attribute };

export interface Sheet {
  concept: string; archetype: string; origin: string;
  attributes: Record<Attribute, number>;
  attributeBonuses: Record<Attribute, number>; // Bônus temporários (equipamentos, condições, etc)
  pv: { now: number; max: number }; alma: { now: number; max: number }; defense: number;
  history: string; personality: string; notes: string;
  abilities: unknown[]; equipment: unknown[];
}

export const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.trunc(n))) : fallback;
};
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

export function defaultSheet(): Sheet {
  const baseAttributes = Object.fromEntries(ATTRIBUTES.map((a) => [a, 10])) as Record<Attribute, number>;
  const stage = 1;
  return {
    concept: '', archetype: '', origin: '',
    attributes: baseAttributes,
    attributeBonuses: Object.fromEntries(ATTRIBUTES.map((a) => [a, 0])) as Record<Attribute, number>,
    pv: { now: calculateMaxPV(10, stage), max: calculateMaxPV(10, stage) },
    alma: { now: calculateMaxAlma(10, stage), max: calculateMaxAlma(10, stage) },
    defense: calculateDefense(10),
    history: '', personality: '', notes: '', abilities: [], equipment: [],
  };
}

/** Aceita qualquer JSON vindo do banco e devolve uma ficha válida (campos ausentes ou inválidos viram padrão). */
export function normalizeSheet(raw: unknown): Sheet {
  const d = defaultSheet();
  const o = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, any>;
  const res = (x: any, fb: { now: number; max: number }) => {
    const max = clampInt(x?.max, 0, 999, fb.max);
    return { max, now: Math.min(max, clampInt(x?.now, 0, 999, fb.now)) };
  };
  return {
    concept: str(o.concept, 300), archetype: str(o.archetype, 80), origin: str(o.origin, 80),
    attributes: Object.fromEntries(ATTRIBUTES.map((a) => [a, normalizeAttributeValue(o.attributes?.[a])])) as Record<Attribute, number>,
    attributeBonuses: Object.fromEntries(ATTRIBUTES.map((a) => [a, clampInt(o.attributeBonuses?.[a], -10, 10, 0)])) as Record<Attribute, number>,
    pv: res(o.pv, d.pv), alma: res(o.alma, d.alma), defense: clampInt(o.defense, 0, 99, d.defense),
    history: str(o.history, 5000), personality: str(o.personality, 1000), notes: str(o.notes, 5000),
    abilities: Array.isArray(o.abilities) ? o.abilities.slice(0, 100) : [], equipment: Array.isArray(o.equipment) ? o.equipment.slice(0, 200) : [],
  };
}

// ========== CÁLCULOS DA FICHA ==========

/**
 * Retorna o valor efetivo de um atributo (base + bônus)
 */
export function getEffectiveAttribute(sheet: Sheet, attr: Attribute): number {
  return sheet.attributes[attr] + (sheet.attributeBonuses[attr] || 0);
}

/**
 * Retorna o modificador efetivo de um atributo
 */
export function getEffectiveModifier(sheet: Sheet, attr: Attribute): number {
  return getModifier(getEffectiveAttribute(sheet, attr));
}

/**
 * Recalcula PV, ALMA e defesa baseados nos atributos e estágio atual.
 * Útil para quando o mestre altera atributos ou estágio.
 */
export function recalculateDerivedStats(sheet: Sheet, stage: number): { pv: { max: number }; alma: { max: number }; defense: number } {
  const vig = getEffectiveAttribute(sheet, 'VIG');
  const int = getEffectiveAttribute(sheet, 'INT');
  const agi = getEffectiveAttribute(sheet, 'AGI');

  return {
    pv: { max: calculateMaxPV(vig, stage) },
    alma: { max: calculateMaxAlma(int, stage) },
    defense: calculateDefense(agi),
  };
}

/**
 * Aplica os valores recalculados mantendo PV/ALMA atual dentro dos novos máximos
 */
export function applyRecalculatedStats(sheet: Sheet, stage: number): Sheet {
  const derived = recalculateDerivedStats(sheet, stage);
  return {
    ...sheet,
    pv: { max: derived.pv.max, now: Math.min(sheet.pv.now, derived.pv.max) },
    alma: { max: derived.alma.max, now: Math.min(sheet.alma.now, derived.alma.max) },
    defense: derived.defense,
  };
}

/** Traduz erros do Supabase/rede em mensagens claras, sem vazar detalhes internos nem revelar se uma conta existe. */
export function friendlyError(err: unknown): string {
  const e = (err ?? {}) as { message?: string; code?: string; status?: number; name?: string };
  const msg = String(e.message ?? '');
  const low = msg.toLowerCase();
  if (e.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|network request failed|load failed/.test(low)) return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  if (/invalid login credentials/.test(low)) return 'E-mail ou senha incorretos.';
  if (/email not confirmed/.test(low)) return 'Confirme seu e-mail antes de entrar. Procure a mensagem de confirmação na sua caixa de entrada.';
  if (/rate limit|too many|429/.test(low) || e.status === 429) return 'Muitas tentativas em pouco tempo. Aguarde um instante e tente de novo.';
  if (/convite inv[aá]lido/.test(low)) return 'Convite inválido ou expirado.';
  if (/j[aá] participa/.test(low)) return 'Você já participa desta campanha.';
  if (/same password|different from the old/.test(low)) return 'Escolha uma senha diferente da atual.';   // antes de "weak": a mensagem real contém "password should"
  if (/weak|password should/.test(low)) return 'A senha é fraca demais. Use ao menos 8 caracteres, com letras e números.';
  if (/sess[aã]o|jwt|session|not authenticated|refresh token/.test(low)) return 'Sua sessão expirou. Entre novamente.';
  if (e.code === '42501' || e.code === 'PGRST301' || /row-level security|permission denied|permiss[aã]o negada/.test(low)) return 'Você não tem permissão para esta ação.';
  if (e.code === 'NOT_FOUND_OR_DENIED') return 'Registro não encontrado ou sem permissão de acesso.';
  if (e.code === '23505') return 'Esse registro já existe.';
  if (e.code === '23514' || e.code === '22001') return 'Algum valor está fora do permitido. Revise os campos.';
  return 'Algo deu errado. Tente novamente em instantes.';
}
