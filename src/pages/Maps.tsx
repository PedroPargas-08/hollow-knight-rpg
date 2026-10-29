import { useState, useEffect } from 'react';
import { useAuth } from '../app/auth';
import { MASTER_SECTIONS, type MasterSection } from '../app/nav';
import { Alert, Badge, Button, EmptyState, Field, LinkButton, PageHead, Panel, VisTag } from '../components/ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/overlay';
import {
  listCampaigns,
  listMaps,
  getMap,
  createMap,
  updateMap,
  deleteMap,
  listMapLayers,
  createMapLayer,
  updateMapLayer,
  deleteMapLayer,
  listRegions,
  createRegion,
  updateRegion,
  deleteRegion,
  listMarkers,
  createMarker,
  updateMarker,
  deleteMarker,
  discoverMarker,
  listMapPermissions,
  createMapPermission,
  updateMapPermission,
  deleteMapPermission,
  type Map,
  type MapLayer,
  type Region,
  type Marker,
  type MapPermission,
} from '../lib/api';
import { useAsync } from '../lib/useAsync';

const MAP_LAYER_TYPES = [
  { id: 'background', label: 'Fundo', icon: 'image' },
  { id: 'grid', label: 'Grade', icon: 'grid' },
  { id: 'tokens', label: 'Tokens', icon: 'user' },
  { id: 'fog', label: 'Névoa de Guerra', icon: 'cloud' },
  { id: 'gm_notes', label: 'Notas do Mestre', icon: 'file-text' },
  { id: 'measurements', label: 'Medidas', icon: 'ruler' },
] as const;

const MARKER_TYPES = [
  { id: 'poi', label: 'Ponto de Interesse', icon: 'map-pin' },
  { id: 'npc', label: 'NPC', icon: 'user' },
  { id: 'encounter', label: 'Encontro', icon: 'crosshair' },
  { id: 'loot', label: 'Tesouro', icon: 'gem' },
  { id: 'secret', label: 'Segredo', icon: 'eyeoff' },
  { id: 'note', label: 'Nota', icon: 'file-text' },
  { id: 'entrance', label: 'Entrada/Saída', icon: 'door-open' },
  { id: 'hazard', label: 'Perigo', icon: 'alert-triangle' },
  { id: 'rest', label: 'Descanso', icon: 'moon' },
  { id: 'shop', label: 'Loja', icon: 'shopping-bag' },
  { id: 'custom', label: 'Personalizado', icon: 'plus-circle' },
] as const;

type NewLayerState = {
  name: string;
  layer_type: MapLayer['layer_type'];
  z_index: number;
  visible: boolean;
  gm_only: boolean;
  opacity: number;
  data: Record<string, any>;
};

type NewRegionState = {
  name: string;
  description: string;
  shape_type: 'polygon' | 'circle' | 'rectangle';
  geometry: Record<string, any>;
  fill_color: string | null;
  stroke_color: string | null;
  stroke_width: number;
  is_secret: boolean;
  is_restricted: boolean;
  tags: string[];
  parent_region_id: string | null;
};

type NewMarkerState = {
  name: string;
  description: string;
  marker_type: Marker['marker_type'];
  icon: string;
  icon_color: string;
  icon_size: number;
  x: number;
  y: number;
  region_id: string | null;
  linked_character_id: string | null;
  linked_encounter_id: string | null;
  linked_map_id: string | null;
  is_secret: boolean;
  is_discovered: boolean;
  discovered_by: string[];
  discovered_at: string | null;
  tags: string[];
};

type NewPermissionState = {
  target_user_id: string | null;
  target_role: 'all_players' | 'all_masters' | null;
  can_view: boolean;
  can_edit: boolean;
  can_manage_layers: boolean;
  can_manage_markers: boolean;
  can_reveal_fog: boolean;
  can_manage_regions: boolean;
};

