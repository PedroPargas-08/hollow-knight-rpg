-- Migration 6: Phase 3 Game Mechanics (Combat, Abilities, Conditions, Equipment)
-- Created: 2026-10-27
-- Dependencies: 20261024000002_campaign_scoped_co_masters.sql

--------------------------------------------------------------------------------
-- 1. CHARACTER ATTRIBUTES
-- Separate table for attributes to enable proper indexing and querying
--------------------------------------------------------------------------------

CREATE TABLE public.character_attributes (
  character_id uuid PRIMARY KEY REFERENCES public.characters(id) ON DELETE CASCADE,

  -- Base attributes (1-30)
  agi smallint NOT NULL DEFAULT 10 CHECK (agi BETWEEN 1 AND 30),
  "for" smallint NOT NULL DEFAULT 10 CHECK ("for" BETWEEN 1 AND 30),
  int smallint NOT NULL DEFAULT 10 CHECK (int BETWEEN 1 AND 30),
  pre smallint NOT NULL DEFAULT 10 CHECK (pre BETWEEN 1 AND 30),
  vig smallint NOT NULL DEFAULT 10 CHECK (vig BETWEEN 1 AND 30),

  -- Attribute bonuses from equipment/conditions (-10 to +10)
  agi_bonus smallint NOT NULL DEFAULT 0 CHECK (agi_bonus BETWEEN -10 AND 10),
  for_bonus smallint NOT NULL DEFAULT 0 CHECK (for_bonus BETWEEN -10 AND 10),
  int_bonus smallint NOT NULL DEFAULT 0 CHECK (int_bonus BETWEEN -10 AND 10),
  pre_bonus smallint NOT NULL DEFAULT 0 CHECK (pre_bonus BETWEEN -10 AND 10),
  vig_bonus smallint NOT NULL DEFAULT 0 CHECK (vig_bonus BETWEEN -10 AND 10),

  -- Current resources (0-999)
  pv_now smallint NOT NULL DEFAULT 10 CHECK (pv_now BETWEEN 0 AND 999),
  pv_max smallint NOT NULL DEFAULT 10 CHECK (pv_max BETWEEN 0 AND 999),
  alma_now smallint NOT NULL DEFAULT 5 CHECK (alma_now BETWEEN 0 AND 999),
  alma_max smallint NOT NULL DEFAULT 5 CHECK (alma_max BETWEEN 0 AND 999),

  -- Derived stats (recalculated from attributes)
  defense smallint NOT NULL DEFAULT 10 CHECK (defense BETWEEN 0 AND 99),

  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT pv_now_lte_max CHECK (pv_now <= pv_max),
  CONSTRAINT alma_now_lte_max CHECK (alma_now <= alma_max)
);

COMMENT ON TABLE public.character_attributes IS 'Character attributes, resources, and derived stats';

CREATE INDEX character_attributes_updated_idx ON public.character_attributes(updated_at DESC);

-- Trigger to update updated_at
CREATE TRIGGER character_attributes_touch
  BEFORE UPDATE ON public.character_attributes
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

--------------------------------------------------------------------------------
-- 2. EQUIPMENT DEFINITIONS
-- Reusable item templates (weapons, armor, accessories, consumables)
--------------------------------------------------------------------------------

CREATE TABLE public.equipment_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),

  -- Item type: weapon, armor, accessory, consumable
  item_type text NOT NULL CHECK (item_type IN ('weapon', 'armor', 'accessory', 'consumable')),

  -- Rarity: comum, incomum, raro, epico, lendario
  rarity text NOT NULL DEFAULT 'comum' CHECK (rarity IN ('comum', 'incomum', 'raro', 'epico', 'lendario')),

  -- Value in Conchas (whole numbers only)
  value_geo int NOT NULL DEFAULT 0 CHECK (value_geo >= 0),

  -- Weight for encumbrance (0-1000, can be 0 for weightless items)
  weight smallint NOT NULL DEFAULT 0 CHECK (weight BETWEEN 0 AND 1000),

  -- Equipment slot (null for consumables)
  slot text CHECK (slot IS NULL OR slot IN ('arma_principal', 'arma_secundaria', 'armadura', 'amuleto', 'encanto1', 'encanto2', 'encanto3')),

  -- JSONB data specific to item type
  -- weapon: {damageRoll: {quantity, sides, bonus}, damageType, properties: {twoHanded?, finesse?, reach?, ranged?, versatile?}, requirements?: {minStage?, attributes?}}
  -- armor: {defenseBonus, movementPenalty}
  -- accessory: {attributeBonuses?, defenseBonuses?, pvBonus?, almaBonus?, grantsAbilities?: uuid[], effects?: {resistances?, vulnerabilities?, immunities?}}
  -- consumable: {effects: {healPV?, restoreAlma?, buffAttributes?, cureConditions?, damage?, special?}, singleUse: boolean}
  data jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object'),

  -- Metadata
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_official boolean NOT NULL DEFAULT false, -- true for game-provided items
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.equipment_definitions IS 'Reusable equipment templates (weapons, armor, accessories, consumables)';

