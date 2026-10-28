// Camada de dados: SOMENTE consultas ao Supabase. A autorização é do RLS no banco; nada aqui "decide" permissões.
import { supabase } from './supabase';
import { normalizeSheet, type Sheet } from './sheet';
import { ATTRIBUTES, calculateMaxPV, calculateMaxAlma, calculateDefense, type Attribute } from './rules';

// ========== TIPOS EXISTENTES ==========
export interface Campaign { id: string; name: string; description: string; status: 'preparacao' | 'andamento' | 'pausada' | 'encerrada'; owner_id: string; created_at: string }
export interface Member { id: string; user_id: string; member_role: 'jogador' | 'co_mestre'; display_name: string }
export interface Character { id: string; campaign_id: string; owner_id: string; name: string; stage: number; sheet: Sheet; updated_at: string }
export const STATUS_LABEL: Record<Campaign['status'], string> = { preparacao: 'Em preparação', andamento: 'Em andamento', pausada: 'Pausada', encerrada: 'Encerrada' };

// ========== TIPOS FASE 3 ==========
export interface CharacterAttributes {
  character_id: string;
  agi: number;
  for: number;
  int: number;
  pre: number;
  vig: number;
  agi_bonus: number;
  for_bonus: number;
  int_bonus: number;
  pre_bonus: number;
  vig_bonus: number;
  pv_now: number;
  pv_max: number;
  alma_now: number;
  alma_max: number;
  defense: number;
  updated_at: string;
}

export interface EquipmentDefinition {
  id: string;
  name: string;
  description: string;
  item_type: 'weapon' | 'armor' | 'accessory' | 'consumable';
  rarity: 'comum' | 'incomum' | 'raro' | 'epico' | 'lendario';
  value_geo: number;
  weight: number;
  slot: string | null;
  data: any; // JSONB
  is_official: boolean;
  created_at: string;
}

export interface CharacterEquipment {
  id: string;
  character_id: string;
  equipment_id: string;
  quantity: number;
  equipped_slot: string | null;
  instance_data: any; // JSONB
  created_at: string;
}

export interface AbilityDefinition {
  id: string;
  name: string;
  description: string;
  ability_type: 'ativa' | 'passiva' | 'reacao';
  requirements: any; // JSONB
  cost: any; // JSONB
  range: any; // JSONB
  target_type: string;
  aoe: any | null; // JSONB
  effects: any; // JSONB array
  is_official: boolean;
  created_at: string;
}

export interface CharacterAbility {
  id: string;
  character_id: string;
  ability_id: string;
  uses_remaining: number | null;
  cooldown_remaining: number;
  learned_at: string;
}

export interface ConditionDefinition {
  id: string;
  name: string;
  description: string;
  condition_type: string;
  effects: any; // JSONB array
  can_stack: boolean;
  max_stacks: number | null;
  stacking_behavior: 'refresh' | 'extend' | 'intensify' | null;
  is_official: boolean;
  created_at: string;
}

export interface CharacterCondition {
  id: string;
  character_id: string;
  condition_id: string;
  severity: 'leve' | 'moderada' | 'severa' | 'critica';
  stacks: number;
  duration_remaining: number;
  source_ability_id: string | null;
  applied_by: string | null;
  applied_at: string;
}

