-- =====================================================================
-- Fase 4 · Migration 2/5 — Mapas, Regiões e Marcadores
-- Dependencies: 20261028000001_phase4_legacy_compat.sql
-- =====================================================================

--------------------------------------------------------------------------------
-- 1. MAPS
-- Campaign-scoped maps with layers for fog of war and GM notes
--------------------------------------------------------------------------------

CREATE TABLE public.maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,

  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),

  -- Image reference (stored in Supabase Storage or external URL)
  image_url text CHECK (char_length(image_url) <= 500),
  image_width int CHECK (image_width > 0),
  image_height int CHECK (image_height > 0),

  -- Grid settings
  grid_type text NOT NULL DEFAULT 'square' CHECK (grid_type IN ('square', 'hex', 'none')),
  grid_size int NOT NULL DEFAULT 50 CHECK (grid_size BETWEEN 10 AND 500), -- pixels per cell
  grid_offset_x int NOT NULL DEFAULT 0,
  grid_offset_y int NOT NULL DEFAULT 0,

  -- Fog of war
  fog_enabled boolean NOT NULL DEFAULT true,
  fog_color text NOT NULL DEFAULT '#000000' CHECK (char_length(fog_color) = 7),
  fog_opacity real NOT NULL DEFAULT 0.85 CHECK (fog_opacity BETWEEN 0 AND 1),

  -- Visibility: all, players_only, gm_only
  visibility text NOT NULL DEFAULT 'all' CHECK (visibility IN ('all', 'players_only', 'gm_only')),

  -- Order for display
  sort_order int NOT NULL DEFAULT 0,

  -- Metadata
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.maps IS 'Campaign maps with grid, fog of war, and visibility settings';

CREATE INDEX maps_campaign_idx ON public.maps(campaign_id, sort_order);
CREATE INDEX maps_visibility_idx ON public.maps(campaign_id, visibility) WHERE visibility <> 'gm_only';

CREATE TRIGGER maps_touch
  BEFORE UPDATE ON public.maps
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

--------------------------------------------------------------------------------
-- 2. MAP LAYERS
-- Ordered layers on a map (tokens, fog, GM notes, grid, background)
--------------------------------------------------------------------------------

CREATE TABLE public.map_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,

  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 80),

  -- Layer type: background, grid, tokens, fog, gm_notes, measurements
  layer_type text NOT NULL CHECK (layer_type IN ('background', 'grid', 'tokens', 'fog', 'gm_notes', 'measurements')),

  -- Z-index for rendering order
  z_index int NOT NULL DEFAULT 0,

  -- Visibility
  visible boolean NOT NULL DEFAULT true,
  gm_only boolean NOT NULL DEFAULT false,

  -- Opacity (0-1)
  opacity real NOT NULL DEFAULT 1 CHECK (opacity BETWEEN 0 AND 1),

  -- Layer-specific data (JSONB)
  -- fog: {revealed_regions: uuid[], revealed_by_players: boolean}
  -- gm_notes: {entries: [{x, y, text, color, created_by, created_at}]}
  -- measurements: {lines: [{x1, y1, x2, y2, label, color, created_by}]}
  data jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(data) = 'object'),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_map_layer_type UNIQUE (map_id, layer_type)
);

COMMENT ON TABLE public.map_layers IS 'Ordered layers on a map (background, tokens, fog, GM notes, etc.)';

CREATE INDEX map_layers_map_idx ON public.map_layers(map_id, z_index);

CREATE TRIGGER map_layers_touch
  BEFORE UPDATE ON public.map_layers
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

--------------------------------------------------------------------------------
-- 3. REGIONS
-- Named areas within maps (rooms, zones, districts, etc.)
--------------------------------------------------------------------------------

CREATE TABLE public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,

  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),

  -- Region shape: polygon, circle, rectangle
  shape_type text NOT NULL DEFAULT 'polygon' CHECK (shape_type IN ('polygon', 'circle', 'rectangle')),

  -- Geometry in map coordinate space (pixels from top-left)
  -- polygon: {points: [{x, y}, ...]}
  -- circle: {center: {x, y}, radius: number}
  -- rectangle: {x, y, width, height}
  geometry jsonb NOT NULL CHECK (jsonb_typeof(geometry) = 'object'),

  -- Fill/stroke for rendering
  fill_color text CHECK (fill_color IS NULL OR char_length(fill_color) = 7),
  stroke_color text CHECK (stroke_color IS NULL OR char_length(stroke_color) = 7),
  stroke_width real NOT NULL DEFAULT 2 CHECK (stroke_width >= 0),

  -- Region properties
  is_secret boolean NOT NULL DEFAULT false, -- hidden from players until revealed
  is_restricted boolean NOT NULL DEFAULT false, -- requires permission to enter
  tags text[] NOT NULL DEFAULT '{}', -- e.g., ['dungeon', 'town', 'wilderness']

  -- Parent region for hierarchy (districts within city, rooms within dungeon)
  parent_region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,

  -- Metadata
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.regions IS 'Named regions/areas within maps with geometry and hierarchy';