CREATE INDEX equipment_definitions_type_idx ON public.equipment_definitions(item_type);
CREATE INDEX equipment_definitions_rarity_idx ON public.equipment_definitions(rarity);
CREATE INDEX equipment_definitions_official_idx ON public.equipment_definitions(is_official) WHERE is_official = true;

--------------------------------------------------------------------------------
-- 3. CHARACTER EQUIPMENT (Inventory)
-- Instances of equipment owned by characters
--------------------------------------------------------------------------------

CREATE TABLE public.character_equipment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  equipment_id uuid NOT NULL REFERENCES public.equipment_definitions(id) ON DELETE RESTRICT,

  quantity smallint NOT NULL DEFAULT 1 CHECK (quantity >= 0),

  -- Equipped status: null (not equipped) or slot name
  equipped_slot text CHECK (equipped_slot IS NULL OR equipped_slot IN ('arma_principal', 'arma_secundaria', 'armadura', 'amuleto', 'encanto1', 'encanto2', 'encanto3')),

  -- Custom data for this specific instance (e.g., charges remaining, durability)
  instance_data jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(instance_data) = 'object'),

  created_at timestamptz NOT NULL DEFAULT now(),

  -- Cannot equip same slot twice for same character
  CONSTRAINT unique_equipped_slot UNIQUE (character_id, equipped_slot) DEFERRABLE INITIALLY DEFERRED
);

COMMENT ON TABLE public.character_equipment IS 'Character inventory - instances of equipment owned';

CREATE INDEX character_equipment_character_idx ON public.character_equipment(character_id);
CREATE INDEX character_equipment_equipped_idx ON public.character_equipment(character_id, equipped_slot) WHERE equipped_slot IS NOT NULL;

--------------------------------------------------------------------------------
-- 4. ABILITY DEFINITIONS
-- Reusable ability templates
--------------------------------------------------------------------------------

CREATE TABLE public.ability_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),

  -- Ability type: ativa, passiva, reacao
  ability_type text NOT NULL CHECK (ability_type IN ('ativa', 'passiva', 'reacao')),

  -- Requirements
  requirements jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(requirements) = 'object'),
  -- {minStage?: number, attributes?: {AGI?: number, FOR?: number, ...}, prerequisiteAbilities?: uuid[]}

  -- Cost
  cost jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(cost) = 'object'),
  -- {alma?: number, pv?: number, cooldownTurns?: number, usesPerRest?: number}

  -- Range and targeting
  range jsonb DEFAULT '{}' CHECK (range IS NULL OR jsonb_typeof(range) = 'object'),
  -- {min?: number, max?: number} in meters

  target_type text NOT NULL DEFAULT 'self' CHECK (target_type IN ('self', 'single', 'area', 'cone', 'line', 'all_allies', 'all_enemies')),

  aoe jsonb CHECK (aoe IS NULL OR jsonb_typeof(aoe) = 'object'),
  -- {shape: 'circle'|'cone'|'line'|'square', size: number}

  -- Effects array
  effects jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(effects) = 'array'),
  -- [{type: 'dano'|'cura'|'buff'|'debuff'|'condicao'|'movimento'|'utilidade', damageType?, roll?, attributeMod?, conditionId?, duration?, description}]

  -- Metadata
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_official boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ability_definitions IS 'Reusable ability templates';