export interface CombatEncounter {
  id: string;
  campaign_id: string;
  name: string;
  description: string;
  status: 'preparing' | 'active' | 'paused' | 'ended';
  current_round: number;
  current_turn_order: number;
  started_at: string | null;
  ended_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CombatParticipant {
  id: string;
  encounter_id: string;
  character_id: string | null;
  npc_name: string | null;
  initiative: number;
  turn_order: number;
  team: 'ally' | 'enemy' | 'neutral';
  current_pv: number | null;
  current_alma: number | null;
  is_defeated: boolean;
  defeated_at: string | null;
  joined_at: string;
}

export interface CombatAction {
  id: string;
  encounter_id: string;
  round_number: number;
  participant_id: string;
  action_type: 'attack' | 'ability' | 'move' | 'item' | 'defend' | 'other';
  ability_id: string | null;
  item_id: string | null;
  target_ids: string[];
  roll_result: any | null; // JSONB
  damage_dealt: any | null; // JSONB
  description: string;
  created_at: string;
}

const ok = <T,>(r: { data: T | null; error: unknown }): T => { if (r.error) throw r.error; return r.data as T; };
const toChar = (r: any): Character => ({ ...r, sheet: normalizeSheet(r.sheet) });
const notFound = () => Object.assign(new Error('Registro não encontrado ou sem permissão'), { code: 'NOT_FOUND_OR_DENIED' });

export const listCampaigns = async (): Promise<Campaign[]> =>
  ok(await supabase.from('campaigns').select('id, name, description, status, owner_id, created_at').order('created_at', { ascending: false })) ?? [];
export const createCampaign = async (v: { name: string; description: string }): Promise<Campaign> =>
  ok(await supabase.from('campaigns').insert({ name: v.name.trim(), description: v.description.trim() }).select('id, name, description, status, owner_id, created_at').single());
export const deleteCampaign = async (id: string) => { const r = await supabase.from('campaigns').delete().eq('id', id).select('id'); const d = ok(r); if (!d?.length) throw notFound(); };

export async function listMembers(campaignId: string): Promise<Member[]> {
  const rows = ok(await supabase.from('campaign_members').select('id, user_id, member_role').eq('campaign_id', campaignId)) ?? [];
  if (!rows.length) return [];
  const profs = ok(await supabase.from('profiles').select('id, display_name').in('id', rows.map((r: any) => r.user_id))) ?? [];
  const names = new Map((profs as any[]).map((p) => [p.id, p.display_name]));
  return (rows as any[]).map((r) => ({ ...r, display_name: names.get(r.user_id) ?? 'Participante' }));
}
export const removeMember = async (id: string) => { const d = ok(await supabase.from('campaign_members').delete().eq('id', id).select('id')); if (!d?.length) throw notFound(); };
export const createInvite = async (campaignId: string, role: 'jogador' | 'co_mestre' = 'jogador', ttlHours = 72): Promise<string> =>
  ok(await supabase.rpc('create_campaign_invite', { p_campaign_id: campaignId, p_member_role: role, p_ttl_hours: ttlHours }));
export const redeemInvite = async (token: string): Promise<string> => ok(await supabase.rpc('redeem_campaign_invite', { p_token: token.trim() }));

export const listCharacters = async (): Promise<Character[]> =>
  ((ok(await supabase.from('characters').select('id, campaign_id, owner_id, name, stage, sheet, updated_at').order('updated_at', { ascending: false })) ?? []) as any[]).map(toChar);
export async function getCharacter(id: string): Promise<Character | null> {
  const r = ok(await supabase.from('characters').select('id, campaign_id, owner_id, name, stage, sheet, updated_at').eq('id', id).maybeSingle());
  return r ? toChar(r) : null;
}
export const createCharacter = async (v: { campaign_id: string; name: string; sheet: Sheet }): Promise<Character> => {
  // 1. Create the character
  const character = toChar(ok(await supabase.from('characters').insert({
    campaign_id: v.campaign_id,
    name: v.name.trim(),
    sheet: v.sheet
  }).select('id, campaign_id, owner_id, name, stage, sheet, updated_at').single()));

  // 2. Create character_attributes with initial values from sheet
  const baseVig = v.sheet.attributes.VIG;
  const baseInt = v.sheet.attributes.INT;
  const baseAgi = v.sheet.attributes.AGI;
  const stage = character.stage;

  const initialAttrs = {
    character_id: character.id,
    agi: baseAgi,
    "for": v.sheet.attributes.FOR,
    int: baseInt,
    pre: v.sheet.attributes.PRE,
    vig: baseVig,
    agi_bonus: 0,
    for_bonus: 0,
    int_bonus: 0,
    pre_bonus: 0,
    vig_bonus: 0,
    pv_now: v.sheet.pv.now,
    pv_max: calculateMaxPV(baseVig, stage),
    alma_now: v.sheet.alma.now,
    alma_max: calculateMaxAlma(baseInt, stage),
    defense: calculateDefense(baseAgi),
  };

  ok(await supabase.from('character_attributes').insert(initialAttrs).select('*').single());

  return character;
};
/** Só envia colunas atualizáveis (name, sheet e, para administradores, stage). Zero linhas = sem permissão (RLS). */
export async function updateCharacter(id: string, patch: { name?: string; sheet?: Sheet; stage?: number }): Promise<Character> {
  const r = ok(await supabase.from('characters').update(patch).eq('id', id).select('id, campaign_id, owner_id, name, stage, sheet, updated_at').maybeSingle());
  if (!r) throw notFound();
  const character = toChar(r);

  // If sheet was updated, sync character_attributes
  if (patch.sheet) {
    await syncCharacterAttributes(character.id, patch.sheet, character.stage);
  }
  // If stage was updated, recalculate derived stats
  else if (patch.stage !== undefined) {
    const attrs = await getCharacterAttributes(character.id);
    if (attrs) {
      await syncCharacterAttributes(character.id, character.sheet, patch.stage);
    }
  }

  return character;
}

/**
 * Sincroniza character_attributes com base na ficha e estágio
 */
async function syncCharacterAttributes(characterId: string, sheet: Sheet, stage: number): Promise<void> {
  const baseVig = sheet.attributes.VIG;
  const baseInt = sheet.attributes.INT;
  const baseAgi = sheet.attributes.AGI;
  const baseFor = sheet.attributes.FOR;
  const basePre = sheet.attributes.PRE;

  // Get existing attributes to preserve bonuses
  const existing = await getCharacterAttributes(characterId);
  const bonuses = existing ? {
    agi_bonus: existing.agi_bonus,
    for_bonus: existing.for_bonus,
    int_bonus: existing.int_bonus,
    pre_bonus: existing.pre_bonus,
    vig_bonus: existing.vig_bonus,
  } : { agi_bonus: 0, for_bonus: 0, int_bonus: 0, pre_bonus: 0, vig_bonus: 0 };

  const updateData: Partial<CharacterAttributes> = {
    agi: baseAgi,
    "for": baseFor,
    int: baseInt,
    pre: basePre,
    vig: baseVig,
    ...bonuses,
    pv_max: calculateMaxPV(baseVig, stage),
    alma_max: calculateMaxAlma(baseInt, stage),
    defense: calculateDefense(baseAgi),
  };

  // Preserve current resources but clamp to new max
  if (existing) {
    updateData.pv_now = Math.min(existing.pv_now, updateData.pv_max!);
    updateData.alma_now = Math.min(existing.alma_now, updateData.alma_max!);
  } else {
    updateData.pv_now = updateData.pv_max;
    updateData.alma_now = updateData.alma_max;
  }

  await supabase.from('character_attributes').upsert({
    character_id: characterId,
    ...updateData,
  }).select('*').single();
}
export const deleteCharacter = async (id: string) => { const d = ok(await supabase.from('characters').delete().eq('id', id).select('id')); if (!d?.length) throw notFound(); };

export async function updateDisplayName(id: string, name: string) {
  const d = ok(await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', id).select('id'));
  if (!d?.length) throw notFound();
}

// ========== FASE 3: ATRIBUTOS DO PERSONAGEM ==========

export async function getCharacterAttributes(characterId: string): Promise<CharacterAttributes | null> {
  const r = await supabase.from('character_attributes').select('*').eq('character_id', characterId).maybeSingle();
  return ok(r);
}

export async function upsertCharacterAttributes(attrs: Partial<CharacterAttributes> & { character_id: string }): Promise<CharacterAttributes> {
  const r = await supabase.from('character_attributes').upsert(attrs).select('*').single();
  return ok(r);
}

export async function updateCharacterResources(
  characterId: string,
  patch: { pv_now?: number; alma_now?: number }
): Promise<CharacterAttributes> {
  const r = await supabase.from('character_attributes').update(patch).eq('character_id', characterId).select('*').maybeSingle();
  if (!r.data) throw notFound();
  return ok(r);
}

// ========== FASE 3: EQUIPAMENTOS ==========

export async function listEquipmentDefinitions(filters?: {
  itemType?: string;
  rarity?: string;
  officialOnly?: boolean;
}): Promise<EquipmentDefinition[]> {
  let query = supabase.from('equipment_definitions').select('*');

  if (filters?.itemType) query = query.eq('item_type', filters.itemType);
  if (filters?.rarity) query = query.eq('rarity', filters.rarity);
  if (filters?.officialOnly) query = query.eq('is_official', true);

  return ok(await query.order('name')) ?? [];
}

export async function getEquipmentDefinition(id: string): Promise<EquipmentDefinition | null> {
  const r = await supabase.from('equipment_definitions').select('*').eq('id', id).maybeSingle();
  return ok(r);
}

export async function createEquipmentDefinition(def: Omit<EquipmentDefinition, 'id' | 'created_at'>): Promise<EquipmentDefinition> {
  const r = await supabase.from('equipment_definitions').insert(def).select('*').single();
  return ok(r);
}

export async function listCharacterEquipment(characterId: string): Promise<CharacterEquipment[]> {
  return ok(await supabase.from('character_equipment').select('*').eq('character_id', characterId)) ?? [];
}

export async function addCharacterEquipment(equipment: {
  character_id: string;
  equipment_id: string;
  quantity: number;
}): Promise<CharacterEquipment> {
  const r = await supabase.from('character_equipment').insert(equipment).select('*').single();
  return ok(r);
}

export async function updateCharacterEquipment(
  id: string,
  patch: { quantity?: number; equipped_slot?: string | null; instance_data?: any }
): Promise<CharacterEquipment> {
  const r = await supabase.from('character_equipment').update(patch).eq('id', id).select('*').maybeSingle();
  if (!r.data) throw notFound();
  return ok(r);
}

export async function deleteCharacterEquipment(id: string): Promise<void> {
  const d = ok(await supabase.from('character_equipment').delete().eq('id', id).select('id'));
  if (!d?.length) throw notFound();
}

// ========== FASE 3: HABILIDADES ==========

export async function listAbilityDefinitions(filters?: {
  abilityType?: string;
  officialOnly?: boolean;
}): Promise<AbilityDefinition[]> {
  let query = supabase.from('ability_definitions').select('*');

  if (filters?.abilityType) query = query.eq('ability_type', filters.abilityType);
  if (filters?.officialOnly) query = query.eq('is_official', true);

  return ok(await query.order('name')) ?? [];
}

export async function getAbilityDefinition(id: string): Promise<AbilityDefinition | null> {
  const r = await supabase.from('ability_definitions').select('*').eq('id', id).maybeSingle();
  return ok(r);
}

export async function listCharacterAbilities(characterId: string): Promise<CharacterAbility[]> {
  return ok(await supabase.from('character_abilities').select('*').eq('character_id', characterId)) ?? [];
}

export async function addCharacterAbility(ability: {
  character_id: string;
  ability_id: string;
}): Promise<CharacterAbility> {
  const r = await supabase.from('character_abilities').insert(ability).select('*').single();
  return ok(r);
}

export async function updateCharacterAbility(
  id: string,
  patch: { uses_remaining?: number | null; cooldown_remaining?: number }
): Promise<CharacterAbility> {
  const r = await supabase.from('character_abilities').update(patch).eq('id', id).select('*').maybeSingle();
  if (!r.data) throw notFound();
  return ok(r);
}

export async function deleteCharacterAbility(id: string): Promise<void> {
  const d = ok(await supabase.from('character_abilities').delete().eq('id', id).select('id'));
  if (!d?.length) throw notFound();
}

// ========== FASE 3: CONDIÇÕES ==========

export async function listConditionDefinitions(): Promise<ConditionDefinition[]> {
  return ok(await supabase.from('condition_definitions').select('*').order('name')) ?? [];
}

export async function getConditionDefinition(id: string): Promise<ConditionDefinition | null> {
  const r = await supabase.from('condition_definitions').select('*').eq('id', id).maybeSingle();
  return ok(r);
}

export async function listCharacterConditions(characterId: string): Promise<CharacterCondition[]> {
  return ok(await supabase.from('character_conditions').select('*').eq('character_id', characterId)) ?? [];
}

export async function addCharacterCondition(condition: {
  character_id: string;
  condition_id: string;
  severity: 'leve' | 'moderada' | 'severa' | 'critica';
  stacks?: number;
  duration_remaining: number;
  source_ability_id?: string;
  applied_by?: string;
}): Promise<CharacterCondition> {
  const r = await supabase.from('character_conditions').insert(condition).select('*').single();
  return ok(r);
}

export async function updateCharacterCondition(
  id: string,
  patch: { severity?: string; stacks?: number; duration_remaining?: number }
): Promise<CharacterCondition> {
  const r = await supabase.from('character_conditions').update(patch).eq('id', id).select('*').maybeSingle();
  if (!r.data) throw notFound();
  return ok(r);
}

export async function deleteCharacterCondition(id: string): Promise<void> {
  const d = ok(await supabase.from('character_conditions').delete().eq('id', id).select('id'));
  if (!d?.length) throw notFound();
}

// ========== FASE 3: COMBATE ==========

export async function listCombatEncounters(campaignId: string): Promise<CombatEncounter[]> {
  return ok(await supabase.from('combat_encounters').select('*').eq('campaign_id', campaignId).order('created_at', { ascending: false })) ?? [];
}

export async function getCombatEncounter(id: string): Promise<CombatEncounter | null> {
  const r = await supabase.from('combat_encounters').select('*').eq('id', id).maybeSingle();
  return ok(r);
}

export async function createCombatEncounter(encounter: {
  campaign_id: string;
  name: string;
  description?: string;
}): Promise<CombatEncounter> {
  const r = await supabase.from('combat_encounters').insert({
    campaign_id: encounter.campaign_id,
    name: encounter.name.trim(),
    description: encounter.description?.trim() || '',
    status: 'preparing',
  }).select('*').single();
  return ok(r);
}

export async function updateCombatEncounter(
  id: string,
  patch: {
    name?: string;
    description?: string;
    status?: 'preparing' | 'active' | 'paused' | 'ended';
    current_round?: number;
    current_turn_order?: number;
    started_at?: string | null;
    ended_at?: string | null;
  }
): Promise<CombatEncounter> {
  const r = await supabase.from('combat_encounters').update(patch).eq('id', id).select('*').maybeSingle();
  if (!r.data) throw notFound();
  return ok(r);
}

export async function deleteCombatEncounter(id: string): Promise<void> {
  const d = ok(await supabase.from('combat_encounters').delete().eq('id', id).select('id'));
  if (!d?.length) throw notFound();
}

export async function listCombatParticipants(encounterId: string): Promise<CombatParticipant[]> {
  return ok(await supabase.from('combat_participants').select('*').eq('encounter_id', encounterId).order('turn_order')) ?? [];
}

export async function addCombatParticipant(participant: {
  encounter_id: string;
  character_id?: string;
  npc_name?: string;
  initiative: number;
  turn_order: number;
  team: 'ally' | 'enemy' | 'neutral';
  current_pv?: number;
  current_alma?: number;
}): Promise<CombatParticipant> {
  const r = await supabase.from('combat_participants').insert(participant).select('*').single();
  return ok(r);
}

export async function updateCombatParticipant(
  id: string,
  patch: {
    initiative?: number;
    turn_order?: number;
    current_pv?: number;
    current_alma?: number;
    is_defeated?: boolean;
    defeated_at?: string | null;
  }
): Promise<CombatParticipant> {
  const r = await supabase.from('combat_participants').update(patch).eq('id', id).select('*').maybeSingle();
  if (!r.data) throw notFound();
  return ok(r);
}

export async function deleteCombatParticipant(id: string): Promise<void> {
  const d = ok(await supabase.from('combat_participants').delete().eq('id', id).select('id'));
  if (!d?.length) throw notFound();
}

export async function listCombatActions(encounterId: string, roundNumber?: number): Promise<CombatAction[]> {
  let query = supabase.from('combat_actions').select('*').eq('encounter_id', encounterId);

  if (roundNumber !== undefined) {
    query = query.eq('round_number', roundNumber);
  }

  return ok(await query.order('created_at')) ?? [];
}

export async function addCombatAction(action: {
  encounter_id: string;
  round_number: number;
  participant_id: string;
  action_type: 'attack' | 'ability' | 'move' | 'item' | 'defend' | 'other';
  ability_id?: string;
  item_id?: string;
  target_ids: string[];
  roll_result?: any;
  damage_dealt?: any;
  description: string;
}): Promise<CombatAction> {
  const r = await supabase.from('combat_actions').insert(action).select('*').single();
  return ok(r);
}
