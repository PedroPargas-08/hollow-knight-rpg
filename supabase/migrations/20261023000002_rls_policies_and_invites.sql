-- =====================================================================
-- Fase 2 · Migration 2/2 — RLS, privilégios mínimos e convites
--
-- Duas camadas complementares (ambas obrigatórias):
--  1) GRANTs por coluna: o cliente simplesmente NÃO tem privilégio para tocar owner_id, campaign_id, role...
--  2) Políticas RLS: decidem QUAIS LINHAS cada operação enxerga/altera.
-- "anon" não recebe nenhum privilégio nas tabelas. Nenhuma política usa só "está autenticado".
-- RLS NÃO é forçado (FORCE) porque as funções auxiliares SECURITY DEFINER precisam consultar as tabelas.
-- =====================================================================

alter table public.profiles         enable row level security;
alter table public.campaigns        enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters       enable row level security;
alter table public.campaign_invites enable row level security;

-- Zera os privilégios padrão que o Supabase concede e concede apenas o necessário.
revoke all on public.profiles, public.campaigns, public.campaign_members, public.characters, public.campaign_invites
  from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;               -- "role" NÃO é atualizável pelo cliente

grant select, delete on public.campaigns to authenticated;
grant insert (name, description, status) on public.campaigns to authenticated;  -- owner_id vem do JWT (default)
grant update (name, description, status) on public.campaigns to authenticated;

grant select, delete on public.campaign_members to authenticated;               -- inserção só via redeem_campaign_invite()

grant select, delete on public.characters to authenticated;
grant insert (campaign_id, name, stage, sheet) on public.characters to authenticated;  -- owner_id vem do JWT
grant update (name, stage, sheet) on public.characters to authenticated;               -- campaign_id/owner_id imutáveis

grant select (id, campaign_id, member_role, created_by, expires_at, used_at, used_by, created_at)
  on public.campaign_invites to authenticated;                                   -- token_hash nunca é legível
grant delete on public.campaign_invites to authenticated;                        -- revogar convite

-- ---------- profiles ----------
-- Lê o próprio perfil e o de quem divide campanha com você. Não há INSERT (o gatilho cria) nem DELETE.
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_campaign_with(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- campaigns ----------
create policy campaigns_select on public.campaigns for select to authenticated
  using (private.is_campaign_member(id));
create policy campaigns_insert on public.campaigns for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_master());          -- só mestre cria, e só em seu próprio nome
create policy campaigns_update on public.campaigns for update to authenticated
  using (private.is_campaign_admin(id)) with check (private.is_campaign_admin(id));
create policy campaigns_delete on public.campaigns for delete to authenticated
  using (owner_id = (select auth.uid()) and private.is_master());               -- só o dono apaga

-- ---------- campaign_members ----------
create policy members_select on public.campaign_members for select to authenticated
  using (private.is_campaign_member(campaign_id));
-- Pode sair (própria linha), o dono remove qualquer um, co_mestre remove apenas jogadores.
create policy members_delete on public.campaign_members for delete to authenticated
  using (user_id = (select auth.uid())
         or private.is_campaign_owner(campaign_id)
         or (private.is_campaign_admin(campaign_id) and member_role = 'jogador'));

-- ---------- characters ----------
-- Jogador: só as próprias fichas E enquanto ainda participa da campanha. Administração: todas da própria campanha.
create policy characters_select on public.characters for select to authenticated
  using ((owner_id = (select auth.uid()) and private.is_campaign_member(campaign_id)) or private.is_campaign_admin(campaign_id));
create policy characters_insert on public.characters for insert to authenticated
  with check (owner_id = (select auth.uid()) and private.is_campaign_member(campaign_id));
create policy characters_update on public.characters for update to authenticated
  using ((owner_id = (select auth.uid()) and private.is_campaign_member(campaign_id)) or private.is_campaign_admin(campaign_id))
  with check ((owner_id = (select auth.uid()) and private.is_campaign_member(campaign_id)) or private.is_campaign_admin(campaign_id));
create policy characters_delete on public.characters for delete to authenticated
  using ((owner_id = (select auth.uid()) and private.is_campaign_member(campaign_id)) or private.is_campaign_admin(campaign_id));

-- ---------- campaign_invites ----------
create policy invites_select on public.campaign_invites for select to authenticated
  using (private.is_campaign_admin(campaign_id));
create policy invites_delete on public.campaign_invites for delete to authenticated
  using (private.is_campaign_admin(campaign_id));

-- ---------- RPC: criar convite (devolve o token UMA vez; só o hash é guardado) ----------
create function public.create_campaign_invite(p_campaign_id uuid, p_member_role text default 'jogador', p_ttl_hours int default 72)
returns text language plpgsql security definer set search_path = '' as $$
declare v_token text; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'autenticação necessária' using errcode = '28000'; end if;
  if p_member_role not in ('jogador', 'co_mestre') then raise exception 'papel de convite inválido' using errcode = '22023'; end if;
  if p_ttl_hours is null or p_ttl_hours not between 1 and 720 then raise exception 'validade deve ficar entre 1 e 720 horas' using errcode = '22023'; end if;
  if not private.is_campaign_admin(p_campaign_id) then raise exception 'permissão negada' using errcode = '42501'; end if;
  if p_member_role = 'co_mestre' and not private.is_campaign_owner(p_campaign_id) then
    raise exception 'apenas o dono concede administração' using errcode = '42501';
  end if;
  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');  -- ~244 bits aleatórios
  insert into public.campaign_invites (campaign_id, token_hash, member_role, created_by, expires_at)
  values (p_campaign_id, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), p_member_role, v_uid, now() + make_interval(hours => p_ttl_hours));
  return v_token;
end; $$;

-- ---------- RPC: resgatar convite (uso único, com validade) ----------
create function public.redeem_campaign_invite(p_token text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_inv public.campaign_invites; v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'autenticação necessária' using errcode = '28000'; end if;
  select * into v_inv from public.campaign_invites
   where token_hash = encode(sha256(convert_to(btrim(coalesce(p_token, '')), 'utf8')), 'hex')
     and used_at is null and expires_at > now()
   for update;
  -- Mensagem única para token inexistente, expirado, usado ou não elegível (não revela qual).
  if not found then raise exception 'Convite inválido ou expirado' using errcode = '22023'; end if;
  if v_inv.member_role = 'co_mestre' and not private.is_master() then raise exception 'Convite inválido ou expirado' using errcode = '22023'; end if;
  if private.is_campaign_member(v_inv.campaign_id) then raise exception 'Você já participa desta campanha' using errcode = '23505'; end if;
  update public.campaign_invites set used_at = now(), used_by = v_uid where id = v_inv.id;
  insert into public.campaign_members (campaign_id, user_id, member_role) values (v_inv.campaign_id, v_uid, v_inv.member_role);
  return v_inv.campaign_id;
end; $$;

revoke execute on function public.create_campaign_invite(uuid, text, int), public.redeem_campaign_invite(text) from public, anon;
grant  execute on function public.create_campaign_invite(uuid, text, int), public.redeem_campaign_invite(text) to authenticated;