CREATE INDEX ability_definitions_type_idx ON public.ability_definitions(ability_type);
CREATE INDEX ability_definitions_official_idx ON public.ability_definitions(is_official) WHERE is_official = true;

--------------------------------------------------------------------------------
-- 5. CHARACTER ABILITIES
-- Abilities known by characters
--------------------------------------------------------------------------------

CREATE TABLE public.character_abilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  ability_id uuid NOT NULL REFERENCES public.ability_definitions(id) ON DELETE RESTRICT,

  -- Usage tracking (reset on rest)
  uses_remaining smallint CHECK (uses_remaining IS NULL OR uses_remaining >= 0),
  cooldown_remaining smallint NOT NULL DEFAULT 0 CHECK (cooldown_remaining >= 0),

  learned_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_character_ability UNIQUE (character_id, ability_id)
);

COMMENT ON TABLE public.character_abilities IS 'Abilities known by each character';

CREATE INDEX character_abilities_character_idx ON public.character_abilities(character_id);

--------------------------------------------------------------------------------
-- 6. CONDITION DEFINITIONS
-- Reusable status condition templates
--------------------------------------------------------------------------------

CREATE TABLE public.condition_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  name text NOT NULL UNIQUE CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),

  -- Condition type identifier (matches ConditionType in conditions.ts)
  condition_type text NOT NULL UNIQUE CHECK (char_length(btrim(condition_type)) BETWEEN 1 AND 40),

  -- Effects array
  effects jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(effects) = 'array'),
  -- [{type: 'attribute_mod'|'damage_over_time'|'movement_mod'|'action_restriction'|'special', ...}]

  -- Stacking rules
  can_stack boolean NOT NULL DEFAULT false,
  max_stacks smallint CHECK (max_stacks IS NULL OR max_stacks > 0),
  stacking_behavior text CHECK (stacking_behavior IS NULL OR stacking_behavior IN ('refresh', 'extend', 'intensify')),

  -- Metadata
  is_official boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.condition_definitions IS 'Reusable status condition templates';

CREATE INDEX condition_definitions_type_idx ON public.condition_definitions(condition_type);

--------------------------------------------------------------------------------
-- 7. CHARACTER CONDITIONS
-- Active conditions on characters
--------------------------------------------------------------------------------

CREATE TABLE public.character_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id uuid NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  condition_id uuid NOT NULL REFERENCES public.condition_definitions(id) ON DELETE RESTRICT,

  -- Severity: leve, moderada, severa, critica
  severity text NOT NULL DEFAULT 'moderada' CHECK (severity IN ('leve', 'moderada', 'severa', 'critica')),

  stacks smallint NOT NULL DEFAULT 1 CHECK (stacks > 0),

  -- Duration in turns (-1 = permanent until removed)
  duration_remaining smallint NOT NULL DEFAULT 1 CHECK (duration_remaining >= -1),

  -- Source information
  source_ability_id uuid REFERENCES public.ability_definitions(id) ON DELETE SET NULL,
  applied_by uuid REFERENCES public.characters(id) ON DELETE SET NULL,

  applied_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_character_condition UNIQUE (character_id, condition_id)
);

COMMENT ON TABLE public.character_conditions IS 'Active conditions affecting characters';

CREATE INDEX character_conditions_character_idx ON public.character_conditions(character_id);
CREATE INDEX character_conditions_duration_idx ON public.character_conditions(duration_remaining) WHERE duration_remaining > 0;

--------------------------------------------------------------------------------
-- 8. COMBAT ENCOUNTERS
-- Combat instances
--------------------------------------------------------------------------------

CREATE TABLE public.combat_encounters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 1000),

  -- Status: preparing, active, paused, ended
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing', 'active', 'paused', 'ended')),

  -- Current turn tracking
  current_round smallint NOT NULL DEFAULT 0 CHECK (current_round >= 0),
  current_turn_order smallint NOT NULL DEFAULT 0 CHECK (current_turn_order >= 0),

  -- Metadata
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.combat_encounters IS 'Combat encounters in campaigns';

CREATE INDEX combat_encounters_campaign_idx ON public.combat_encounters(campaign_id);
CREATE INDEX combat_encounters_status_idx ON public.combat_encounters(status) WHERE status IN ('active', 'paused');

