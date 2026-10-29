-- =====================================================================
-- Valdrim RPG — Migração: Regras de criação de fichas e solicitações
-- 1. Colunas character_type e parent_character_id em characters
-- 2. Tabela character_creation_requests para gerenciar permissões de fichas extras e invocações
-- 3. Atualização de private.characters_guard() para suportar Fase 3 e limite de fichas
-- 4. Grants completos para colunas de atributos em character_attributes
-- =====================================================================

-- 1. Colunas character_type e parent_character_id em characters
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS character_type text NOT NULL DEFAULT 'principal'
    CHECK (character_type IN ('principal', 'extra', 'invocacao')),
  ADD COLUMN IF NOT EXISTS parent_character_id uuid
    REFERENCES public.characters(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS characters_parent_idx ON public.characters(parent_character_id);
CREATE INDEX IF NOT EXISTS characters_type_idx ON public.characters(character_type);

-- 2. Tabela character_creation_requests
CREATE TABLE IF NOT EXISTS public.character_creation_requests (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id         uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  user_id             uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  character_name      text NOT NULL CHECK (char_length(btrim(character_name)) BETWEEN 1 AND 80),
  request_type        text NOT NULL DEFAULT 'extra' CHECK (request_type IN ('extra', 'invocacao')),
  parent_character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  concept             text NOT NULL DEFAULT '' CHECK (char_length(concept) <= 1000),
  status              text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  reviewed_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  gm_notes            text DEFAULT '' CHECK (char_length(coalesce(gm_notes, '')) <= 1000),
  consumed_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS char_req_campaign_idx ON public.character_creation_requests(campaign_id);
CREATE INDEX IF NOT EXISTS char_req_user_idx ON public.character_creation_requests(user_id);
CREATE INDEX IF NOT EXISTS char_req_status_idx ON public.character_creation_requests(status);

-- RLS para character_creation_requests
ALTER TABLE public.character_creation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS char_req_select ON public.character_creation_requests;
CREATE POLICY char_req_select ON public.character_creation_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR private.is_campaign_admin(campaign_id)
  );

DROP POLICY IF EXISTS char_req_insert ON public.character_creation_requests;
CREATE POLICY char_req_insert ON public.character_creation_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND private.is_campaign_member(campaign_id)
    AND status = 'pendente'
  );

DROP POLICY IF EXISTS char_req_update ON public.character_creation_requests;
CREATE POLICY char_req_update ON public.character_creation_requests
  FOR UPDATE USING (
    private.is_campaign_admin(campaign_id)
    OR (user_id = auth.uid() AND status = 'pendente')
  );