CREATE INDEX regions_map_idx ON public.regions(map_id);
CREATE INDEX regions_parent_idx ON public.regions(parent_region_id);
CREATE INDEX regions_tags_idx ON public.regions USING GIN(tags);

CREATE TRIGGER regions_touch
  BEFORE UPDATE ON public.regions
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

--------------------------------------------------------------------------------
-- 4. MARKERS
-- Points of interest, NPCs, encounters, loot, notes on maps
--------------------------------------------------------------------------------

CREATE TABLE public.markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,
  region_id uuid REFERENCES public.regions(id) ON DELETE SET NULL,

  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),

  -- Marker type
  marker_type text NOT NULL CHECK (marker_type IN (
    'poi',          -- Point of interest
    'npc',          -- Non-player character
    'encounter',    -- Combat encounter location
    'loot',         -- Treasure/loot
    'secret',       -- Hidden feature (GM only)
    'note',         -- Text note
    'entrance',     -- Entrance/exit to another map/region
    'hazard',       -- Environmental hazard
    'rest',         -- Rest/safe area
    'shop',         -- Merchant/shop
    'custom'        -- User-defined
  )),

  -- Icon (emoji, lucide icon name, or custom image URL)
  icon text NOT NULL DEFAULT 'map-pin' CHECK (char_length(icon) <= 100),
  icon_color text NOT NULL DEFAULT '#3b82f6' CHECK (char_length(icon_color) = 7),
  icon_size real NOT NULL DEFAULT 1.0 CHECK (icon_size BETWEEN 0.5 AND 3.0),

  -- Position in map coordinates (pixels from top-left)
  x real NOT NULL CHECK (x >= 0),
  y real NOT NULL CHECK (y >= 0),

  -- Linked entities (optional)
  linked_character_id uuid REFERENCES public.characters(id) ON DELETE SET NULL,
  linked_encounter_id uuid REFERENCES public.combat_encounters(id) ON DELETE SET NULL,
  linked_map_id uuid REFERENCES public.maps(id) ON DELETE SET NULL, -- for entrance markers

  -- Visibility and discovery
  is_secret boolean NOT NULL DEFAULT false, -- hidden from players
  is_discovered boolean NOT NULL DEFAULT false, -- revealed to players
  discovered_by uuid[] NOT NULL DEFAULT '{}', -- player IDs who discovered
  discovered_at timestamptz,

  -- Metadata
  tags text[] NOT NULL DEFAULT '{}',
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.markers IS 'Map markers: POIs, NPCs, encounters, loot, secrets, notes, entrances';

CREATE INDEX markers_map_idx ON public.markers(map_id);
CREATE INDEX markers_region_idx ON public.markers(region_id);
CREATE INDEX markers_type_idx ON public.markers(marker_type);
CREATE INDEX markers_secret_idx ON public.markers(map_id, is_secret) WHERE is_secret = true;
CREATE INDEX markers_discovered_idx ON public.markers(map_id, is_discovered) WHERE is_discovered = true;
CREATE INDEX markers_tags_idx ON public.markers USING GIN(tags);
CREATE INDEX markers_linked_char_idx ON public.markers(linked_character_id) WHERE linked_character_id IS NOT NULL;
CREATE INDEX markers_linked_encounter_idx ON public.markers(linked_encounter_id) WHERE linked_encounter_id IS NOT NULL;

CREATE TRIGGER markers_touch
  BEFORE UPDATE ON public.markers
  FOR EACH ROW
  EXECUTE FUNCTION private.touch_updated_at();

--------------------------------------------------------------------------------
-- 5. MAP PERMISSIONS
-- Fine-grained access control for maps (beyond campaign membership)
--------------------------------------------------------------------------------