CREATE TRIGGER combat_encounters_touch
  BEFORE UPDATE ON public.combat_encounters
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

--------------------------------------------------------------------------------
-- 9. COMBAT PARTICIPANTS
-- Characters and NPCs in combat
--------------------------------------------------------------------------------

CREATE TABLE public.combat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.combat_encounters(id) ON DELETE CASCADE,

  -- Either a player character or NPC (name only for NPCs)
  character_id uuid REFERENCES public.characters(id) ON DELETE CASCADE,
  npc_name text CHECK (char_length(btrim(npc_name)) BETWEEN 1 AND 80),

  -- Exactly one must be set
  CONSTRAINT participant_identity CHECK (
    (character_id IS NOT NULL AND npc_name IS NULL) OR
    (character_id IS NULL AND npc_name IS NOT NULL)
  ),

  -- Initiative roll result
  initiative smallint NOT NULL CHECK (initiative BETWEEN -10 AND 99),

  -- Turn order (lower = earlier, unique within encounter)
  turn_order smallint NOT NULL CHECK (turn_order >= 0),

  -- Team: ally, enemy, neutral
  team text NOT NULL DEFAULT 'ally' CHECK (team IN ('ally', 'enemy', 'neutral')),

  -- Current state snapshot (for NPCs without character sheets)
  current_pv smallint CHECK (current_pv BETWEEN 0 AND 999),
  current_alma smallint CHECK (current_alma BETWEEN 0 AND 999),

  -- Defeated status
  is_defeated boolean NOT NULL DEFAULT false,
  defeated_at timestamptz,

  joined_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_participant UNIQUE (encounter_id, character_id),
  CONSTRAINT unique_turn_order UNIQUE (encounter_id, turn_order)
);

COMMENT ON TABLE public.combat_participants IS 'Participants in combat encounters';

CREATE INDEX combat_participants_encounter_idx ON public.combat_participants(encounter_id, turn_order);
CREATE INDEX combat_participants_character_idx ON public.combat_participants(character_id);

--------------------------------------------------------------------------------
-- 10. COMBAT ACTIONS
-- History of actions taken in combat
--------------------------------------------------------------------------------

