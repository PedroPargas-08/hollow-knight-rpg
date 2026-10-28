import { useEffect, useState, type FormEvent } from 'react';
import { Link, navigate, useRoute } from '../app/router';
import { useAuth } from '../app/auth';
import { SHEET_TABS, type SheetTab } from '../app/nav';
import { Alert, Badge, Button, EmptyState, Field, LinkButton, Meter, PageHead, Panel, TabPanel, Tabs } from '../components/ui';
import { MaskGlyph } from '../components/domain';
import { Icon } from '../components/Icon';
import { Modal, useToast } from '../components/overlay';
import { createCharacter, getCharacter, listCampaigns, listCharacters, STATUS_LABEL, updateCharacter, getCharacterAttributes, upsertCharacterAttributes, listCharacterEquipment, listEquipmentDefinitions, addCharacterEquipment, updateCharacterEquipment, deleteCharacterEquipment, listCharacterAbilities, listAbilityDefinitions, listCharacterConditions, listConditionDefinitions, type Campaign, type Character, type CharacterAttributes, type CharacterEquipment, type EquipmentDefinition, type CharacterCondition, type ConditionDefinition } from '../lib/api';
import { ATTRIBUTES, clampInt, defaultSheet, friendlyError, getEffectiveAttribute, recalculateDerivedStats, applyRecalculatedStats, type Sheet, type Attribute } from '../lib/sheet';
import { EQUIPMENT_SLOTS, type EquipmentSlot, type Item, createBasicNail, createBasicShell, createHealingFlask } from '../lib/equipment';
import { useAsync } from '../lib/useAsync';

const Loading = ({ what }: { what: string }) => <EmptyState icon="hourglass" title={`Carregando ${what}…`}><span className="spinner" role="status" aria-label="Carregando" /></EmptyState>;

function NewCharacter({ campaigns, onClose }: { campaigns: Campaign[]; onClose: () => void }) {
  const toast = useToast();
  const [campaignId, setCampaignId] = useState(campaigns[0]?.id ?? '');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!campaignId) { setError('Escolha uma campanha.'); return; }
    if (!name.trim() || name.trim().length > 80) { setError('Informe um nome de até 80 caracteres.'); return; }
    setBusy(true); setError(undefined);
    try { const c = await createCharacter({ campaign_id: campaignId, name, sheet: defaultSheet() }); toast('Personagem criado.', 'ok'); onClose(); navigate(`/jogador/ficha?id=${c.id}`); }
    catch (x) { setError(friendlyError(x)); setBusy(false); }
  };
  return (
    <Modal title="Novo personagem" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="nch-camp">Campanha</label>
          <select id="nch-camp" className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <Field label="Nome do personagem" htmlFor="nch-name" error={error}><input id="nch-name" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <p className="hint" style={{ margin: 0 }}>Valores iniciais são provisórios; as regras de criação ainda não foram definidas.</p>
        <div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" loading={busy}>Criar</Button></div>
      </form>
    </Modal>
  );
}

const CharCard = ({ c, campaign }: { c: Character; campaign?: Campaign }) => (
  <article className="panel"><div className="crest"><div className="portrait" aria-hidden="true"><MaskGlyph className="mask" /></div>
    <div className="grow"><div className="crest-name">{c.name}</div><div className="muted small">Estágio {c.stage} · {campaign?.name ?? 'Campanha'}</div></div></div>
    <div className="grid cols-2" style={{ margin: '.8rem 0' }}><Meter label="PV" kind="pv" now={c.sheet.pv.now} max={c.sheet.pv.max} /><Meter label="ALMA" kind="alma" now={c.sheet.alma.now} max={c.sheet.alma.max} /></div>
    <LinkButton to={`/jogador/ficha?id=${c.id}`} size="sm" variant="primary" icon="sheet">Abrir ficha</LinkButton></article>
);

