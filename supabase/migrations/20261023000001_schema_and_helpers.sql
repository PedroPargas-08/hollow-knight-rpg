-- =====================================================================
-- Fase 2 · Migration 1/2 — Esquema, funções auxiliares e gatilhos
--
-- Princípios:
--  * Papel global (profiles.role) != papel dentro da campanha (campaign_members.member_role).
--  * Ninguém escolhe papel privilegiado: toda conta nova nasce 'jogador'. A promoção a 'mestre'
--    só ocorre por private.admin_set_role(), que NÃO é exposta pela API (schema private).
--  * Funções auxiliares ficam no schema "private" (não exposto pelo PostgREST), são SECURITY DEFINER
--    com search_path vazio, e existem para as políticas RLS consultarem outras tabelas sem recursão.
-- =====================================================================

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- ---------- Tabelas ----------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  role         text not null default 'jogador' check (role in ('jogador', 'mestre')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.campaigns (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 2000),
  status      text not null default 'preparacao' check (status in ('preparacao', 'andamento', 'pausada', 'encerrada')),
  -- owner_id vem do JWT (default auth.uid()); o cliente não recebe privilégio de INSERT nesta coluna.
  -- ON DELETE RESTRICT: apagar um mestre nunca apaga em cascata as campanhas (e fichas) de outras pessoas.
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index campaigns_owner_idx on public.campaigns (owner_id);

create table public.campaign_members (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  member_role text not null default 'jogador' check (member_role in ('jogador', 'co_mestre')),
  created_at  timestamptz not null default now(),
  constraint campaign_members_unique unique (campaign_id, user_id)
);
create index campaign_members_user_idx on public.campaign_members (user_id);

create table public.characters (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  owner_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 80),
  -- Campo PROTEGIDO: progressão só muda por quem administra a campanha (ver gatilho characters_guard).
  stage       smallint not null default 1 check (stage between 1 and 20),
  -- Conteúdo editável da ficha (identidade, atributos, recursos, narrativa...). JSONB só para o que é flexível.
  sheet       jsonb not null default '{}'::jsonb
              check (jsonb_typeof(sheet) = 'object' and pg_column_size(sheet) <= 65536),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index characters_campaign_idx on public.characters (campaign_id);
create index characters_owner_idx on public.characters (owner_id);

-- Convites: o token em texto puro NUNCA é armazenado; guardamos só o hash SHA-256.
create table public.campaign_invites (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete cascade,
  token_hash  text not null unique,
  member_role text not null default 'jogador' check (member_role in ('jogador', 'co_mestre')),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  used_by     uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);
create index campaign_invites_campaign_idx on public.campaign_invites (campaign_id);

-- ---------- Funções auxiliares de autorização (usadas pelas políticas) ----------
create function private.is_master() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'mestre');
$$;

create function private.is_campaign_owner(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaigns c where c.id = cid and c.owner_id = (select auth.uid()));
$$;

-- Administra = é mestre global E (dono OU co_mestre explícito). Mestre sem vínculo NÃO administra.
create function private.is_campaign_admin(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_master() and (
    exists (select 1 from public.campaigns c where c.id = cid and c.owner_id = (select auth.uid()))
    or exists (select 1 from public.campaign_members m
               where m.campaign_id = cid and m.user_id = (select auth.uid()) and m.member_role = 'co_mestre')
  );
$$;

-- Participa = dono OU possui linha em campaign_members.
create function private.is_campaign_member(cid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaigns c where c.id = cid and c.owner_id = (select auth.uid()))
      or exists (select 1 from public.campaign_members m where m.campaign_id = cid and m.user_id = (select auth.uid()));
$$;

-- Dois usuários compartilham ao menos uma campanha (permite ver o nome de exibição de colegas de mesa).
create function private.shares_campaign_with(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  with me as (
    select m.campaign_id from public.campaign_members m where m.user_id = (select auth.uid())
    union
    select c.id from public.campaigns c where c.owner_id = (select auth.uid())
  )
  select exists (
    select 1 from me
    where exists (select 1 from public.campaign_members m2 where m2.campaign_id = me.campaign_id and m2.user_id = other)
       or exists (select 1 from public.campaigns c2 where c2.id = me.campaign_id and c2.owner_id = other)
  );
$$;

-- Privilégio mínimo: só usuários autenticados executam; anon e PUBLIC não.
revoke execute on function private.is_master(), private.is_campaign_owner(uuid), private.is_campaign_admin(uuid),
  private.is_campaign_member(uuid), private.shares_campaign_with(uuid) from public, anon;
grant execute on function private.is_master(), private.is_campaign_owner(uuid), private.is_campaign_admin(uuid),
  private.is_campaign_member(uuid), private.shares_campaign_with(uuid) to authenticated;

-- ---------- Gatilhos ----------
create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end; $$;

create trigger profiles_touch   before update on public.profiles   for each row execute function private.touch_updated_at();
create trigger campaigns_touch  before update on public.campaigns  for each row execute function private.touch_updated_at();
create trigger characters_touch before update on public.characters for each row execute function private.touch_updated_at();

-- Cria o perfil quando o usuário é criado no Supabase Auth (um único usuário, uma única linha de perfil).
-- O papel NUNCA é lido de metadados: raw_user_meta_data é editável pelo próprio usuário.
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_name text;
begin
  v_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 32);
  if char_length(v_name) < 2 then v_name := left(btrim(split_part(coalesce(new.email, ''), '@', 1)), 32); end if;
  if char_length(v_name) < 2 then v_name := 'Viajante'; end if;
  insert into public.profiles (id, display_name, role) values (new.id, v_name, 'jogador');
  return new;
end; $$;
revoke execute on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- Defesa em profundidade contra autoelevação (além da ausência de privilégio de coluna em "role").
create function private.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id then raise exception 'id do perfil é imutável' using errcode = '42501'; end if;
  if new.role is distinct from old.role and current_user not in ('postgres', 'service_role', 'supabase_admin') then
    raise exception 'alterar o papel exige processo administrativo' using errcode = '42501';
  end if;
  return new;
end; $$;
create trigger profiles_guard before update on public.profiles for each row execute function private.profiles_guard();

-- Fichas: vínculos são imutáveis; "stage" (progressão) só muda por administradores da campanha.
create function private.characters_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.stage <> 1 and not private.is_campaign_admin(new.campaign_id) then
      raise exception 'progressão inicial só pode ser alterada por quem administra a campanha' using errcode = '42501';
    end if;
  else
    if new.id is distinct from old.id or new.owner_id is distinct from old.owner_id
       or new.campaign_id is distinct from old.campaign_id or new.created_at is distinct from old.created_at then
      raise exception 'id, dono e campanha da ficha são imutáveis' using errcode = '42501';
    end if;
    if new.stage is distinct from old.stage and not private.is_campaign_admin(new.campaign_id) then
      raise exception 'progressão só pode ser alterada por quem administra a campanha' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;
create trigger characters_guard before insert or update on public.characters for each row execute function private.characters_guard();

-- Promoção/rebaixamento: processo controlado. Não é exposto pela API (schema private, sem grants a clientes).
-- Uso (SQL Editor do Supabase, com a conta dona do projeto):  select private.admin_set_role('<uuid>', 'mestre');
create function private.admin_set_role(p_user uuid, p_role text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_role not in ('jogador', 'mestre') then raise exception 'papel inválido'; end if;
  update public.profiles set role = p_role where id = p_user;
  if not found then raise exception 'perfil não encontrado'; end if;
end; $$;
revoke all on function private.admin_set_role(uuid, text) from public, anon, authenticated;