CREATE TABLE public.combat_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.combat_encounters(id) ON DELETE CASCADE,

  round_number smallint NOT NULL CHECK (round_number > 0),
  participant_id uuid NOT NULL REFERENCES public.combat_participants(id) ON DELETE CASCADE,

  -- Action type: attack, ability, move, item, defend, other
  action_type text NOT NULL CHECK (action_type IN ('attack', 'ability', 'move', 'item', 'defend', 'other')),

  -- References (optional)
  ability_id uuid REFERENCES public.ability_definitions(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.equipment_definitions(id) ON DELETE SET NULL,

  -- Targets (can be multiple)
  target_ids uuid[] NOT NULL DEFAULT '{}',

  -- Roll results
  roll_result jsonb CHECK (roll_result IS NULL OR jsonb_typeof(roll_result) = 'object'),
  -- {rolls: number[], bonus: number, total: number, isCritical?: boolean}

  -- Damage/healing dealt
  damage_dealt jsonb CHECK (damage_dealt IS NULL OR jsonb_typeof(damage_dealt) = 'object'),
  -- {amount: number, type: string, targets: {characterId: uuid, actual: number}[]}

  -- Narrative description
  description text NOT NULL CHECK (char_length(description) <= 500),

  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.combat_actions IS 'History of actions in combat';

CREATE INDEX combat_actions_encounter_idx ON public.combat_actions(encounter_id, round_number DESC, created_at DESC);
CREATE INDEX combat_actions_participant_idx ON public.combat_actions(participant_id);

--------------------------------------------------------------------------------
-- 11. INITIAL DATA - Official Equipment
--------------------------------------------------------------------------------

INSERT INTO public.equipment_definitions (name, description, item_type, rarity, value_geo, weight, slot, data, is_official) VALUES
  (
    'Espinho Básico',
    'Uma lâmina simples forjada do espinho de um inseto.',
    'weapon',
    'comum',
    50,
    10,
    'arma_principal',
    '{"damageRoll":{"quantity":1,"sides":6,"bonus":0},"damageType":"fisico","properties":{"twoHanded":false,"finesse":false,"reach":false,"ranged":false,"versatile":false}}',
    true
  ),
  (
    'Carapaça Básica',
    'Armadura leve feita de fragmentos de carapaça.',
    'armor',
    'comum',
    100,
    30,
    'armadura',
    '{"defenseBonus":0,"movementPenalty":0}',
    true
  ),
  (
    'Frasco de Cura',
    'Um frasco contendo essência curativa.',
    'consumable',
    'comum',
    50,
    5,
    null,
    '{"effects":{"healPV":20},"singleUse":true}',
    true
  );

--------------------------------------------------------------------------------
-- 12. INITIAL DATA - Official Conditions
--------------------------------------------------------------------------------

INSERT INTO public.condition_definitions (name, description, condition_type, effects, can_stack, max_stacks, stacking_behavior, is_official) VALUES
  (
    'Envenenado',
    'Sofre dano contínuo a cada turno.',
    'envenenado',
    '[{"type":"damage_over_time","damagePerTurn":2,"damageType":"veneno","saveAttribute":"VIG","saveDC":12}]',
    true,
    5,
    'extend',
    true
  ),
  (
    'Atordoado',
    'Não pode realizar ações. Remove ao receber dano.',
    'atordoado',
    '[{"type":"action_restriction","cannotAttack":true,"cannotCast":true,"cannotMove":true,"cannotReact":true}]',
    false,
    null,
    null,
    true
  ),
  (
    'Imobilizado',
    'Não pode se mover.',
    'imobilizado',
    '[{"type":"movement_mod","multiplier":0},{"type":"special","effect":"saveAttribute","attribute":"FOR","dc":13}]',
    false,
    null,
    null,
    true
  ),
  (
    'Protegido',
    'Recebe bônus de agilidade.',
    'protegido',
    '[{"type":"attribute_mod","attribute":"AGI","modifier":2}]',
    false,
    null,
    null,
    true
  ),
  (
    'Amedrontado',
    'Penalidades em força e presença.',
    'amedrontado',
    '[{"type":"attribute_mod","attribute":"FOR","modifier":-2},{"type":"attribute_mod","attribute":"PRE","modifier":-2},{"type":"special","effect":"saveAttribute","attribute":"PRE","dc":14}]',
    false,
    null,
    null,
    true
  ),
  (
    'Queimando',
    'Sofre dano de fogo a cada turno.',
    'queimando',
    '[{"type":"damage_over_time","damagePerTurn":3,"damageType":"fogo"}]',
    true,
    3,
    'refresh',
    true
  );

--------------------------------------------------------------------------------
-- 13. RLS POLICIES
--------------------------------------------------------------------------------

-- character_attributes: same visibility as characters
ALTER TABLE public.character_attributes ENABLE ROW LEVEL SECURITY;

CREATE POLICY character_attributes_select ON public.character_attributes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_attributes.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

CREATE POLICY character_attributes_insert ON public.character_attributes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_attributes.character_id
      AND c.owner_id = auth.uid()
      AND private.is_campaign_member(c.campaign_id)
    )
  );

CREATE POLICY character_attributes_update ON public.character_attributes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_attributes.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

CREATE POLICY character_attributes_delete ON public.character_attributes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_attributes.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

-- equipment_definitions: readable by all authenticated, writable by masters only
ALTER TABLE public.equipment_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_definitions_select ON public.equipment_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY equipment_definitions_insert ON public.equipment_definitions
  FOR INSERT WITH CHECK (private.is_master() AND created_by = auth.uid());

CREATE POLICY equipment_definitions_update ON public.equipment_definitions
  FOR UPDATE USING (private.is_master() AND created_by = auth.uid());

CREATE POLICY equipment_definitions_delete ON public.equipment_definitions
  FOR DELETE USING (private.is_master() AND created_by = auth.uid() AND is_official = false);

-- character_equipment: same visibility as characters
ALTER TABLE public.character_equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY character_equipment_select ON public.character_equipment
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_equipment.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

CREATE POLICY character_equipment_insert ON public.character_equipment
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_equipment.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

CREATE POLICY character_equipment_update ON public.character_equipment
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_equipment.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

CREATE POLICY character_equipment_delete ON public.character_equipment
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_equipment.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