CREATE TABLE public.map_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  map_id uuid NOT NULL REFERENCES public.maps(id) ON DELETE CASCADE,

  -- Target: specific user or 'all_players' role
  target_user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_role text CHECK (target_role IN ('all_players', 'all_masters')),

  -- Exactly one target must be set
  CONSTRAINT permission_target CHECK (
    (target_user_id IS NOT NULL AND target_role IS NULL) OR
    (target_user_id IS NULL AND target_role IS NOT NULL)
  ),

  -- Permissions
  can_view boolean NOT NULL DEFAULT true,
  can_edit boolean NOT NULL DEFAULT false,
  can_manage_layers boolean NOT NULL DEFAULT false,
  can_manage_markers boolean NOT NULL DEFAULT false,
  can_reveal_fog boolean NOT NULL DEFAULT false,
  can_manage_regions boolean NOT NULL DEFAULT false,

  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT unique_map_permission UNIQUE (map_id, target_user_id, target_role)
);

COMMENT ON TABLE public.map_permissions IS 'Fine-grained map permissions per user or role';

CREATE INDEX map_permissions_map_idx ON public.map_permissions(map_id);
CREATE INDEX map_permissions_user_idx ON public.map_permissions(target_user_id);

--------------------------------------------------------------------------------
-- 6. RLS POLICIES
--------------------------------------------------------------------------------

-- MAPS
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;

-- Campaign members can view maps (respecting visibility)
CREATE POLICY maps_select ON public.maps
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = maps.campaign_id
      AND private.is_campaign_member(c.id)
      AND (
        maps.visibility = 'all'
        OR (maps.visibility = 'players_only' AND EXISTS (
          SELECT 1 FROM public.campaign_members cm
          WHERE cm.campaign_id = c.id AND cm.user_id = auth.uid() AND cm.member_role = 'jogador'
        ))
        OR (maps.visibility = 'gm_only' AND private.is_campaign_admin(c.id))
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = maps.id
          AND (mp.target_user_id = auth.uid() OR mp.target_role = 'all_players')
          AND mp.can_view = true
        )
      )
    )
  );

CREATE POLICY maps_insert ON public.maps
  FOR INSERT WITH CHECK (
    private.is_campaign_admin(campaign_id) AND created_by = auth.uid()
  );

CREATE POLICY maps_update ON public.maps
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = maps.id
      AND (
        private.is_campaign_admin(m.campaign_id)
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = m.id
          AND mp.target_user_id = auth.uid()
          AND mp.can_edit = true
        )
      )
    )
  );

CREATE POLICY maps_delete ON public.maps
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = maps.id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

-- MAP LAYERS
ALTER TABLE public.map_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY map_layers_select ON public.map_layers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = map_layers.map_id
      AND private.is_campaign_member(m.campaign_id)
      AND (
        map_layers.gm_only = false
        OR private.is_campaign_admin(m.campaign_id)
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = m.id
          AND mp.target_user_id = auth.uid()
          AND mp.can_manage_layers = true
        )
      )
    )
  );

CREATE POLICY map_layers_insert ON public.map_layers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = map_layers.map_id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

CREATE POLICY map_layers_update ON public.map_layers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.map_layers ml
      JOIN public.maps m ON m.id = ml.map_id
      WHERE ml.id = map_layers.id
      AND (
        private.is_campaign_admin(m.campaign_id)
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = m.id
          AND mp.target_user_id = auth.uid()
          AND mp.can_manage_layers = true
        )
      )
    )
  );

CREATE POLICY map_layers_delete ON public.map_layers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.map_layers ml
      JOIN public.maps m ON m.id = ml.map_id
      WHERE ml.id = map_layers.id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

-- REGIONS
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;

CREATE POLICY regions_select ON public.regions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = regions.map_id
      AND private.is_campaign_member(m.campaign_id)
      AND (
        regions.is_secret = false
        OR private.is_campaign_admin(m.campaign_id)
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = m.id
          AND mp.target_user_id = auth.uid()
          AND mp.can_manage_regions = true
        )
      )
    )
  );

CREATE POLICY regions_insert ON public.regions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = regions.map_id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

CREATE POLICY regions_update ON public.regions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.regions r
      JOIN public.maps m ON m.id = r.map_id
      WHERE r.id = regions.id
      AND (
        private.is_campaign_admin(m.campaign_id)
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = m.id
          AND mp.target_user_id = auth.uid()
          AND mp.can_manage_regions = true
        )
      )
    )
  );

CREATE POLICY regions_delete ON public.regions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.regions r
      JOIN public.maps m ON m.id = r.map_id
      WHERE r.id = regions.id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