DROP POLICY IF EXISTS char_req_delete ON public.character_creation_requests;
CREATE POLICY char_req_delete ON public.character_creation_requests
  FOR DELETE USING (
    private.is_campaign_admin(campaign_id)
    OR (user_id = auth.uid() AND status = 'pendente')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.character_creation_requests TO authenticated;

-- Grants de colunas para characters (novas colunas de tipo e invocação)
GRANT INSERT (character_type, parent_character_id) ON public.characters TO authenticated;
GRANT UPDATE (character_type, parent_character_id) ON public.characters TO authenticated;

-- 3. Grants de colunas para character_attributes (permite criação de fichas por jogadores)
GRANT INSERT (
  character_id, agi, "for", int, pre, vig,
  agi_bonus, for_bonus, int_bonus, pre_bonus, vig_bonus,
  pv_now, pv_max, alma_now, alma_max, defense
) ON public.character_attributes TO authenticated;

GRANT UPDATE (
  pv_now, alma_now,
  agi_bonus, for_bonus, int_bonus, pre_bonus, vig_bonus
) ON public.character_attributes TO authenticated;

-- 4. Atualização de private.characters_guard()
CREATE OR REPLACE FUNCTION private.characters_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  is_admin boolean;
  default_attrs_v2 jsonb := '{"AGI":10,"FOR":10,"INT":10,"PRE":10,"VIG":10}'::jsonb;
  default_attrs_v1 jsonb := '{"Vigor":10,"Agilidade":10,"Intelecto":10,"Percepção":10,"Presença":10,"Vontade":10}'::jsonb;
  v_attrs jsonb;
  v_char_count integer;
  v_req_id uuid;
  pv_now numeric;
  pv_max numeric;
  alma_now numeric;
  alma_max numeric;
BEGIN
  is_admin := private.is_campaign_admin(new.campaign_id);

  IF tg_op = 'INSERT' THEN
    -- Estágio inicial diferente de 1 só com permissão de admin
    IF new.stage <> 1 AND NOT is_admin THEN
      RAISE EXCEPTION
        'progressão inicial só pode ser alterada por quem administra a campanha'
        USING errcode = '42501';
    END IF;

    -- Validação mecânica da ficha na criação por jogador
    IF NOT is_admin THEN
      v_attrs := new.sheet -> 'attributes';

      -- Aceita tanto atributos Fase 3 (AGI/FOR/INT/PRE/VIG) quanto legados (Vigor/Agilidade/...)
      IF v_attrs IS DISTINCT FROM default_attrs_v2
         AND v_attrs IS DISTINCT FROM default_attrs_v1 THEN
        RAISE EXCEPTION
          'a ficha deve começar com os valores padrão; campos mecânicos exigem autorização do mestre'
          USING errcode = '42501';
      END IF;

      -- Defesa padrão = 10
      IF (new.sheet -> 'defense') IS DISTINCT FROM '10'::jsonb THEN
        RAISE EXCEPTION
          'a defesa inicial deve ser 10'
          USING errcode = '42501';
      END IF;

      -- PV inicial deve bater com pv_max (aceita 20 para Fase 3 ou 10 para legado)
      IF NOT (
        (new.sheet #> '{pv,now}' = '20'::jsonb AND new.sheet #> '{pv,max}' = '20'::jsonb)
        OR
        (new.sheet #> '{pv,now}' = '10'::jsonb AND new.sheet #> '{pv,max}' = '10'::jsonb)
      ) THEN
        RAISE EXCEPTION
          'PV inicial inválido para ficha padrão'
          USING errcode = '42501';
      END IF;

      -- ALMA inicial deve bater com alma_max (aceita 10 para Fase 3 ou 5 para legado)
      IF NOT (
        (new.sheet #> '{alma,now}' = '10'::jsonb AND new.sheet #> '{alma,max}' = '10'::jsonb)
        OR
        (new.sheet #> '{alma,now}' = '5'::jsonb AND new.sheet #> '{alma,max}' = '5'::jsonb)
      ) THEN
        RAISE EXCEPTION
          'ALMA inicial inválida para ficha padrão'
          USING errcode = '42501';
      END IF;

      -- Habilidades e equipamentos começam vazios
      IF (new.sheet -> 'abilities') IS DISTINCT FROM '[]'::jsonb
         OR (new.sheet -> 'equipment') IS DISTINCT FROM '[]'::jsonb THEN
        RAISE EXCEPTION
          'habilidades e equipamentos iniciais devem estar vazios'
          USING errcode = '42501';
      END IF;

      -- Regra de criação: 1º personagem é livre; 2º em diante ou invocação exige autorização do mestre
      SELECT count(*) INTO v_char_count
      FROM public.characters
      WHERE campaign_id = new.campaign_id
        AND owner_id = new.owner_id;

      IF v_char_count = 0 THEN
        -- Primeira ficha: permitida diretamente como 'principal'
        new.character_type := COALESCE(new.character_type, 'principal');
      ELSE
        -- Segunda ficha em diante: busca solicitação aprovada não consumida
        SELECT id INTO v_req_id
        FROM public.character_creation_requests
        WHERE campaign_id = new.campaign_id
          AND user_id = new.owner_id
          AND status = 'aprovado'
          AND consumed_at IS NULL
          AND (
            (new.character_type = 'invocacao' AND request_type = 'invocacao')
            OR
            (new.character_type IN ('principal', 'extra') AND request_type = 'extra')
          )
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_req_id IS NULL THEN
          RAISE EXCEPTION
            'jogador já possui personagem nesta campanha; criação de personagem adicional ou invocação exige autorização do mestre'
            USING errcode = '42501';
        END IF;

        -- Marca solicitação como consumida
        UPDATE public.character_creation_requests
        SET consumed_at = clock_timestamp(), updated_at = clock_timestamp()
        WHERE id = v_req_id;
      END IF;

      -- Se for invocação, o parent_character_id deve pertencer ao mesmo jogador
      IF new.character_type = 'invocacao' THEN
        IF new.parent_character_id IS NULL OR NOT EXISTS (
          SELECT 1 FROM public.characters p
          WHERE p.id = new.parent_character_id
            AND p.owner_id = new.owner_id
            AND p.campaign_id = new.campaign_id
        ) THEN
          RAISE EXCEPTION
            'invocação deve estar vinculada a um personagem válido do jogador'
            USING errcode = '42501';
        END IF;
      END IF;
    END IF;

  ELSE
    -- UPDATE: Campos estruturais imutáveis
    IF new.id IS DISTINCT FROM old.id
       OR new.owner_id IS DISTINCT FROM old.owner_id
       OR new.campaign_id IS DISTINCT FROM old.campaign_id
       OR new.created_at IS DISTINCT FROM old.created_at THEN
      RAISE EXCEPTION
        'id, dono e campanha da ficha são imutáveis'
        USING errcode = '42501';
    END IF;

    -- Progressão somente por admin
    IF new.stage IS DISTINCT FROM old.stage AND NOT is_admin THEN
      RAISE EXCEPTION
        'progressão só pode ser alterada por quem administra a campanha'
        USING errcode = '42501';
    END IF;

    -- Não permitir jogadores alterarem campos mecânicos no sheet JSONB
    IF NOT is_admin THEN
      IF new.sheet -> 'attributes' IS DISTINCT FROM old.sheet -> 'attributes'
         OR new.sheet -> 'defense' IS DISTINCT FROM old.sheet -> 'defense'
         OR new.sheet #> '{pv,max}' IS DISTINCT FROM old.sheet #> '{pv,max}'
         OR new.sheet #> '{alma,max}' IS DISTINCT FROM old.sheet #> '{alma,max}'
         OR new.sheet -> 'abilities' IS DISTINCT FROM old.sheet -> 'abilities'
         OR new.sheet -> 'equipment' IS DISTINCT FROM old.sheet -> 'equipment' THEN
        RAISE EXCEPTION
          'atributos, defesa, máximos, habilidades e equipamentos exigem autorização do mestre'
          USING errcode = '42501';
      END IF;
    END IF;
  END IF;

  -- Validação de números inteiros para PV e ALMA
  IF jsonb_typeof(new.sheet) IS DISTINCT FROM 'object'
     OR jsonb_typeof(new.sheet #> '{pv,now}') IS DISTINCT FROM 'number'
     OR jsonb_typeof(new.sheet #> '{pv,max}') IS DISTINCT FROM 'number'
     OR jsonb_typeof(new.sheet #> '{alma,now}') IS DISTINCT FROM 'number'
     OR jsonb_typeof(new.sheet #> '{alma,max}') IS DISTINCT FROM 'number' THEN
    RAISE EXCEPTION
      'a ficha deve conter valores numéricos válidos para PV e ALMA'
      USING errcode = '42501';
  END IF;

  IF (new.sheet #>> '{pv,now}') !~ '^[0-9]+$'
     OR (new.sheet #>> '{pv,max}') !~ '^[0-9]+$'
     OR (new.sheet #>> '{alma,now}') !~ '^[0-9]+$'
     OR (new.sheet #>> '{alma,max}') !~ '^[0-9]+$' THEN
    RAISE EXCEPTION
      'PV e ALMA devem ser números inteiros não negativos'
      USING errcode = '42501';
  END IF;

  pv_now := (new.sheet #>> '{pv,now}')::numeric;
  pv_max := (new.sheet #>> '{pv,max}')::numeric;
  alma_now := (new.sheet #>> '{alma,now}')::numeric;
  alma_max := (new.sheet #>> '{alma,max}')::numeric;

  IF pv_now < 0 OR pv_max < 0 OR pv_max > 999
     OR pv_now > pv_max
     OR alma_now < 0 OR alma_max < 0 OR alma_max > 999
     OR alma_now > alma_max THEN
    RAISE EXCEPTION
      'PV e ALMA devem estar entre zero e seus respectivos máximos'
      USING errcode = '42501';
  END IF;

  RETURN new;
END;
$$;

-- 5. Funções RPC públicas para gerenciar solicitações de personagens
CREATE OR REPLACE FUNCTION public.request_character_creation(
  p_campaign_id uuid,
  p_character_name text,
  p_request_type text DEFAULT 'extra',
  p_concept text DEFAULT '',
  p_parent_character_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING errcode = '42501';
  END IF;

  IF NOT private.is_campaign_member(p_campaign_id) THEN
    RAISE EXCEPTION 'usuário não é membro da campanha' USING errcode = '42501';
  END IF;

  IF p_request_type NOT IN ('extra', 'invocacao') THEN
    RAISE EXCEPTION 'tipo de solicitação inválido' USING errcode = '22023';
  END IF;

  IF p_request_type = 'invocacao' AND p_parent_character_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.characters
      WHERE id = p_parent_character_id
        AND owner_id = v_uid
        AND campaign_id = p_campaign_id
    ) THEN
      RAISE EXCEPTION 'personagem invocador inválido ou não pertence ao usuário' USING errcode = '42501';
    END IF;
  END IF;

  INSERT INTO public.character_creation_requests (
    campaign_id, user_id, character_name, request_type,
    parent_character_id, concept, status
  )
  VALUES (
    p_campaign_id, v_uid, btrim(p_character_name), p_request_type,
    p_parent_character_id, coalesce(p_concept, ''), 'pendente'
  )
  RETURNING id INTO v_req_id;

  RETURN v_req_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_character_creation_request(
  p_request_id uuid,
  p_status text,
  p_gm_notes text DEFAULT ''
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_req record;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'não autenticado' USING errcode = '42501';
  END IF;

  SELECT * INTO v_req
  FROM public.character_creation_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'solicitação não encontrada' USING errcode = 'P0002';
  END IF;

  IF NOT private.is_campaign_admin(v_req.campaign_id) THEN
    RAISE EXCEPTION 'apenas administradores da campanha podem revisar solicitações' USING errcode = '42501';
  END IF;

  IF p_status NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'status deve ser aprovado ou rejeitado' USING errcode = '22023';
  END IF;

  UPDATE public.character_creation_requests
  SET
    status = p_status,
    reviewed_by = v_uid,
    reviewed_at = clock_timestamp(),
    gm_notes = coalesce(p_gm_notes, ''),
    updated_at = clock_timestamp()
  WHERE id = p_request_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_character_creation(uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_character_creation_request(uuid, text, text) TO authenticated;