-- ability_definitions: readable by all authenticated, writable by masters only
ALTER TABLE public.ability_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY ability_definitions_select ON public.ability_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY ability_definitions_insert ON public.ability_definitions
  FOR INSERT WITH CHECK (private.is_master() AND created_by = auth.uid());

CREATE POLICY ability_definitions_update ON public.ability_definitions
  FOR UPDATE USING (private.is_master() AND created_by = auth.uid());

CREATE POLICY ability_definitions_delete ON public.ability_definitions
  FOR DELETE USING (private.is_master() AND created_by = auth.uid() AND is_official = false);

-- character_abilities: same visibility as characters
ALTER TABLE public.character_abilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY character_abilities_select ON public.character_abilities
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_abilities.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

CREATE POLICY character_abilities_insert ON public.character_abilities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_abilities.character_id
      AND private.is_campaign_admin(c.campaign_id)
    )
  );

CREATE POLICY character_abilities_update ON public.character_abilities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_abilities.character_id
      AND private.is_campaign_admin(c.campaign_id)
    )
  );

CREATE POLICY character_abilities_delete ON public.character_abilities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_abilities.character_id
      AND private.is_campaign_admin(c.campaign_id)
    )
  );

-- condition_definitions: readable by all authenticated
ALTER TABLE public.condition_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY condition_definitions_select ON public.condition_definitions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- character_conditions: same visibility as characters
ALTER TABLE public.character_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY character_conditions_select ON public.character_conditions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_conditions.character_id
      AND (
        (c.owner_id = auth.uid() AND private.is_campaign_member(c.campaign_id))
        OR private.is_campaign_admin(c.campaign_id)
      )
    )
  );

CREATE POLICY character_conditions_insert ON public.character_conditions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_conditions.character_id
      AND private.is_campaign_admin(c.campaign_id)
    )
  );

CREATE POLICY character_conditions_update ON public.character_conditions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_conditions.character_id
      AND private.is_campaign_admin(c.campaign_id)
    )
  );

CREATE POLICY character_conditions_delete ON public.character_conditions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.characters c
      WHERE c.id = character_conditions.character_id
      AND private.is_campaign_admin(c.campaign_id)
    )
  );

-- combat_encounters: visible to campaign members, writable by admins
ALTER TABLE public.combat_encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY combat_encounters_select ON public.combat_encounters
  FOR SELECT USING (private.is_campaign_member(campaign_id));

CREATE POLICY combat_encounters_insert ON public.combat_encounters
  FOR INSERT WITH CHECK (private.is_campaign_admin(campaign_id) AND created_by = auth.uid());

CREATE POLICY combat_encounters_update ON public.combat_encounters
  FOR UPDATE USING (private.is_campaign_admin(campaign_id));

CREATE POLICY combat_encounters_delete ON public.combat_encounters
  FOR DELETE USING (private.is_campaign_admin(campaign_id));

-- combat_participants: visible to encounter viewers
ALTER TABLE public.combat_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY combat_participants_select ON public.combat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.combat_encounters e
      WHERE e.id = combat_participants.encounter_id
      AND private.is_campaign_member(e.campaign_id)
    )
  );

CREATE POLICY combat_participants_insert ON public.combat_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.combat_encounters e
      WHERE e.id = combat_participants.encounter_id
      AND private.is_campaign_admin(e.campaign_id)
    )
  );

CREATE POLICY combat_participants_update ON public.combat_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.combat_encounters e
      WHERE e.id = combat_participants.encounter_id
      AND private.is_campaign_admin(e.campaign_id)
    )
  );

CREATE POLICY combat_participants_delete ON public.combat_participants
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.combat_encounters e
      WHERE e.id = combat_participants.encounter_id
      AND private.is_campaign_admin(e.campaign_id)
    )
  );

-- combat_actions: visible to encounter viewers, insertable by participants
ALTER TABLE public.combat_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY combat_actions_select ON public.combat_actions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.combat_encounters e
      WHERE e.id = combat_actions.encounter_id
      AND private.is_campaign_member(e.campaign_id)
    )
  );