/* ================= PAINEL DO JOGADOR ================= */
export function PlayerDashboard() {
  const { profile } = useAuth();
  const camps = useAsync(listCampaigns, []);
  const chars = useAsync(listCharacters, []);
  const [creating, setCreating] = useState(false);
  const campById = new Map((camps.data ?? []).map((c) => [c.id, c]));
  const mine = (chars.data ?? []).filter((c) => c.owner_id === profile!.id);

  return (
    <>
      <PageHead eyebrow="Painel do jogador" title={`Bem-vindo de volta, ${profile!.display_name}`}>Aqui ficam suas campanhas e seus personagens — dados reais, visíveis só para você e para o mestre de cada campanha.</PageHead>
      <div className="dash">
        <div className="stack">
          <Panel title="Meus personagens" icon="user" actions={<Button size="sm" icon="plus" disabled={!camps.data?.length} onClick={() => setCreating(true)}>Novo personagem</Button>}>
            {chars.loading && !chars.data ? <Loading what="personagens" /> : chars.error ? <EmptyState icon="alert" title="Não foi possível carregar" action={<Button onClick={chars.reload}>Tentar de novo</Button>}>{chars.error}</EmptyState>
              : !mine.length ? <EmptyState icon="user" title="Nenhum personagem ainda">{camps.data?.length ? 'Crie seu primeiro personagem em uma das suas campanhas.' : 'Entre em uma campanha com um convite para poder criar um personagem.'}</EmptyState>
              : <div className="grid cols-2">{mine.map((c) => <CharCard key={c.id} c={c} campaign={campById.get(c.campaign_id)} />)}</div>}
          </Panel>
        </div>
        <div className="stack">
          <Panel title="Minhas campanhas" icon="flag" actions={<LinkButton to="/campanhas" size="sm">Ver todas</LinkButton>}>
            {camps.loading && !camps.data ? <Loading what="campanhas" /> : camps.error ? <p className="muted">{camps.error}</p>
              : !camps.data?.length ? <EmptyState icon="flag" title="Sem campanhas">Peça um convite ao seu mestre.</EmptyState>
              : <ul className="list">{camps.data.map((c) => <li className="list-row" key={c.id}><div className="grow"><strong>{c.name}</strong></div><Badge tone={c.status === 'andamento' ? 'ok' : undefined}>{STATUS_LABEL[c.status]}</Badge></li>)}</ul>}
          </Panel>
          <Panel title="Em breve" icon="hourglass" quiet>
            <p className="dim" style={{ margin: 0 }}>Missões, mapas e regiões reveladas, diário, histórico de rolagens e notificações chegam em fases futuras. Nada disso é exibido aqui até existir de verdade.</p>
          </Panel>
        </div>
      </div>
      {creating && camps.data && <NewCharacter campaigns={camps.data} onClose={() => setCreating(false)} />}
    </>
  );
}

/* ================= FICHA ================= */
type Draft = { name: string; stage: number; sheet: Sheet };
const same = (a: Draft, c: Character) => JSON.stringify(a) === JSON.stringify({ name: c.name, stage: c.stage, sheet: c.sheet });

