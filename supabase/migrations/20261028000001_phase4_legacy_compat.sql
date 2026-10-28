-- =====================================================================
-- Fase 4 · Migration 1/5 — Compatibilidade de Fichas Legadas
-- Estratégia: preservar JSONB original, adicionar coluna de mapeamento,
-- fornecer função de migração assistida (não automática).
-- =====================================================================

-- 1. Coluna para armazenar o mapeamento escolhido pelo mestre
--    Permite auditoria e re-migração futura sem perda de informação.
ALTER TABLE public.character_attributes
  ADD COLUMN IF NOT EXISTS legacy_mapping jsonb DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(legacy_mapping) = 'object');

COMMENT ON COLUMN public.character_attributes.legacy_mapping IS
  'Registro do mapeamento legado→Fase 3 escolhido pelo mestre.
   Ex.: {"source": "sheet", "mapping": {"Agilidade":"AGI","Intelecto":"INT","Vigor":"VIG","Percepção":"PRE","Presença":"PRE","Vontade":"FOR"}, "method": "merge_max", "migrated_at": "2026-10-28T...", "migrated_by": "uuid"}';

-- 2. Função auxiliar: extrai atributos legados do JSONB da ficha
--    Retorna NULL se a ficha não tiver atributos legados válidos.
CREATE OR REPLACE FUNCTION private.extract_legacy_attributes(p_sheet jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT CASE
    WHEN jsonb_typeof(p_sheet) <> 'object' THEN NULL
    WHEN jsonb_typeof(p_sheet->'attributes') <> 'object' THEN NULL
    ELSE p_sheet->'attributes'
  END;
$function$;

-- 3. Função: sugere mapeamento padrão (não aplica, só sugere)
--    O mestre pode revisar e ajustar antes de confirmar.
CREATE OR REPLACE FUNCTION public.suggest_legacy_mapping(p_character_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_sheet jsonb;
  v_legacy jsonb;
  v_suggestion jsonb;
BEGIN
  -- Busca a ficha (JSONB)
  SELECT sheet INTO v_sheet FROM public.characters WHERE id = p_character_id;
  IF v_sheet IS NULL THEN
    RAISE EXCEPTION 'Personagem não encontrado' USING errcode = '22023';
  END IF;

  v_legacy := private.extract_legacy_attributes(v_sheet);
  IF v_legacy IS NULL THEN
    RAISE EXCEPTION 'Ficha não possui atributos legados válidos' USING errcode = '22023';
  END IF;

  -- Sugestão de mapeamento: merge_max para Percepção+Presença→PRE, Vontade→FOR
  v_suggestion := jsonb_build_object(
    'source', 'sheet',
    'legacy_attributes', v_legacy,
    'mapping', jsonb_build_object(
      'Agilidade', 'AGI',
      'Intelecto', 'INT',
      'Vigor', 'VIG',
      'Percepção', 'PRE',
      'Presença', 'PRE',
      'Vontade', 'FOR'
    ),
    'merge_rules', jsonb_build_object(
      'PRE', 'max',      -- usa o maior entre Percepção e Presença
      'FOR', 'direct'    -- Vontade vai direto para FOR
    ),
    'suggested_at', now(),
    'suggested_by', (SELECT auth.uid())
  );

  RETURN v_suggestion;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.suggest_legacy_mapping(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.suggest_legacy_mapping(uuid) TO authenticated;

-- 4. Função: aplica mapeamento confirmado pelo mestre
--    Cria/atualiza character_attributes com valores convertidos.
CREATE OR REPLACE FUNCTION public.migrate_legacy_character(
  p_character_id uuid,
  p_mapping jsonb,           -- {"Agilidade":"AGI", "Intelecto":"INT", ...}
  p_merge_rules jsonb,       -- {"PRE":"max", "FOR":"direct"}
  p_override_existing boolean DEFAULT false
)
RETURNS public.character_attributes
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_char public.characters;
  v_legacy jsonb;
  v_attrs public.character_attributes;
  v_existing public.character_attributes;
  v_stage smallint;
  v_base_agi int; v_base_for int; v_base_int int; v_base_pre int; v_base_vig int;
  v_pv_now int; v_pv_max int; v_alma_now int; v_alma_max int; v_defense int;
  v_mapping_record jsonb;
BEGIN
  -- Verifica permissão: só admin da campanha
  SELECT * INTO v_char FROM public.characters WHERE id = p_character_id;
  IF v_char IS NULL THEN
    RAISE EXCEPTION 'Personagem não encontrado' USING errcode = '22023';
  END IF;
  IF NOT private.is_campaign_admin(v_char.campaign_id) THEN
    RAISE EXCEPTION 'Apenas administradores da campanha podem migrar fichas legadas' USING errcode = '42501';
  END IF;

  -- Verifica se já existe character_attributes
  SELECT * INTO v_existing FROM public.character_attributes WHERE character_id = p_character_id;
  IF v_existing IS NOT NULL AND NOT p_override_existing THEN
    RAISE EXCEPTION 'Personagem já possui character_attributes. Use override_existing=true para re-migrar.' USING errcode = '23505';
  END IF;

  -- Extrai atributos legados
  v_legacy := private.extract_legacy_attributes(v_char.sheet);
  IF v_legacy IS NULL THEN
    RAISE EXCEPTION 'Ficha não possui atributos legados válidos para migração' USING errcode = '22023';
  END IF;

  v_stage := v_char.stage;

  -- Aplica mapeamento legado → Fase 3
  -- Valores base: pega do JSONB legado via mapping
  v_base_agi := COALESCE((v_legacy->>(SELECT key FROM jsonb_each_text(p_mapping->'mapping') WHERE value = 'AGI' LIMIT 1))::int, 10);
  v_base_for := COALESCE((v_legacy->>(SELECT key FROM jsonb_each_text(p_mapping->'mapping') WHERE value = 'FOR' LIMIT 1))::int, 10);
  v_base_int := COALESCE((v_legacy->>(SELECT key FROM jsonb_each_text(p_mapping->'mapping') WHERE value = 'INT' LIMIT 1))::int, 10);
  v_base_pre := COALESCE((v_legacy->>(SELECT key FROM jsonb_each_text(p_mapping->'mapping') WHERE value = 'PRE' LIMIT 1))::int, 10);
  v_base_vig := COALESCE((v_legacy->>(SELECT key FROM jsonb_each_text(p_mapping->'mapping') WHERE value = 'VIG' LIMIT 1))::int, 10);

  -- Regra de merge para PRE (Percepção + Presença)
  IF (p_merge_rules->>'PRE') = 'max' THEN
    DECLARE
      v_per int := COALESCE((v_legacy->>'Percepção')::int, 10);
      v_pres int := COALESCE((v_legacy->>'Presença')::int, 10);
    BEGIN
      v_base_pre := GREATEST(v_per, v_pres);
    END;
  ELSIF (p_merge_rules->>'PRE') = 'avg' THEN
    DECLARE
      v_per int := COALESCE((v_legacy->>'Percepção')::int, 10);
      v_pres int := COALESCE((v_legacy->>'Presença')::int, 10);
    BEGIN
      v_base_pre := (v_per + v_pres) / 2;
    END;
  END IF;

  -- Regra para FOR (Vontade)
  IF (p_merge_rules->>'FOR') = 'direct' THEN
    DECLARE v_vontade int := COALESCE((v_legacy->>'Vontade')::int, 10);
    BEGIN
      v_base_for := v_vontade;
    END;
  END IF;

  -- Clamp 1-30
  v_base_agi := GREATEST(1, LEAST(30, v_base_agi));
  v_base_for := GREATEST(1, LEAST(30, v_base_for));
  v_base_int := GREATEST(1, LEAST(30, v_base_int));
  v_base_pre := GREATEST(1, LEAST(30, v_base_pre));
  v_base_vig := GREATEST(1, LEAST(30, v_base_vig));

  -- Calcula derivados
  v_pv_max := 10 + (v_base_vig * v_stage) + FLOOR((v_base_vig - 10) / 2);
  v_alma_max := FLOOR(5 + (v_base_int * v_stage / 2) + FLOOR((v_base_int - 10) / 2));
  v_defense := 10 + FLOOR((v_base_agi - 10) / 2);

  -- Preserva PV/ALMA atuais do JSONB se existirem, senão usa máximos
  v_pv_now := LEAST(v_pv_max, COALESCE((v_char.sheet#>>'{pv,now}')::int, v_pv_max));
  v_alma_now := LEAST(v_alma_max, COALESCE((v_char.sheet#>>'{alma,now}')::int, v_alma_max));

  -- Registra o mapeamento usado
  v_mapping_record := jsonb_build_object(
    'source', 'sheet',
    'mapping', p_mapping->'mapping',
    'merge_rules', p_merge_rules,
    'legacy_values', v_legacy,
    'migrated_at', now(),
    'migrated_by', (SELECT auth.uid())
  );

  -- Upsert character_attributes
  IF v_existing IS NULL THEN
    INSERT INTO public.character_attributes (
      character_id, agi, "for", int, pre, vig,
      agi_bonus, for_bonus, int_bonus, pre_bonus, vig_bonus,
      pv_now, pv_max, alma_now, alma_max, defense,
      legacy_mapping
    ) VALUES (
      p_character_id, v_base_agi, v_base_for, v_base_int, v_base_pre, v_base_vig,
      0, 0, 0, 0, 0,
      v_pv_now, v_pv_max, v_alma_now, v_alma_max, v_defense,
      v_mapping_record
    ) RETURNING * INTO v_attrs;
  ELSE
    UPDATE public.character_attributes SET
      agi = v_base_agi, "for" = v_base_for, int = v_base_int, pre = v_base_pre, vig = v_base_vig,
      pv_max = v_pv_max, alma_max = v_alma_max, defense = v_defense,
      pv_now = LEAST(v_existing.pv_now, v_pv_max),
      alma_now = LEAST(v_existing.alma_now, v_alma_max),
      legacy_mapping = v_mapping_record
    WHERE character_id = p_character_id
    RETURNING * INTO v_attrs;
  END IF;

  RETURN v_attrs;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.migrate_legacy_character(uuid, jsonb, jsonb, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.migrate_legacy_character(uuid, jsonb, jsonb, boolean) TO authenticated;

-- 5. View para listar personagens que precisam de migração
CREATE OR REPLACE VIEW public.characters_needing_migration AS
SELECT
  c.id,
  c.name,
  c.campaign_id,
  c.stage,
  c.sheet->'attributes' AS legacy_attributes,
  c.sheet#>>'{pv,now}' AS pv_now,
  c.sheet#>>'{pv,max}' AS pv_max,
  c.sheet#>>'{alma,now}' AS alma_now,
  c.sheet#>>'{alma,max}' AS alma_max,
  ca.character_id IS NOT NULL AS has_attributes
FROM public.characters c
LEFT JOIN public.character_attributes ca ON ca.character_id = c.id
WHERE jsonb_typeof(c.sheet->'attributes') = 'object'
  AND (ca.character_id IS NULL OR ca.legacy_mapping = '{}'::jsonb);

COMMENT ON VIEW public.characters_needing_migration IS
  'Personagens com atributos legados no JSONB que ainda não têm character_attributes migrados.';

-- 6. RLS para a view (herda das tabelas base)
ALTER VIEW public.characters_needing_migration SET (security_invoker = true);

-- 7. Grant
GRANT SELECT ON public.characters_needing_migration TO authenticated;

-- 8. Índice para busca rápida de não migrados
CREATE INDEX IF NOT EXISTS character_attributes_legacy_mapping_idx
  ON public.character_attributes(character_id) WHERE legacy_mapping = '{}'::jsonb;