CREATE POLICY combat_actions_insert ON public.combat_actions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.combat_encounters e
      JOIN public.combat_participants p ON p.encounter_id = e.id
      WHERE e.id = combat_actions.encounter_id
      AND p.id = combat_actions.participant_id
      AND private.is_campaign_member(e.campaign_id)
    )
  );

--------------------------------------------------------------------------------
-- 14. COLUMN-LEVEL GRANTS
--------------------------------------------------------------------------------

-- Revoke default privileges
REVOKE ALL ON public.character_attributes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.equipment_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.character_equipment FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.ability_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.character_abilities FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.condition_definitions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.character_conditions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.combat_encounters FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.combat_participants FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.combat_actions FROM PUBLIC, anon, authenticated;

-- character_attributes: players can read all, update current resources only; admins update all
GRANT SELECT ON public.character_attributes TO authenticated;
GRANT INSERT (character_id, agi, "for", int, pre, vig, pv_now, pv_max, alma_now, alma_max, defense) ON public.character_attributes TO authenticated;
GRANT UPDATE (pv_now, alma_now) ON public.character_attributes TO authenticated;
GRANT DELETE ON public.character_attributes TO authenticated;

-- equipment_definitions: all can read, masters can write
GRANT SELECT ON public.equipment_definitions TO authenticated;
GRANT INSERT (name, description, item_type, rarity, value_geo, weight, slot, data, created_by) ON public.equipment_definitions TO authenticated;
GRANT UPDATE (name, description, item_type, rarity, value_geo, weight, slot, data) ON public.equipment_definitions TO authenticated;
GRANT DELETE ON public.equipment_definitions TO authenticated;

-- character_equipment: full CRUD for authorized users
GRANT SELECT, DELETE ON public.character_equipment TO authenticated;
GRANT INSERT (character_id, equipment_id, quantity, equipped_slot, instance_data) ON public.character_equipment TO authenticated;
GRANT UPDATE (quantity, equipped_slot, instance_data) ON public.character_equipment TO authenticated;

-- ability_definitions: all can read, masters can write
GRANT SELECT ON public.ability_definitions TO authenticated;
GRANT INSERT (name, description, ability_type, requirements, cost, range, target_type, aoe, effects, created_by) ON public.ability_definitions TO authenticated;
GRANT UPDATE (name, description, ability_type, requirements, cost, range, target_type, aoe, effects) ON public.ability_definitions TO authenticated;
GRANT DELETE ON public.ability_definitions TO authenticated;

-- character_abilities: admins manage
GRANT SELECT, DELETE ON public.character_abilities TO authenticated;
GRANT INSERT (character_id, ability_id, uses_remaining, cooldown_remaining) ON public.character_abilities TO authenticated;
GRANT UPDATE (uses_remaining, cooldown_remaining) ON public.character_abilities TO authenticated;

-- condition_definitions: read-only for all
GRANT SELECT ON public.condition_definitions TO authenticated;

-- character_conditions: admins manage
GRANT SELECT, DELETE ON public.character_conditions TO authenticated;
GRANT INSERT (character_id, condition_id, severity, stacks, duration_remaining, source_ability_id, applied_by) ON public.character_conditions TO authenticated;
GRANT UPDATE (severity, stacks, duration_remaining) ON public.character_conditions TO authenticated;

-- combat_encounters: campaign members read, admins write
GRANT SELECT, DELETE ON public.combat_encounters TO authenticated;
GRANT INSERT (campaign_id, name, description, status, created_by) ON public.combat_encounters TO authenticated;
GRANT UPDATE (name, description, status, current_round, current_turn_order, started_at, ended_at) ON public.combat_encounters TO authenticated;

-- combat_participants: campaign members read, admins write
GRANT SELECT, DELETE ON public.combat_participants TO authenticated;
GRANT INSERT (encounter_id, character_id, npc_name, initiative, turn_order, team, current_pv, current_alma) ON public.combat_participants TO authenticated;
GRANT UPDATE (initiative, turn_order, current_pv, current_alma, is_defeated, defeated_at) ON public.combat_participants TO authenticated;

-- combat_actions: campaign members read, participants insert
GRANT SELECT ON public.combat_actions TO authenticated;
GRANT INSERT (encounter_id, round_number, participant_id, action_type, ability_id, item_id, target_ids, roll_result, damage_dealt, description) ON public.combat_actions TO authenticated;