function SheetEditor({ ch, canStage, onSaved }: { ch: Character; canStage: boolean; onSaved: (c: Character) => void }) {
  const { query } = useRoute();
  const toast = useToast();
  const tab = (SHEET_TABS.find((t) => t.id === query.get('aba'))?.id ?? 'identidade') as SheetTab;
  const [d, setD] = useState<Draft>({ name: ch.name, stage: ch.stage, sheet: ch.sheet });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attributes, setAttributes] = useState<CharacterAttributes | null>(null);
  const [loadingAttrs, setLoadingAttrs] = useState(true);
  const [conditions, setConditions] = useState<CharacterCondition[]>([]);
  const [conditionDefs, setConditionDefs] = useState<ConditionDefinition[]>([]);
  const [loadingConditions, setLoadingConditions] = useState(true);

  useEffect(() => {
    setD({ name: ch.name, stage: ch.stage, sheet: ch.sheet });
    // Load character attributes from database
    getCharacterAttributes(ch.id).then(attrs => {
      setAttributes(attrs);
      setLoadingAttrs(false);
    }).catch(() => setLoadingAttrs(false));

    // Load conditions
    Promise.all([
      listCharacterConditions(ch.id),
      listConditionDefinitions()
    ]).then(([conds, defs]) => {
      setConditions(conds);
      setConditionDefs(defs);
      setLoadingConditions(false);
    }).catch(() => setLoadingConditions(false));
  }, [ch]);

  const dirty = !same(d, ch);
  const upd = (patch: Partial<Sheet>) => setD((x) => ({ ...x, sheet: { ...x.sheet, ...patch } }));
  const setTab = (id: SheetTab) => navigate(`/jogador/ficha?id=${ch.id}&aba=${id}`);

  // Helper to update attribute and recalculate derived stats
  const updateAttribute = (attr: Attribute, value: number) => {
    upd({ attributes: { ...d.sheet.attributes, [attr]: value } });
    // Recalculate derived stats when attributes change
    const newSheet = { ...d.sheet, attributes: { ...d.sheet.attributes, [attr]: value } };
    const derived = recalculateDerivedStats(newSheet, d.stage);
    setD(prev => ({
      ...prev,
      sheet: applyRecalculatedStats(newSheet, d.stage)
    }));
  };

  const save = async () => {
    if (!d.name.trim()) { setError('O nome do personagem não pode ficar vazio.'); return; }
    setSaving(true); setError(null);
    try {
      const patch: { name: string; sheet: Sheet; stage?: number } = { name: d.name, sheet: d.sheet };
      if (canStage && d.stage !== ch.stage) patch.stage = d.stage;
      const saved = await updateCharacter(ch.id, patch);
      onSaved(saved); toast('Ficha salva.', 'ok');
    } catch (x) { setError(friendlyError(x)); } finally { setSaving(false); }
  };

  const num = (id: string, label: string, value: number, set: (n: number) => void, max = 999) => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" type="number" inputMode="numeric" min={0} max={max} value={value} onChange={(e) => set(clampInt(e.target.value, 0, max, 0))} /></div>);
  const txt = (id: string, label: string, value: string, set: (s: string) => void, max: number, area = false) => (
    <div className="field"><label htmlFor={id}>{label}</label>{area ? <textarea id={id} className="input" maxLength={max} value={value} onChange={(e) => set(e.target.value)} /> : <input id={id} className="input" maxLength={max} value={value} onChange={(e) => set(e.target.value)} />}</div>);

  // Get effective values from attributes table if available, otherwise from sheet
  const getEffectiveValue = (attr: Attribute) => {
    if (attributes) {
      const base = attributes[attr.toLowerCase() as keyof CharacterAttributes] as number;
      const bonus = attributes[`${attr.toLowerCase()}_bonus` as keyof CharacterAttributes] as number;
      return base + bonus;
    }
    return getEffectiveAttribute(d.sheet, attr);
  };

  const pvMax = attributes?.pv_max ?? d.sheet.pv.max;
  const pvNow = attributes?.pv_now ?? d.sheet.pv.now;
  const almaMax = attributes?.alma_max ?? d.sheet.alma.max;
  const almaNow = attributes?.alma_now ?? d.sheet.alma.now;
  const defense = attributes?.defense ?? d.sheet.defense;

  return (
    <>
      <div className="row row-between" style={{ marginBottom: '.8rem' }}>
        <div className="row"><Badge tone="accent"><Icon name="star" /> Estágio {ch.stage}</Badge>{dirty && <Badge tone="bad">Alterações não salvas</Badge>}</div>
        <div className="row"><Button variant="ghost" disabled={!dirty || saving} onClick={() => setD({ name: ch.name, stage: ch.stage, sheet: ch.sheet })}>Descartar</Button><Button variant="primary" icon="check" loading={saving} disabled={!dirty} onClick={save}>Salvar ficha</Button></div>
      </div>
      {error && <div style={{ marginBottom: '.8rem' }}><Alert tone="bad">{error}</Alert></div>}
      <div className="sheet-grid">
        <aside className="stack sheet-side">
          <Panel>
            <div className="crest"><div className="portrait" aria-hidden="true"><MaskGlyph className="mask" /></div><div><div className="crest-name">{d.name || 'Sem nome'}</div><div className="muted small">Estágio {ch.stage}</div></div></div>
            <hr className="divider" /><div className="stack-sm"><Meter label="PV" kind="pv" now={pvNow} max={pvMax} /><Meter label="ALMA" kind="alma" now={almaNow} max={almaMax} /></div>
            <div className="row" style={{ marginTop: '.8rem' }}><Badge><Icon name="shield" /> Defesa {defense}</Badge></div>
          </Panel>

          {/* Conditions Display */}
          <Panel title="Condições Ativas" icon="alert">
            {loadingConditions ? (
              <Loading what="condições" />
            ) : conditions.length === 0 ? (
              <p className="muted small" style={{ margin: 0 }}>Nenhuma condição ativa</p>
            ) : (
              <div className="stack-sm">
                {conditions.map(cond => {
                  const def = conditionDefs.find(d => d.id === cond.condition_id);
                  const severityColors: Record<string, string> = {
                    leve: '#4ade80',
                    moderada: '#fbbf24',
                    severa: '#f97316',
                    critica: '#ef4444'
                  };
                  const color = severityColors[cond.severity] || '#888';
                  return (
                    <div key={cond.id} className="field" style={{ padding: '0.5rem', background: 'var(--bg-elevated)', borderRadius: '6px', borderLeft: `3px solid ${color}` }}>
                      <div className="row row-between">
                        <div className="row" style={{ gap: '0.5rem', alignItems: 'center' }}>
                          <strong>{def?.name || 'Desconhecida'}</strong>
                          <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: color, color: '#000', textTransform: 'uppercase' }}>{cond.severity}</span>
                        </div>
                        {cond.stacks > 1 && <span className="badge badge-accent">×{cond.stacks}</span>}
                      </div>
                      <div className="muted small" style={{ marginTop: '0.25rem' }}>
                        {def?.description || ''}
                        {cond.duration_remaining > 0 && <span> — {cond.duration_remaining} turno(s) restante(s)</span>}
                        {cond.duration_remaining === -1 && <span className="muted"> — Permanente</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </aside>
        <div>
          <Tabs<SheetTab> label="Seções da ficha" items={SHEET_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))} value={tab} onChange={setTab} />
          <TabPanel id={tab}>
            {tab === 'identidade' && <Panel title="Identidade" icon="user"><div className="stack">
              {txt('f-name', 'Nome do personagem', d.name, (v) => setD({ ...d, name: v }), 80)}
              {txt('f-concept', 'Conceito', d.sheet.concept, (v) => upd({ concept: v }), 300)}
              <div className="grid cols-2">{txt('f-arch', 'Arquétipo', d.sheet.archetype, (v) => upd({ archetype: v }), 80)}{txt('f-origin', 'Origem', d.sheet.origin, (v) => upd({ origin: v }), 80)}</div>
              {canStage ? num('f-stage', 'Estágio (progressão)', d.stage, (n) => setD({ ...d, stage: Math.max(1, Math.min(20, n)) }), 20)
                : <p className="hint" style={{ margin: 0 }}>O estágio (progressão) só pode ser alterado pelo mestre da campanha.</p>}
            </div></Panel>}
            {tab === 'atributos' && <div className="stack">
  {loadingAttrs ? <p className="hint">Carregando atributos…</p> : (
    <>
      {canStage ? (
        <Alert tone="info">
          <strong>Aviso:</strong> Alterar atributos base recalcula automaticamente PV máximo, ALMA máxima e Defesa.
        </Alert>
      ) : (
        <Alert tone="warn">
          Atributos efetivos (base + bônus de equipamentos/condições). PV, ALMA e Defesa são calculados automaticamente a partir dos atributos.
        </Alert>
      )}
      <div className="attrs">
        {ATTRIBUTES.map((a, i) => {
          const effectiveValue = getEffectiveValue(a);
          const baseValue = d.sheet.attributes[a];
          return (
            <div className="attr" key={a} style={{ padding: '.7rem .9rem' }}>
              {canStage ? (
                <div className="field">
                  <label>{a} (base)</label>
                  <input
                    id={`f-attr-${i}`}
                    className="input"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={30}
                    value={baseValue}
                    onChange={(e) => updateAttribute(a, clampInt(e.target.value, 1, 30, baseValue))}
                  />
                  <span className="hint">Efetivo: {effectiveValue} (mod: {getEffectiveAttribute(d.sheet, a) >= 10 ? '+' : ''}{Math.floor((effectiveValue - 10) / 2)})</span>
                </div>
              ) : (
                <div className="field">
                  <label>{a}</label>
                  <input
                    className="input"
                    type="number"
                    value={effectiveValue}
                    readOnly
                    aria-label={`${a}: ${effectiveValue} (somente leitura)`}
                  />
                  <span className="hint">Modificador: {Math.floor((effectiveValue - 10) / 2) >= 0 ? '+' : ''}{Math.floor((effectiveValue - 10) / 2)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  )}
</div>}
            {tab === 'combate' && <Panel title="Combate e sobrevivência" icon="heart">
  <div className="grid cols-2">
    <div className="field">
      <label htmlFor="f-pv-now">PV atual</label>
      <input id="f-pv-now" className="input" type="number" inputMode="numeric" min={0} max={pvMax} value={pvNow} readOnly />
    </div>
    <div className="field">
      <label htmlFor="f-pv-max">PV máximo</label>
      <input id="f-pv-max" className="input" type="number" inputMode="numeric" min={0} max={999} value={pvMax} readOnly />
    </div>
    <div className="field">
      <label htmlFor="f-alma-now">ALMA atual</label>
      <input id="f-alma-now" className="input" type="number" inputMode="numeric" min={0} max={almaMax} value={almaNow} readOnly />
    </div>
    <div className="field">
      <label htmlFor="f-alma-max">ALMA máxima</label>
      <input id="f-alma-max" className="input" type="number" inputMode="numeric" min={0} max={999} value={almaMax} readOnly />
    </div>
    <div className="field">
      <label htmlFor="f-def">Defesa</label>
      <input id="f-def" className="input" type="number" inputMode="numeric" min={0} max={99} value={defense} readOnly />
    </div>
  </div>
  <p className="hint">
    PV, ALMA e Defesa são calculados automaticamente a partir dos atributos (VIG, INT, AGI) e do estágio.
    {canStage && ' O mestre pode alterar PV/ALMA atuais diretamente.'}
  </p>
</Panel>}
            {/* Equipamento Tab */}
            {tab === 'equipamento' && <InventoryPanel characterId={ch.id} canEdit={canStage} />}
            {/* Habilidades Tab */}
            {tab === 'habilidades' && <AbilitiesPanel characterId={ch.id} canEdit={canStage} />}
            {tab === 'narrativa' && <Panel title="Narrativa" icon="feather"><div className="stack">
              {txt('f-hist', 'História', d.sheet.history, (v) => upd({ history: v }), 5000, true)}{txt('f-pers', 'Personalidade', d.sheet.personality, (v) => upd({ personality: v }), 1000)}{txt('f-notes', 'Anotações', d.sheet.notes, (v) => upd({ notes: v }), 5000, true)}</div></Panel>}
          </TabPanel>
        </div>
      </div>
    </>
  );
}

/* ================= INVENTORY PANEL ================= */
function InventoryPanel({ characterId, canEdit }: { characterId: string; canEdit: boolean }) {
  const toast = useToast();
  const [equipment, setEquipment] = useState<CharacterEquipment[]>([]);
  const [definitions, setDefinitions] = useState<EquipmentDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingItem, setAddingItem] = useState<string | null>(null);
  const [newItemQty, setNewItemQty] = useState(1);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [eq, defs] = await Promise.all([
          listCharacterEquipment(characterId),
          listEquipmentDefinitions({ officialOnly: true })
        ]);
        setEquipment(eq);
        setDefinitions(defs);
      } catch (e) {
        toast(friendlyError(e), 'bad');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [characterId]);

  const defMap = new Map(definitions.map(d => [d.id, d]));
  const equippedMap = new Map(equipment.filter(e => e.equipped_slot).map(e => [e.equipped_slot!, e]));

  const handleEquip = async (item: CharacterEquipment, slot: EquipmentSlot) => {
    try {
      await updateCharacterEquipment(item.id, { equipped_slot: slot });
      const updated = await listCharacterEquipment(characterId);
      setEquipment(updated);
      toast(`${defMap.get(item.equipment_id)?.name || 'Item'} equipado em ${slot}`, 'ok');
    } catch (e) {
      toast(friendlyError(e), 'bad');
    }
  };

  const handleUnequip = async (item: CharacterEquipment) => {
    try {
      await updateCharacterEquipment(item.id, { equipped_slot: null });
      const updated = await listCharacterEquipment(characterId);
      setEquipment(updated);
      toast(`${defMap.get(item.equipment_id)?.name || 'Item'} desequipado`, 'ok');
    } catch (e) {
      toast(friendlyError(e), 'bad');
    }
  };

  const handleUseConsumable = async (item: CharacterEquipment) => {
    try {
      if (item.quantity <= 1) {
        await deleteCharacterEquipment(item.id);
      } else {
        await updateCharacterEquipment(item.id, { quantity: item.quantity - 1 });
      }
      const updated = await listCharacterEquipment(characterId);
      setEquipment(updated);
      toast(`${defMap.get(item.equipment_id)?.name || 'Item'} usado`, 'ok');
    } catch (e) {
      toast(friendlyError(e), 'bad');
    }
  };

  const handleAddItem = async (defId: string) => {
    try {
      await addCharacterEquipment({ character_id: characterId, equipment_id: defId, quantity: newItemQty });
      const updated = await listCharacterEquipment(characterId);
      setEquipment(updated);
      setAddingItem(null);
      setNewItemQty(1);
      toast(`${defMap.get(defId)?.name || 'Item'} adicionado ao inventário`, 'ok');
    } catch (e) {
      toast(friendlyError(e), 'bad');
    }
  };

  if (loading) return <div className="stack-sm"><Loading what="equipamentos" /></div>;

  return (
    <div className="stack">
      {/* Equipped Slots */}
      <Panel title="Equipado" icon="armor">
        <div className="grid cols-2">
          {EQUIPMENT_SLOTS.map(slot => {
            const equipped = equippedMap.get(slot.id);
            const def = equipped ? defMap.get(equipped.equipment_id) : null;
            return (
              <div key={slot.id} className="field" style={{ minHeight: '80px' }}>
                <label>{slot.label} <Icon name={slot.icon as any} className="icon-sm" /></label>
                {equipped && def ? (
                  <div className="row row-between">
                    <div>
                      <strong>{def.name}</strong>
                      <div className="muted small">{def.description}</div>
                      <div className="muted small">Qtd: {equipped.quantity}</div>
                    </div>
                    {canEdit && <Button size="sm" variant="ghost" onClick={() => handleUnequip(equipped)}>Desequipar</Button>}
                  </div>
                ) : (
                  <div className="muted small">— vazio —</div>
                )}
              </div>
            );
          })}
        </div>
      </Panel>

      {/* Inventory Items */}
      <Panel title="Inventário" icon="pack" actions={canEdit && <Button size="sm" icon="plus" onClick={() => setAddingItem(definitions[0]?.id || '')}>Adicionar Item</Button>}>
        {equipment.length === 0 ? (
          <EmptyState icon="pack" title="Inventário vazio">Nenhum item no inventário.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Tipo</th>
                  <th>Raridade</th>
                  <th>Qtd</th>
                  <th>Equipado em</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {equipment.map(item => {
                  const def = defMap.get(item.equipment_id);
                  const isConsumable = def?.item_type === 'consumable';
                  const isEquipped = item.equipped_slot !== null;
                  return (
                    <tr key={item.id}>
                      <td><strong>{def?.name || 'Desconhecido'}</strong><br /><span className="muted small">{def?.description || ''}</span></td>
                      <td>{def?.item_type || '?'}</td>
                      <td><Badge tone={def?.rarity === 'lendario' ? 'accent' : def?.rarity === 'epico' ? 'bad' : undefined}>{def?.rarity || '?'}</Badge></td>
                      <td>{item.quantity}</td>
                      <td>{item.equipped_slot ? <Badge tone="ok">{item.equipped_slot}</Badge> : <span className="muted">—</span>}</td>
                      <td>
                        <div className="row" style={{ gap: '0.5rem' }}>
                          {canEdit && !isEquipped && !isConsumable && (
                            <select className="input" style={{ width: 'auto', minWidth: '160px' }} defaultValue="" onChange={(e) => e.target.value && handleEquip(item, e.target.value as EquipmentSlot)}>
                              <option value="">Equipar em…</option>
                              {EQUIPMENT_SLOTS
                                .filter(s => {
                                  if (!def) return false;
                                  if ('damage' in def) return s.id === 'arma_principal' || s.id === 'arma_secundaria';
                                  if ('defenseBonus' in def) return s.id === 'armadura';
                                  if ('slot' in def) return def.slot === 'amuleto' ? s.id === 'amuleto' : ['encanto1', 'encanto2', 'encanto3'].includes(s.id);
                                  return false;
                                })
                                .map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                          )}
                          {canEdit && isEquipped && <Button size="sm" variant="ghost" onClick={() => handleUnequip(item)}>Desequipar</Button>}
                          {canEdit && isConsumable && <Button size="sm" variant="primary" onClick={() => handleUseConsumable(item)}>Usar</Button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Item Modal */}
        {canEdit && addingItem !== null && (
          <Modal title="Adicionar item ao inventário" onClose={() => setAddingItem(null)}>
            <form className="stack" onSubmit={(e) => { e.preventDefault(); handleAddItem(addingItem!); }}>
              <div className="field">
                <label>Item</label>
                <select className="input" value={addingItem} onChange={(e) => setAddingItem(e.target.value)}>
                  {definitions.map(d => <option key={d.id} value={d.id}>{d.name} ({d.item_type}, {d.rarity})</option>)}
                </select>
              </div>
              <div className="field">
                <label>Quantidade</label>
                <input type="number" className="input" min="1" max="99" value={newItemQty} onChange={(e) => setNewItemQty(Number(e.target.value) || 1)} />
              </div>
              <div className="modal-actions">
                <Button type="button" variant="ghost" onClick={() => setAddingItem(null)}>Cancelar</Button>
                <Button type="submit" variant="primary">Adicionar</Button>
              </div>
            </form>
          </Modal>
        )}
      </Panel>
    </div>
  );
}

/* ================= ABILITIES PANEL ================= */
function AbilitiesPanel({ characterId, canEdit }: { characterId: string; canEdit: boolean }) {
  const toast = useToast();
  const [abilities, setAbilities] = useState<any[]>([]);
  const [definitions, setDefinitions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [abs, defs] = await Promise.all([
          listCharacterAbilities(characterId),
          listAbilityDefinitions({ officialOnly: true })
        ]);
        setAbilities(abs);
        setDefinitions(defs);
      } catch (e) {
        toast(friendlyError(e), 'bad');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [characterId]);

  const defMap = new Map(definitions.map(d => [d.id, d]));

  if (loading) return <div className="stack-sm"><Loading what="habilidades" /></div>;

  return (
    <div className="stack">
      <Panel title="Habilidades Conhecidas" icon="spark" actions={canEdit && <Button size="sm" icon="plus" disabled={!definitions.length}>Aprender Habilidade</Button>}>
        {abilities.length === 0 ? (
          <EmptyState icon="spark" title="Nenhuma habilidade conhecida">{canEdit ? 'Clique em "Aprender Habilidade" para adicionar.' : 'Este personagem não conhece nenhuma habilidade.'}</EmptyState>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Habilidade</th>
                  <th>Tipo</th>
                  <th>Custo</th>
                  <th>Alcance</th>
                  <th>CD</th>
                  <th>Usos</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {abilities.map(a => {
                  const def = defMap.get(a.ability_id);
                  const cost = def?.cost || {};
                  return (
                    <tr key={a.id}>
                      <td><strong>{def?.name || 'Desconhecida'}</strong><br /><span className="muted small">{def?.description || ''}</span></td>
                      <td>{def?.ability_type || '?'}</td>
                      <td>
                        {cost.alma && <Badge tone="accent"><Icon name="heart" /> {cost.alma} ALMA</Badge>}
                        {cost.pv && <Badge tone="bad"><Icon name="droplet" /> {cost.pv} PV</Badge>}
                        {!cost.alma && !cost.pv && <span className="muted">Grátis</span>}
                      </td>
                      <td>{def?.range ? `${def.range.min}–${def.range.max}m` : 'Pessoal'}</td>
                      <td>{a.cooldown_remaining > 0 ? <Badge tone="bad">{a.cooldown_remaining} turnos</Badge> : <span className="muted">Pronto</span>}</td>
                      <td>{a.uses_remaining !== null && a.uses_remaining !== undefined ? <Badge>{a.uses_remaining}</Badge> : <span className="muted">∞</span>}</td>
                      <td>
                        {canEdit && <Button size="sm" variant="ghost" disabled={a.cooldown_remaining > 0 || (a.uses_remaining !== null && a.uses_remaining !== undefined && a.uses_remaining === 0)}>Usar</Button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function CharacterSheetPage() {
  const { query } = useRoute();
  const { profile } = useAuth();
  const id = query.get('id');
  const camps = useAsync(listCampaigns, []);
  const chars = useAsync(listCharacters, [id]);
  const one = useAsync(() => (id ? getCharacter(id) : Promise.resolve(null)), [id]);
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState<Character | null>(null);
  useEffect(() => setSaved(null), [id]);

  if (!id) {
    const mine = (chars.data ?? []).filter((c) => c.owner_id === profile!.id);
    const byId = new Map((camps.data ?? []).map((c) => [c.id, c]));
    return (<>
      <PageHead eyebrow="Ficha de personagem" title="Minhas fichas" actions={<Button variant="primary" icon="plus" disabled={!camps.data?.length} onClick={() => setCreating(true)}>Novo personagem</Button>}>Escolha um personagem para abrir ou editar.</PageHead>
      {chars.loading && !chars.data ? <Panel><Loading what="fichas" /></Panel> : chars.error ? <Panel><EmptyState icon="alert" title="Não foi possível carregar" action={<Button onClick={chars.reload}>Tentar de novo</Button>}>{chars.error}</EmptyState></Panel>
        : !mine.length ? <Panel><EmptyState icon="sheet" title="Você ainda não tem fichas">{camps.data?.length ? 'Crie um personagem em uma das suas campanhas.' : 'Entre em uma campanha com um convite para criar seu personagem.'}</EmptyState></Panel>
        : <div className="grid cols-2">{mine.map((c) => <CharCard key={c.id} c={c} campaign={byId.get(c.campaign_id)} />)}</div>}
      {creating && camps.data && <NewCharacter campaigns={camps.data} onClose={() => setCreating(false)} />}
    </>);
  }
  const ch = saved ?? one.data;
  if (one.loading && !ch) return <><PageHead eyebrow="Ficha de personagem" title="Ficha" /><Panel><Loading what="ficha" /></Panel></>;
  if (one.error) return <><PageHead eyebrow="Ficha de personagem" title="Ficha" /><Panel><EmptyState icon="alert" title="Não foi possível carregar a ficha" action={<Button onClick={one.reload}>Tentar de novo</Button>}>{one.error}</EmptyState></Panel></>;
  if (!ch) return <><PageHead eyebrow="Ficha de personagem" title="Ficha" /><Panel><EmptyState icon="lock" title="Ficha não encontrada" action={<LinkButton to="/jogador/ficha">Minhas fichas</LinkButton>}>Ela não existe ou você não tem permissão para vê-la.</EmptyState></Panel></>;
  return (<>
    <PageHead eyebrow="Ficha de personagem" title={ch.name} actions={<Link to="/jogador/ficha">← Minhas fichas</Link>}>{ch.owner_id === profile!.id ? 'Suas alterações são salvas no banco quando você clica em “Salvar ficha”.' : 'Você está vendo a ficha de outro participante como mestre da campanha.'}</PageHead>
    <SheetEditor key={ch.id} ch={ch} canStage={profile!.role === 'mestre' && ch.owner_id !== profile!.id} onSaved={setSaved} />
  </>);
}