export function MapsPage() {
  const { profile } = useAuth();
  const camps = useAsync(listCampaigns, []);
  const mine = (camps.data ?? []).filter((c) => c.owner_id === profile!.id);
  const [pick, setPick] = useState<string>('');
  const camp = mine.find((c) => c.id === pick) ?? mine[0];
  const [activeMapTab, setActiveMapTab] = useState<'layers' | 'regions' | 'markers' | 'permissions'>('layers');

  // Maps state
  const [maps, setMaps] = useState<Map[]>([]);
  const [loadingMaps, setLoadingMaps] = useState(false);
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const [showCreateMap, setShowCreateMap] = useState(false);
  const [newMap, setNewMap] = useState({
    name: '',
    description: '',
    grid_type: 'square' as 'square' | 'hex' | 'none',
    grid_size: 50,
    fog_enabled: true,
    fog_color: '#000000',
    fog_opacity: 0.85,
    visibility: 'all' as 'all' | 'players_only' | 'gm_only',
    sort_order: 0,
    image_url: null as string | null,
    image_width: null as number | null,
    image_height: null as number | null,
    grid_offset_x: 0,
    grid_offset_y: 0,
  });

  // Layers state
  const [layers, setLayers] = useState<MapLayer[]>([]);
  const [loadingLayers, setLoadingLayers] = useState(false);
  const [showCreateLayer, setShowCreateLayer] = useState(false);
  const [newLayer, setNewLayer] = useState({
    name: '',
    layer_type: 'tokens' as MapLayer['layer_type'],
    z_index: 0,
    visible: true,
    gm_only: false,
    opacity: 1,
    data: {} as Record<string, any>,
  });

  // Regions state
  const [regions, setRegions] = useState<Region[]>([]);
  const [loadingRegions, setLoadingRegions] = useState(false);
  const [showCreateRegion, setShowCreateRegion] = useState(false);
  const [newRegion, setNewRegion] = useState({
    name: '',
    description: '',
    shape_type: 'polygon' as 'polygon' | 'circle' | 'rectangle',
    geometry: {} as Record<string, any>,
    fill_color: null as string | null,
    stroke_color: null as string | null,
    stroke_width: 2,
    is_secret: false,
    is_restricted: false,
    tags: [] as string[],
    parent_region_id: null as string | null,
  });

  // Markers state
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [loadingMarkers, setLoadingMarkers] = useState(false);
  const [showCreateMarker, setShowCreateMarker] = useState(false);
  const [newMarker, setNewMarker] = useState({
    name: '',
    description: '',
    marker_type: 'poi' as Marker['marker_type'],
    icon: 'map-pin',
    icon_color: '#3b82f6',
    icon_size: 1.0,
    x: 0,
    y: 0,
    region_id: null as string | null,
    linked_character_id: null as string | null,
    linked_encounter_id: null as string | null,
    linked_map_id: null as string | null,
    is_secret: false,
    is_discovered: false,
    discovered_by: [] as string[],
    discovered_at: null as string | null,
    tags: [] as string[],
  });

  // Permissions state
  const [permissions, setPermissions] = useState<MapPermission[]>([]);
  const [loadingPermissions, setLoadingPermissions] = useState(false);
  const [showCreatePermission, setShowCreatePermission] = useState(false);
  const [newPermission, setNewPermission] = useState({
    target_user_id: null as string | null,
    target_role: 'all_players' as 'all_players' | 'all_masters' | null,
    can_view: true,
    can_edit: false,
    can_manage_layers: false,
    can_manage_markers: false,
    can_reveal_fog: false,
    can_manage_regions: false,
  });

  // Load maps when camp changes
  useEffect(() => {
    if (camp?.id) {
      setLoadingMaps(true);
      listMaps(camp.id).then(setMaps).finally(() => setLoadingMaps(false));
    } else {
      setMaps([]);
    }
  }, [camp?.id]);

  // Load layers when map changes
  useEffect(() => {
    if (selectedMap) {
      setLoadingLayers(true);
      listMapLayers(selectedMap.id).then(setLayers).finally(() => setLoadingLayers(false));
    } else {
      setLayers([]);
    }
  }, [selectedMap]);

  // Load regions when map changes
  useEffect(() => {
    if (selectedMap) {
      setLoadingRegions(true);
      listRegions(selectedMap.id).then(setRegions).finally(() => setLoadingRegions(false));
    } else {
      setRegions([]);
    }
  }, [selectedMap]);

  // Load markers when map changes
  useEffect(() => {
    if (selectedMap) {
      setLoadingMarkers(true);
      listMarkers(selectedMap.id).then(setMarkers).finally(() => setLoadingMarkers(false));
    } else {
      setMarkers([]);
    }
  }, [selectedMap]);

  // Load permissions when map changes
  useEffect(() => {
    if (selectedMap) {
      setLoadingPermissions(true);
      listMapPermissions(selectedMap.id).then(setPermissions).finally(() => setLoadingPermissions(false));
    } else {
      setPermissions([]);
    }
  }, [selectedMap]);

  const handleCreateMap = async () => {
    if (!camp || !newMap.name.trim()) return;
    try {
      const map = await createMap({
        campaign_id: camp.id,
        name: newMap.name.trim(),
        description: newMap.description.trim(),
        image_url: newMap.image_url,
        image_width: newMap.image_width,
        image_height: newMap.image_height,
        grid_type: newMap.grid_type,
        grid_size: newMap.grid_size,
        grid_offset_x: newMap.grid_offset_x,
        grid_offset_y: newMap.grid_offset_y,
        fog_enabled: newMap.fog_enabled,
        fog_color: newMap.fog_color,
        fog_opacity: newMap.fog_opacity,
        visibility: newMap.visibility,
        sort_order: newMap.sort_order,
        created_by: profile!.id,
      });
      setMaps(prev => [...prev, map]);
      setSelectedMap(map);
      setShowCreateMap(false);
      setNewMap({ name: '', description: '', grid_type: 'square', grid_size: 50, fog_enabled: true, fog_color: '#000000', fog_opacity: 0.85, visibility: 'all', sort_order: 0, image_url: null, image_width: null, image_height: null, grid_offset_x: 0, grid_offset_y: 0 });
    } catch (e) {
      console.error(e);
    }
  };

  const handleSelectMap = async (map: Map) => {
    setSelectedMap(map);
  };

  const handleUpdateMap = async (id: string, patch: Partial<Map>) => {
    try {
      const updated = await updateMap(id, patch);
      setMaps(prev => prev.map(m => m.id === id ? updated : m));
      if (selectedMap?.id === id) setSelectedMap(updated);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMap = async (id: string) => {
    try {
      await deleteMap(id);
      setMaps(prev => prev.filter(m => m.id !== id));
      if (selectedMap?.id === id) setSelectedMap(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateLayer = async () => {
    if (!selectedMap || !newLayer.name.trim()) return;
    try {
      const layer = await createMapLayer({
        map_id: selectedMap.id,
        name: newLayer.name.trim(),
        layer_type: newLayer.layer_type,
        z_index: newLayer.z_index,
        visible: newLayer.visible,
        gm_only: newLayer.gm_only,
        opacity: newLayer.opacity,
        data: newLayer.data,
      });
      setLayers(prev => [...prev, layer].sort((a, b) => a.z_index - b.z_index));
      setShowCreateLayer(false);
      setNewLayer({ name: '', layer_type: 'tokens', z_index: 0, visible: true, gm_only: false, opacity: 1, data: {} });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteLayer = async (id: string) => {
    try {
      await deleteMapLayer(id);
      setLayers(prev => prev.filter(l => l.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateRegion = async () => {
    if (!selectedMap || !newRegion.name.trim()) return;
    try {
      const region = await createRegion({
        map_id: selectedMap.id,
        name: newRegion.name.trim(),
        description: newRegion.description.trim(),
        shape_type: newRegion.shape_type,
        geometry: newRegion.geometry,
        fill_color: newRegion.fill_color,
        stroke_color: newRegion.stroke_color,
        stroke_width: newRegion.stroke_width,
        is_secret: newRegion.is_secret,
        is_restricted: newRegion.is_restricted,
        tags: newRegion.tags,
        parent_region_id: newRegion.parent_region_id,
        created_by: profile!.id,
      });
      setRegions(prev => [...prev, region]);
      setShowCreateRegion(false);
      setNewRegion({ name: '', description: '', shape_type: 'polygon', geometry: {}, fill_color: null, stroke_color: null, stroke_width: 2, is_secret: false, is_restricted: false, tags: [], parent_region_id: null });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRegion = async (id: string) => {
    try {
      await deleteRegion(id);
      setRegions(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateMarker = async () => {
    if (!selectedMap || !newMarker.name.trim()) return;
    try {
      const marker = await createMarker({
        map_id: selectedMap.id,
        region_id: newMarker.region_id || null,
        name: newMarker.name.trim(),
        description: newMarker.description.trim(),
        marker_type: newMarker.marker_type,
        icon: newMarker.icon,
        icon_color: newMarker.icon_color,
        icon_size: newMarker.icon_size,
        x: newMarker.x,
        y: newMarker.y,
        linked_character_id: newMarker.linked_character_id || null,
        linked_encounter_id: newMarker.linked_encounter_id || null,
        linked_map_id: newMarker.linked_map_id || null,
        is_secret: newMarker.is_secret,
        is_discovered: newMarker.is_discovered,
        discovered_by: newMarker.discovered_by,
        discovered_at: newMarker.discovered_at || null,
        tags: newMarker.tags,
        created_by: profile!.id,
      });
      setMarkers(prev => [...prev, marker]);
      setShowCreateMarker(false);
      setNewMarker({ name: '', description: '', marker_type: 'poi', icon: 'map-pin', icon_color: '#3b82f6', icon_size: 1.0, x: 0, y: 0, region_id: null, linked_character_id: null, linked_encounter_id: null, linked_map_id: null, is_secret: false, is_discovered: false, discovered_by: [], discovered_at: null, tags: [] });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteMarker = async (id: string) => {
    try {
      await deleteMarker(id);
      setMarkers(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleMarkerDiscovered = async (marker: Marker) => {
    try {
      const updated = await discoverMarker(marker.id, profile!.id);
      setMarkers(prev => prev.map(m => m.id === marker.id ? updated : m));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreatePermission = async () => {
    if (!selectedMap || (!newPermission.target_user_id && !newPermission.target_role)) return;
    try {
      const permission = await createMapPermission({
        map_id: selectedMap.id,
        target_user_id: newPermission.target_user_id || null,
        target_role: newPermission.target_role || null,
        can_view: newPermission.can_view,
        can_edit: newPermission.can_edit,
        can_manage_layers: newPermission.can_manage_layers,
        can_manage_markers: newPermission.can_manage_markers,
        can_reveal_fog: newPermission.can_reveal_fog,
        can_manage_regions: newPermission.can_manage_regions,
        created_by: profile!.id,
      });
      setPermissions(prev => [...prev, permission]);
      setShowCreatePermission(false);
      setNewPermission({ target_user_id: null, target_role: 'all_players', can_view: true, can_edit: false, can_manage_layers: false, can_manage_markers: false, can_reveal_fog: false, can_manage_regions: false });
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeletePermission = async (id: string) => {
    try {
      await deleteMapPermission(id);
      setPermissions(prev => prev.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  if (!mine.length) {
    return (
      <>
        <PageHead eyebrow="Painel do mestre" title="Mapas e Regiões" actions={
          <LinkButton to="/campanhas" variant="primary" icon="plus">Criar campanha</LinkButton>
        }>Você só vê e administra campanhas suas.</PageHead>
        <Panel>
          <EmptyState icon="flag" title="Você ainda não administra campanhas" action={
            <LinkButton to="/campanhas" variant="primary" icon="plus">Criar campanha</LinkButton>
          }>Crie uma campanha para acessar o sistema de mapas.</EmptyState>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHead eyebrow={`Painel do mestre · ${camp?.name || 'Selecione uma campanha'}`} title="Mapas, Regiões e Marcadores" actions={
        mine.length > 1 ? (
          <select className="input" style={{ width: 'auto', minHeight: 40 }} value={camp?.id} onChange={(e) => setPick(e.target.value)}>
            {mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        ) : undefined
      }>Gerencie mapas, regiões, marcadores e permissões para suas campanhas.</PageHead>

      <div className="grid cols-2" style={{ gap: '1rem' }}>
        {/* Maps List */}
        <Panel title="Mapas da Campanha" icon="map" actions={
          <Button icon="plus" onClick={() => setShowCreateMap(true)}>Novo Mapa</Button>
        }>
          {loadingMaps ? (
            <span className="spinner" role="status" aria-label="Carregando" />
          ) : maps.length === 0 ? (
            <EmptyState icon="map" title="Nenhum mapa criado" action={
              <Button size="sm" icon="plus" onClick={() => setShowCreateMap(true)}>Criar primeiro mapa</Button>
            }>Comece criando um mapa para sua campanha.</EmptyState>
          ) : (
            <div className="stack">
              {maps.map(m => (
                <div
                  key={m.id}
                  className="field"
                  style={{
                    padding: '0.75rem',
                    background: selectedMap?.id === m.id ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                    borderRadius: '8px',
                    border: selectedMap?.id === m.id ? '2px solid var(--accent)' : '1px solid var(--border)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleSelectMap(m)}
                >
                  <div className="row row-between">
                    <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                      <strong>{m.name}</strong>
                      <Badge tone={m.visibility === 'gm_only' ? 'bad' : m.visibility === 'players_only' ? 'accent' : undefined}>
                        {m.visibility === 'gm_only' ? '👁 Mestre' : m.visibility === 'players_only' ? '👥 Jogadores' : '🌍 Todos'}
                      </Badge>
                    </div>
                    <div className="row" style={{ gap: '0.25rem' }}>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleUpdateMap(m.id, { visibility: m.visibility === 'all' ? 'gm_only' : m.visibility === 'gm_only' ? 'players_only' : 'all' }); }}>
                        {m.visibility === 'all' ? '🌍' : m.visibility === 'gm_only' ? '👁' : '👥'}
                      </Button>
                      <Button size="sm" variant="danger" onClick={(e) => { e.stopPropagation(); handleDeleteMap(m.id); }}>✕</Button>
                    </div>
                  </div>
                  {m.description && <div className="muted small" style={{ marginTop: '0.25rem' }}>{m.description}</div>}
                  <div className="muted small" style={{ marginTop: '0.25rem' }}>
                    Grade: {m.grid_type} · {m.grid_size}px · Névoa: {m.fog_enabled ? 'Ativa' : 'Inativa'}
                  </div>
                </div>
              ))}
            </div>
          )}

          {showCreateMap && (
            <Modal title="Novo Mapa" onClose={() => setShowCreateMap(false)}>
              <form className="stack" onSubmit={e => { e.preventDefault(); handleCreateMap(); }}>
                <Field label="Nome" htmlFor="map-name">
                  <input id="map-name" className="input" value={newMap.name} onChange={e => setNewMap(prev => ({ ...prev, name: e.target.value }))} maxLength={100} required />
                </Field>
                <Field label="Descrição" htmlFor="map-desc">
                  <textarea id="map-desc" className="input" value={newMap.description} onChange={e => setNewMap(prev => ({ ...prev, description: e.target.value }))} maxLength={2000} rows={3} />
                </Field>
                <div className="grid cols-2">
                  <Field label="Tipo de Grade" htmlFor="map-grid">
                    <select id="map-grid" className="input" value={newMap.grid_type} onChange={e => setNewMap(prev => ({ ...prev, grid_type: e.target.value as any }))}>
                      <option value="square">Quadrada</option>
                      <option value="hex">Hexagonal</option>
                      <option value="none">Sem grade</option>
                    </select>
                  </Field>
                  <Field label="Tamanho da Célula (px)" htmlFor="map-grid-size">
                    <input id="map-grid-size" type="number" className="input" value={newMap.grid_size} onChange={e => setNewMap(prev => ({ ...prev, grid_size: Number(e.target.value) || 50 }))} min={10} max={500} />
                  </Field>
                </div>
                <div className="grid cols-2">
                  <Field label="Névoa de Guerra" htmlFor="map-fog">
                    <select id="map-fog" className="input" value={newMap.fog_enabled ? 'true' : 'false'} onChange={e => setNewMap(prev => ({ ...prev, fog_enabled: e.target.value === 'true' }))}>
                      <option value="true">Ativa</option>
                      <option value="false">Inativa</option>
                    </select>
                  </Field>
                  <Field label="Visibilidade" htmlFor="map-vis">
                    <select id="map-vis" className="input" value={newMap.visibility} onChange={e => setNewMap(prev => ({ ...prev, visibility: e.target.value as any }))}>
                      <option value="all">Todos (público)</option>
                      <option value="players_only">Apenas jogadores</option>
                      <option value="gm_only">Apenas mestre</option>
                    </select>
                  </Field>
                </div>
                <Field label="Ordem de exibição" htmlFor="map-order">
                  <input id="map-order" type="number" className="input" value={newMap.sort_order} onChange={e => setNewMap(prev => ({ ...prev, sort_order: Number(e.target.value) || 0 }))} />
                </Field>
                <div className="modal-actions">
                  <Button type="button" variant="ghost" onClick={() => setShowCreateMap(false)}>Cancelar</Button>
                  <Button type="submit" variant="primary">Criar Mapa</Button>
                </div>
              </form>
            </Modal>
          )}
        </Panel>

        {/* Selected Map Details */}
        {selectedMap && (
          <div className="stack" style={{ flex: 1 }}>
            <Panel title={selectedMap.name} icon="map" actions={
              <div className="row" style={{ gap: '0.5rem' }}>
                <Button size="sm" variant="ghost" onClick={() => handleUpdateMap(selectedMap.id, { description: prompt('Nova descrição:', selectedMap.description) || selectedMap.description })}>
                  <Icon name="edit" /> Editar
                </Button>
                <Button size="sm" variant="danger" onClick={() => handleDeleteMap(selectedMap.id)}>
                  <Icon name="trash" /> Excluir
                </Button>
              </div>
            }>
              <TabsComponent
                tabs={[
                  { id: 'layers', label: 'Camadas', icon: 'layers' },
                  { id: 'regions', label: 'Regiões', icon: 'map' },
                  { id: 'markers', label: 'Marcadores', icon: 'map-pin' },
                  { id: 'permissions', label: 'Permissões', icon: 'shield' },
                ]}
                activeTab={activeMapTab}
                onChange={(id) => setActiveMapTab(id as any)}
              />
              {activeMapTab === 'layers' && (
                <MapLayersPanel
                  map={selectedMap}
                  layers={layers}
                  loading={loadingLayers}
                  showCreate={showCreateLayer}
                  setShowCreate={setShowCreateLayer}
                  newLayer={newLayer}
                  setNewLayer={setNewLayer}
                  onCreate={handleCreateLayer}
                  onDelete={handleDeleteLayer}
                />
              )}
              {activeMapTab === 'regions' && (
                <RegionsPanel
                  map={selectedMap}
                  regions={regions}
                  loading={loadingRegions}
                  showCreate={showCreateRegion}
                  setShowCreate={setShowCreateRegion}
                  newRegion={newRegion}
                  setNewRegion={setNewRegion}
                  onCreate={handleCreateRegion}
                  onDelete={handleDeleteRegion}
                />
              )}
              {activeMapTab === 'markers' && (
                <MarkersPanel
                  map={selectedMap}
                  regions={regions}
                  markers={markers}
                  loading={loadingMarkers}
                  showCreate={showCreateMarker}
                  setShowCreate={setShowCreateMarker}
                  newMarker={newMarker}
                  setNewMarker={setNewMarker}
                  onCreate={handleCreateMarker}
                  onDelete={handleDeleteMarker}
                  onToggleDiscovered={handleToggleMarkerDiscovered}
                  currentUserId={profile!.id}
                />
              )}
              {activeMapTab === 'permissions' && (
                <PermissionsPanel
                  map={selectedMap}
                  permissions={permissions}
                  loading={loadingPermissions}
                  showCreate={showCreatePermission}
                  setShowCreate={setShowCreatePermission}
                  newPermission={newPermission}
                  setNewPermission={setNewPermission}
                  onCreate={handleCreatePermission}
                  onDelete={handleDeletePermission}
                />
              )}
            </Panel>
          </div>
        )}
      </div>
    </>
  );
}

// Helper tabs component
function TabsComponent({ tabs, activeTab, onChange }: { tabs: { id: string; label: string; icon: string }[]; activeTab: string; onChange: (id: string) => void }) {
  const [tab, setTab] = useState(activeTab);
  useEffect(() => setTab(activeTab), [activeTab]);
  return (
    <div className="tabs" role="tablist">
      {tabs.map(t => (
        <button
          key={t.id}
          role="tab"
          aria-selected={tab === t.id}
          className={`tab ${tab === t.id ? 'active' : ''}`}
          onClick={() => { setTab(t.id); onChange(t.id); }}
        >
          <Icon name={t.icon as any} className="icon-sm" /> {t.label}
        </button>
      ))}
    </div>
  );
}

function MapLayersPanel({
  map,
  layers,
  loading,
  showCreate,
  setShowCreate,
  newLayer,
  setNewLayer,
  onCreate,
  onDelete,
}: {
  map: Map;
  layers: MapLayer[];
  loading: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  newLayer: NewLayerState;
  setNewLayer: React.Dispatch<React.SetStateAction<NewLayerState>>;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="stack">
      <div className="row row-between">
        <h4 style={{ margin: 0 }}>Camadas do Mapa</h4>
        <Button size="sm" icon="plus" onClick={() => setShowCreate(true)}>Nova Camada</Button>
      </div>
      {loading ? <span className="spinner" /> : layers.length === 0 ? (
        <EmptyState icon="layers" title="Nenhuma camada">Crie camadas para organizar seu mapa (fundo, grade, tokens, névoa, notas).</EmptyState>
      ) : (
        <div className="stack-sm">
          {layers.map(l => (
            <div key={l.id} className="field" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div className="row" style={{ gap: '0.5rem', alignItems: 'center', flex: 1 }}>
                <Badge tone={l.gm_only ? 'bad' : undefined}>{l.layer_type}</Badge>
                <strong>{l.name}</strong>
                <span className="muted small">Z: {l.z_index} · Opacidade: {Math.round(l.opacity * 100)}% · {l.visible ? 'Visível' : 'Oculta'}</span>
                {l.gm_only && <VisTag v="mestre" />}
              </div>
              <Button size="sm" variant="danger" onClick={() => onDelete(l.id)}>Excluir</Button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Nova Camada" onClose={() => setShowCreate(false)}>
          <form className="stack" onSubmit={e => { e.preventDefault(); onCreate(); }}>
            <Field label="Nome" htmlFor="layer-name">
              <input id="layer-name" className="input" value={newLayer.name} onChange={e => setNewLayer(prev => ({ ...prev, name: e.target.value }))} required />
            </Field>
            <Field label="Tipo" htmlFor="layer-type">
              <select id="layer-type" className="input" value={newLayer.layer_type} onChange={e => setNewLayer(prev => ({ ...prev, layer_type: e.target.value as any }))}>
                {MAP_LAYER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <div className="grid cols-2">
              <Field label="Z-Index" htmlFor="layer-z">
                <input id="layer-z" type="number" className="input" value={newLayer.z_index} onChange={e => setNewLayer(prev => ({ ...prev, z_index: Number(e.target.value) }))} />
              </Field>
              <Field label="Opacidade" htmlFor="layer-opacity">
                <input id="layer-opacity" type="number" className="input" value={newLayer.opacity} onChange={e => setNewLayer(prev => ({ ...prev, opacity: Math.max(0, Math.min(1, Number(e.target.value))) }))} step={0.1} min={0} max={1} />
              </Field>
            </div>
            <div className="row" style={{ gap: '1rem' }}>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newLayer.visible} onChange={e => setNewLayer(prev => ({ ...prev, visible: e.target.checked }))} /> Visível
              </label>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newLayer.gm_only} onChange={e => setNewLayer(prev => ({ ...prev, gm_only: e.target.checked }))} /> Apenas Mestre
              </label>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button type="submit" variant="primary">Criar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function RegionsPanel({
  map,
  regions,
  loading,
  showCreate,
  setShowCreate,
  newRegion,
  setNewRegion,
  onCreate,
  onDelete,
}: {
  map: Map;
  regions: Region[];
  loading: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  newRegion: NewRegionState;
  setNewRegion: React.Dispatch<React.SetStateAction<NewRegionState>>;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="stack">
      <div className="row row-between">
        <h4 style={{ margin: 0 }}>Regiões do Mapa</h4>
        <Button size="sm" icon="plus" onClick={() => setShowCreate(true)}>Nova Região</Button>
      </div>
      {loading ? <span className="spinner" /> : regions.length === 0 ? (
        <EmptyState icon="map" title="Nenhuma região">Crie regiões para definir áreas nomeadas no mapa (salas, distritos, zonas).</EmptyState>
      ) : (
        <div className="stack-sm">
          {regions.map(r => (
            <div key={r.id} className="field" style={{ padding: '0.75rem' }}>
              <div className="row row-between">
                <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                  <Badge tone={r.is_secret ? 'bad' : r.is_restricted ? 'accent' : undefined}>
                    {r.is_secret ? '🔒 Secreto' : r.is_restricted ? '⚠ Restrito' : '🌍 Aberta'}
                  </Badge>
                  <strong>{r.name}</strong>
                  <Badge tone="accent">{r.shape_type}</Badge>
                </div>
                <Button size="sm" variant="danger" onClick={() => onDelete(r.id)}>Excluir</Button>
              </div>
              {r.description && <div className="muted small" style={{ marginTop: '0.25rem' }}>{r.description}</div>}
              {r.tags.length > 0 && (
                <div className="row" style={{ gap: '0.25rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                  {r.tags.map(t => <Badge key={t} tone="accent">{t}</Badge>)}
                </div>
              )}
              <div className="muted small" style={{ marginTop: '0.25rem' }}>
                Geometria: {JSON.stringify(r.geometry).slice(0, 100)}{JSON.stringify(r.geometry).length > 100 ? '...' : ''}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Nova Região" onClose={() => setShowCreate(false)}>
          <form className="stack" onSubmit={e => { e.preventDefault(); onCreate(); }}>
            <Field label="Nome" htmlFor="region-name">
              <input id="region-name" className="input" value={newRegion.name} onChange={e => setNewRegion(prev => ({ ...prev, name: e.target.value }))} maxLength={100} required />
            </Field>
            <Field label="Descrição" htmlFor="region-desc">
              <textarea id="region-desc" className="input" value={newRegion.description} onChange={e => setNewRegion(prev => ({ ...prev, description: e.target.value }))} maxLength={2000} rows={3} />
            </Field>
            <div className="grid cols-2">
              <Field label="Tipo de Forma" htmlFor="region-shape">
                <select id="region-shape" className="input" value={newRegion.shape_type} onChange={e => setNewRegion(prev => ({ ...prev, shape_type: e.target.value as any }))}>
                  <option value="polygon">Polígono</option>
                  <option value="circle">Círculo</option>
                  <option value="rectangle">Retângulo</option>
                </select>
              </Field>
              <Field label="Tags (separadas por vírgula)" htmlFor="region-tags">
                <input id="region-tags" className="input" value={newRegion.tags.join(', ')} onChange={e => setNewRegion(prev => ({ ...prev, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} placeholder="dungeon, town, wilderness" />
              </Field>
            </div>
            <div className="row" style={{ gap: '1rem' }}>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newRegion.is_secret} onChange={e => setNewRegion(prev => ({ ...prev, is_secret: e.target.checked }))} /> Secreto (oculto de jogadores)
              </label>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newRegion.is_restricted} onChange={e => setNewRegion(prev => ({ ...prev, is_restricted: e.target.checked }))} /> Restrito (requer permissão)
              </label>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button type="submit" variant="primary">Criar</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function MarkersPanel({
  map,
  regions,
  markers,
  loading,
  showCreate,
  setShowCreate,
  newMarker,
  setNewMarker,
  onCreate,
  onDelete,
  onToggleDiscovered,
  currentUserId,
}: {
  map: Map;
  regions: Region[];
  markers: Marker[];
  loading: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  newMarker: NewMarkerState;
  setNewMarker: React.Dispatch<React.SetStateAction<NewMarkerState>>;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onToggleDiscovered: (marker: Marker) => void;
  currentUserId: string;
}) {
  const isDiscovered = (m: Marker) => m.is_discovered || m.discovered_by.includes(currentUserId);

  return (
    <div className="stack">
      <div className="row row-between">
        <h4 style={{ margin: 0 }}>Marcadores</h4>
        <Button size="sm" icon="plus" onClick={() => setShowCreate(true)}>Novo Marcador</Button>
      </div>
      {loading ? <span className="spinner" /> : markers.length === 0 ? (
        <EmptyState icon="map-pin" title="Nenhum marcador">Adicione POIs, NPCs, encontros, tesouros, segredos e notas ao mapa.</EmptyState>
      ) : (
        <div className="stack-sm">
          {markers.map(m => (
            <div key={m.id} className="field" style={{ padding: '0.75rem' }}>
              <div className="row row-between">
                <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                  <Badge tone={
                    m.marker_type === 'secret' ? 'bad' :
                    m.marker_type === 'hazard' ? 'bad' :
                    m.marker_type === 'loot' ? 'accent' :
                    m.marker_type === 'npc' ? 'ok' :
                    m.marker_type === 'encounter' ? 'bad' :
                    m.marker_type === 'rest' ? 'ok' :
                    m.marker_type === 'shop' ? 'accent' : undefined
                  }>
                    {MARKER_TYPES.find(t => t.id === m.marker_type)?.label || m.marker_type}
                  </Badge>
                  <strong style={{ color: m.icon_color }}>{m.name}</strong>
                  {m.is_secret && <VisTag v="mestre" />}
                  {!m.is_secret && !isDiscovered(m) && <Badge tone="bad">Oculto</Badge>}
                  {isDiscovered(m) && !m.is_discovered && <Badge tone="ok">Descoberto por você</Badge>}
                  {m.is_discovered && <Badge tone="ok">Descoberto</Badge>}
                </div>
                <div className="row" style={{ gap: '0.25rem' }}>
                  {!m.is_discovered && !m.is_secret && (
                    <Button size="sm" variant="primary" onClick={() => onToggleDiscovered(m)}>
                      <Icon name="eye" /> Descobrir
                    </Button>
                  )}
                  <Button size="sm" variant="danger" onClick={() => onDelete(m.id)}>Excluir</Button>
                </div>
              </div>
              {m.description && <div className="muted small" style={{ marginTop: '0.25rem' }}>{m.description}</div>}
              <div className="muted small" style={{ marginTop: '0.25rem' }}>
                Posição: ({m.x.toFixed(0)}, {m.y.toFixed(0)}) · Ícone: {m.icon} · Cor: {m.icon_color}
              </div>
              {m.region_id && (
                <div className="muted small">
                  Região: {regions.find(r => r.id === m.region_id)?.name || m.region_id}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal title="Novo Marcador" onClose={() => setShowCreate(false)}>
          <form className="stack" onSubmit={e => { e.preventDefault(); onCreate(); }}>
            <div className="grid cols-2">
              <Field label="Nome" htmlFor="marker-name">
                <input id="marker-name" className="input" value={newMarker.name} onChange={e => setNewMarker(prev => ({ ...prev, name: e.target.value }))} maxLength={100} required />
              </Field>
              <Field label="Tipo" htmlFor="marker-type">
                <select id="marker-type" className="input" value={newMarker.marker_type} onChange={e => setNewMarker(prev => ({ ...prev, marker_type: e.target.value as any }))}>
                  {MARKER_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid cols-3">
              <Field label="Ícone" htmlFor="marker-icon">
                <input id="marker-icon" className="input" value={newMarker.icon} onChange={e => setNewMarker(prev => ({ ...prev, icon: e.target.value }))} placeholder="map-pin" />
              </Field>
              <Field label="Cor" htmlFor="marker-color">
                <input id="marker-color" type="color" className="input" value={newMarker.icon_color} onChange={e => setNewMarker(prev => ({ ...prev, icon_color: e.target.value }))} style={{ height: '40px', padding: 0 }} />
              </Field>
              <Field label="Tamanho" htmlFor="marker-size">
                <input id="marker-size" type="number" className="input" value={newMarker.icon_size} onChange={e => setNewMarker(prev => ({ ...prev, icon_size: Math.max(0.5, Math.min(3, Number(e.target.value))) }))} step={0.1} min={0.5} max={3} />
              </Field>
            </div>
            <div className="grid cols-2">
              <Field label="Posição X" htmlFor="marker-x">
                <input id="marker-x" type="number" className="input" value={newMarker.x} onChange={e => setNewMarker(prev => ({ ...prev, x: Math.max(0, Number(e.target.value)) }))} min={0} step={1} />
              </Field>
              <Field label="Posição Y" htmlFor="marker-y">
                <input id="marker-y" type="number" className="input" value={newMarker.y} onChange={e => setNewMarker(prev => ({ ...prev, y: Math.max(0, Number(e.target.value)) }))} min={0} step={1} />
              </Field>
            </div>
            <Field label="Região (opcional)" htmlFor="marker-region">
              <select id="marker-region" className="input" value={newMarker.region_id || ''} onChange={e => setNewMarker(prev => ({ ...prev, region_id: e.target.value || null }))}>
                <option value="">Nenhuma</option>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Field>
            <Field label="Descrição" htmlFor="marker-desc">
              <textarea id="marker-desc" className="input" value={newMarker.description} onChange={e => setNewMarker(prev => ({ ...prev, description: e.target.value }))} maxLength={2000} rows={2} />
            </Field>
            <div className="grid cols-2">
              <Field label="Tags (vírgula)" htmlFor="marker-tags">
                <input id="marker-tags" className="input" value={newMarker.tags.join(', ')} onChange={e => setNewMarker(prev => ({ ...prev, tags: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }))} />
              </Field>
              <div className="row" style={{ gap: '1rem', alignItems: 'center', marginTop: '1.5rem' }}>
                <label className="row" style={{ gap: '0.5rem' }}>
                  <input type="checkbox" checked={newMarker.is_secret} onChange={e => setNewMarker(prev => ({ ...prev, is_secret: e.target.checked }))} /> Secreto (mestre apenas)
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button type="submit" variant="primary">Criar Marcador</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

function PermissionsPanel({
  map,
  permissions,
  loading,
  showCreate,
  setShowCreate,
  newPermission,
  setNewPermission,
  onCreate,
  onDelete,
}: {
  map: Map;
  permissions: MapPermission[];
  loading: boolean;
  showCreate: boolean;
  setShowCreate: (v: boolean) => void;
  newPermission: NewPermissionState;
  setNewPermission: React.Dispatch<React.SetStateAction<NewPermissionState>>;
  onCreate: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="stack">
      <div className="row row-between">
        <h4 style={{ margin: 0 }}>Permissões do Mapa</h4>
        <Button size="sm" icon="plus" onClick={() => setShowCreate(true)}>Adicionar Permissão</Button>
      </div>
      <p className="hint" style={{ margin: '0 0 1rem' }}>
        Defina permissões específicas além da associação à campanha. Permissões por usuário ou papel.
      </p>
      {loading ? <span className="spinner" /> : permissions.length === 0 ? (
        <EmptyState icon="shield" title="Nenhuma permissão personalizada">O acesso segue as regras padrão da campanha e visibilidade do mapa.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Alvo</th>
                <th>Ver</th>
                <th>Editar</th>
                <th>Camadas</th>
                <th>Marcadores</th>
                <th>Névoa</th>
                <th>Regiões</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map(p => (
                <tr key={p.id}>
                  <td>{p.target_user_id ? `Usuário: ${p.target_user_id}` : p.target_role === 'all_players' ? 'Todos os jogadores' : 'Todos os mestres'}</td>
                  <td>{p.can_view ? '✓' : '✗'}</td>
                  <td>{p.can_edit ? '✓' : '✗'}</td>
                  <td>{p.can_manage_layers ? '✓' : '✗'}</td>
                  <td>{p.can_manage_markers ? '✓' : '✗'}</td>
                  <td>{p.can_reveal_fog ? '✓' : '✗'}</td>
                  <td>{p.can_manage_regions ? '✓' : '✗'}</td>
                  <td><Button size="sm" variant="danger" onClick={() => onDelete(p.id)}>Excluir</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <Modal title="Nova Permissão" onClose={() => setShowCreate(false)}>
          <form className="stack" onSubmit={e => { e.preventDefault(); onCreate(); }}>
            <div className="field">
              <label>Alvo</label>
              <div className="row" style={{ gap: '1rem', alignItems: 'center' }}>
                <label className="row" style={{ gap: '0.5rem' }}>
                  <input type="radio" name="perm-target" checked={!newPermission.target_user_id && newPermission.target_role === 'all_players'} onChange={() => setNewPermission(prev => ({ ...prev, target_user_id: null, target_role: 'all_players' }))} /> Todos os jogadores
                </label>
                <label className="row" style={{ gap: '0.5rem' }}>
                  <input type="radio" name="perm-target" checked={newPermission.target_role === 'all_masters'} onChange={() => setNewPermission(prev => ({ ...prev, target_user_id: null, target_role: 'all_masters' }))} /> Todos os mestres
                </label>
                <label className="row" style={{ gap: '0.5rem' }}>
                  <input type="radio" name="perm-target" checked={!!newPermission.target_user_id} onChange={() => setNewPermission(prev => ({ ...prev, target_user_id: 'user-id-placeholder', target_role: null }))} />
                  <input type="text" className="input" style={{ width: '200px' }} placeholder="ID do usuário" value={newPermission.target_user_id || ''} onChange={e => setNewPermission(prev => ({ ...prev, target_user_id: e.target.value || null }))} />
                </label>
              </div>
            </div>
            <div className="grid cols-3" style={{ marginTop: '1rem' }}>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newPermission.can_view} onChange={e => setNewPermission(prev => ({ ...prev, can_view: e.target.checked }))} /> Ver mapa
              </label>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newPermission.can_edit} onChange={e => setNewPermission(prev => ({ ...prev, can_edit: e.target.checked }))} /> Editar mapa
              </label>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newPermission.can_manage_layers} onChange={e => setNewPermission(prev => ({ ...prev, can_manage_layers: e.target.checked }))} /> Gerenciar camadas
              </label>
            </div>
            <div className="grid cols-3">
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newPermission.can_manage_markers} onChange={e => setNewPermission(prev => ({ ...prev, can_manage_markers: e.target.checked }))} /> Gerenciar marcadores
              </label>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newPermission.can_reveal_fog} onChange={e => setNewPermission(prev => ({ ...prev, can_reveal_fog: e.target.checked }))} /> Revelar névoa
              </label>
              <label className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                <input type="checkbox" checked={newPermission.can_manage_regions} onChange={e => setNewPermission(prev => ({ ...prev, can_manage_regions: e.target.checked }))} /> Gerenciar regiões
              </label>
            </div>
            <div className="modal-actions">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
              <Button type="submit" variant="primary">Adicionar Permissão</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}