-- MARKERS
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY markers_select ON public.markers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = markers.map_id
      AND private.is_campaign_member(m.campaign_id)
      AND (
        markers.is_secret = false
        OR markers.is_discovered = true
        OR private.is_campaign_admin(m.campaign_id)
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = m.id
          AND mp.target_user_id = auth.uid()
          AND mp.can_manage_markers = true
        )
        OR auth.uid() = ANY(markers.discovered_by)
      )
    )
  );

CREATE POLICY markers_insert ON public.markers
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = markers.map_id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

CREATE POLICY markers_update ON public.markers
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.markers mk
      JOIN public.maps m ON m.id = mk.map_id
      WHERE mk.id = markers.id
      AND (
        private.is_campaign_admin(m.campaign_id)
        OR EXISTS (
          SELECT 1 FROM public.map_permissions mp
          WHERE mp.map_id = m.id
          AND mp.target_user_id = auth.uid()
          AND mp.can_manage_markers = true
        )
      )
    )
  );

CREATE POLICY markers_delete ON public.markers
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.markers mk
      JOIN public.maps m ON m.id = mk.map_id
      WHERE mk.id = markers.id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

-- MAP PERMISSIONS
ALTER TABLE public.map_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY map_permissions_select ON public.map_permissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = map_permissions.map_id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

CREATE POLICY map_permissions_insert ON public.map_permissions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.maps m
      WHERE m.id = map_permissions.map_id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

CREATE POLICY map_permissions_update ON public.map_permissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.map_permissions mp
      JOIN public.maps m ON m.id = mp.map_id
      WHERE mp.id = map_permissions.id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

CREATE POLICY map_permissions_delete ON public.map_permissions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.map_permissions mp
      JOIN public.maps m ON m.id = mp.map_id
      WHERE mp.id = map_permissions.id
      AND private.is_campaign_admin(m.campaign_id)
    )
  );

--------------------------------------------------------------------------------
-- 7. GRANTS
--------------------------------------------------------------------------------

REVOKE ALL ON public.maps FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.map_layers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.regions FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.markers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.map_permissions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.maps TO authenticated;
GRANT INSERT (campaign_id, name, description, image_url, image_width, image_height, grid_type, grid_size, grid_offset_x, grid_offset_y, fog_enabled, fog_color, fog_opacity, visibility, sort_order, created_by) ON public.maps TO authenticated;
GRANT UPDATE (name, description, image_url, image_width, image_height, grid_type, grid_size, grid_offset_x, grid_offset_y, fog_enabled, fog_color, fog_opacity, visibility, sort_order) ON public.maps TO authenticated;
GRANT DELETE ON public.maps TO authenticated;

GRANT SELECT ON public.map_layers TO authenticated;
GRANT INSERT (map_id, name, layer_type, z_index, visible, gm_only, opacity, data) ON public.map_layers TO authenticated;
GRANT UPDATE (name, layer_type, z_index, visible, gm_only, opacity, data) ON public.map_layers TO authenticated;
GRANT DELETE ON public.map_layers TO authenticated;

GRANT SELECT ON public.regions TO authenticated;
GRANT INSERT (map_id, name, description, shape_type, geometry, fill_color, stroke_color, stroke_width, is_secret, is_restricted, tags, parent_region_id, created_by) ON public.regions TO authenticated;
GRANT UPDATE (name, description, shape_type, geometry, fill_color, stroke_color, stroke_width, is_secret, is_restricted, tags, parent_region_id) ON public.regions TO authenticated;
GRANT DELETE ON public.regions TO authenticated;

GRANT SELECT ON public.markers TO authenticated;
GRANT INSERT (map_id, region_id, name, description, marker_type, icon, icon_color, icon_size, x, y, linked_character_id, linked_encounter_id, linked_map_id, is_secret, is_discovered, discovered_by, tags, created_by) ON public.markers TO authenticated;
GRANT UPDATE (name, description, marker_type, icon, icon_color, icon_size, x, y, region_id, linked_character_id, linked_encounter_id, linked_map_id, is_secret, is_discovered, discovered_by, discovered_at, tags) ON public.markers TO authenticated;
GRANT DELETE ON public.markers TO authenticated;

GRANT SELECT ON public.map_permissions TO authenticated;
GRANT INSERT (map_id, target_user_id, target_role, can_view, can_edit, can_manage_layers, can_manage_markers, can_reveal_fog, can_manage_regions, created_by) ON public.map_permissions TO authenticated;
GRANT UPDATE (can_view, can_edit, can_manage_layers, can_manage_markers, can_reveal_fog, can_manage_regions) ON public.map_permissions TO authenticated;
GRANT DELETE ON public.map_permissions TO authenticated;