// Camada de dados: SOMENTE consultas ao Supabase. A autorização é do RLS no banco; nada aqui "decide" permissões.
import { supabase } from './supabase';
import { normalizeSheet, type Sheet } from './sheet';

export interface Campaign { id: string; name: string; description: string; status: 'preparacao' | 'andamento' | 'pausada' | 'encerrada'; owner_id: string; created_at: string }
export interface Member { id: string; user_id: string; member_role: 'jogador' | 'co_mestre'; display_name: string }
export interface Character { id: string; campaign_id: string; owner_id: string; name: string; stage: number; sheet: Sheet; updated_at: string }
export const STATUS_LABEL: Record<Campaign['status'], string> = { preparacao: 'Em preparação', andamento: 'Em andamento', pausada: 'Pausada', encerrada: 'Encerrada' };

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
export const createCharacter = async (v: { campaign_id: string; name: string; sheet: Sheet }): Promise<Character> =>
  toChar(ok(await supabase.from('characters').insert({ campaign_id: v.campaign_id, name: v.name.trim(), sheet: v.sheet }).select('id, campaign_id, owner_id, name, stage, sheet, updated_at').single()));
/** Só envia colunas atualizáveis (name, sheet e, para administradores, stage). Zero linhas = sem permissão (RLS). */
export async function updateCharacter(id: string, patch: { name?: string; sheet?: Sheet; stage?: number }): Promise<Character> {
  const r = ok(await supabase.from('characters').update(patch).eq('id', id).select('id, campaign_id, owner_id, name, stage, sheet, updated_at').maybeSingle());
  if (!r) throw notFound();
  return toChar(r);
}
export const deleteCharacter = async (id: string) => { const d = ok(await supabase.from('characters').delete().eq('id', id).select('id')); if (!d?.length) throw notFound(); };

export async function updateDisplayName(id: string, name: string) {
  const d = ok(await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', id).select('id'));
  if (!d?.length) throw notFound();
}
