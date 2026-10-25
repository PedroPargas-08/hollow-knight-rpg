import { useEffect, useState, type FormEvent } from 'react';
import { Link, navigate, useRoute } from '../app/router';
import { useAuth } from '../app/auth';
import { SHEET_TABS, type SheetTab } from '../app/nav';
import { Alert, Badge, Button, EmptyState, Field, LinkButton, Meter, PageHead, Panel, TabPanel, Tabs } from '../components/ui';
import { MaskGlyph } from '../components/domain';
import { Icon } from '../components/Icon';
import { Modal, useToast } from '../components/overlay';
import { createCharacter, getCharacter, listCampaigns, listCharacters, STATUS_LABEL, updateCharacter, type Campaign, type Character } from '../lib/api';
import { ATTRIBUTES, clampInt, defaultSheet, friendlyError, type Sheet } from '../lib/sheet';
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
  useEffect(() => { setD({ name: ch.name, stage: ch.stage, sheet: ch.sheet }); }, [ch]);
  const dirty = !same(d, ch);
  const upd = (patch: Partial<Sheet>) => setD((x) => ({ ...x, sheet: { ...x.sheet, ...patch } }));
  const setTab = (id: SheetTab) => navigate(`/jogador/ficha?id=${ch.id}&aba=${id}`);

  const save = async () => {
    if (!d.name.trim()) { setError('O nome do personagem não pode ficar vazio.'); return; }
    setSaving(true); setError(null);
    try {
      const patch: { name: string; sheet: Sheet; stage?: number } = { name: d.name, sheet: d.sheet };
      if (canStage && d.stage !== ch.stage) patch.stage = d.stage;   // o banco recusa se você não administra a campanha
      onSaved(await updateCharacter(ch.id, patch)); toast('Ficha salva.', 'ok');
    } catch (x) { setError(friendlyError(x)); } finally { setSaving(false); }
  };
  const num = (id: string, label: string, value: number, set: (n: number) => void, max = 999) => (
    <div className="field"><label htmlFor={id}>{label}</label><input id={id} className="input" type="number" inputMode="numeric" min={0} max={max} value={value} onChange={(e) => set(clampInt(e.target.value, 0, max, 0))} /></div>);
  const txt = (id: string, label: string, value: string, set: (s: string) => void, max: number, area = false) => (
    <div className="field"><label htmlFor={id}>{label}</label>{area ? <textarea id={id} className="input" maxLength={max} value={value} onChange={(e) => set(e.target.value)} /> : <input id={id} className="input" maxLength={max} value={value} onChange={(e) => set(e.target.value)} />}</div>);

  return (
    <>
      <div className="row row-between" style={{ marginBottom: '.8rem' }}>
        <div className="row"><Badge tone="accent"><Icon name="star" /> Estágio {ch.stage}</Badge>{dirty && <Badge tone="bad">Alterações não salvas</Badge>}</div>
        <div className="row"><Button variant="ghost" disabled={!dirty || saving} onClick={() => setD({ name: ch.name, stage: ch.stage, sheet: ch.sheet })}>Descartar</Button><Button variant="primary" icon="check" loading={saving} disabled={!dirty} onClick={save}>Salvar ficha</Button></div>
      </div>
      {error && <div style={{ marginBottom: '.8rem' }}><Alert tone="bad">{error}</Alert></div>}
      <div className="sheet-grid">
        <aside className="stack sheet-side"><Panel>
          <div className="crest"><div className="portrait" aria-hidden="true"><MaskGlyph className="mask" /></div><div><div className="crest-name">{d.name || 'Sem nome'}</div><div className="muted small">Estágio {ch.stage}</div></div></div>
          <hr className="divider" /><div className="stack-sm"><Meter label="PV" kind="pv" now={d.sheet.pv.now} max={d.sheet.pv.max} /><Meter label="ALMA" kind="alma" now={d.sheet.alma.now} max={d.sheet.alma.max} /></div>
          <div className="row" style={{ marginTop: '.8rem' }}><Badge><Icon name="shield" /> Defesa {d.sheet.defense}</Badge></div>
        </Panel></aside>
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
  <Alert tone="warn">
    Lista de atributos provisória: o sistema de regras ainda não foi definido
    e nada é calculado automaticamente.
  </Alert>
  <div className="attrs">
    {ATTRIBUTES.map((a, i) => (
      <div className="attr" key={a} style={{ padding: '.7rem .9rem' }}>
        {canStage
          ? num(
              `f-attr-${i}`,
              a,
              d.sheet.attributes[a],
              (n) => upd({
                attributes: { ...d.sheet.attributes, [a]: n },
              }),
              30,
            )
          : <div className="field">
              <label>{a}</label>
              <input
                className="input"
                type="number"
                value={d.sheet.attributes[a]}
                readOnly
                aria-label={`${a} (somente leitura)`}
              />
            </div>}
      </div>
    ))}
  </div>
</div>}
            {tab === 'combate' && <Panel title="Combate e sobrevivência" icon="heart">
  <div className="grid cols-2">
    {num(
      'f-pv-now',
      'PV atual',
      d.sheet.pv.now,
      (n) => upd({
        pv: {
          ...d.sheet.pv,
          now: Math.min(n, d.sheet.pv.max),
        },
      }),
      d.sheet.pv.max,
    )}

    {canStage
      ? num(
          'f-pv-max',
          'PV máximo',
          d.sheet.pv.max,
          (n) => upd({
            pv: {
              max: n,
              now: Math.min(d.sheet.pv.now, n),
            },
          }),
        )
      : <div className="field">
          <label htmlFor="f-pv-max">PV máximo</label>
          <input
            id="f-pv-max"
            className="input"
            type="number"
            value={d.sheet.pv.max}
            readOnly
          />
        </div>}

    {num(
      'f-alma-now',
      'ALMA atual',
      d.sheet.alma.now,
      (n) => upd({
        alma: {
          ...d.sheet.alma,
          now: Math.min(n, d.sheet.alma.max),
        },
      }),
      d.sheet.alma.max,
    )}

    {canStage
      ? num(
          'f-alma-max',
          'ALMA máxima',
          d.sheet.alma.max,
          (n) => upd({
            alma: {
              max: n,
              now: Math.min(d.sheet.alma.now, n),
            },
          }),
        )
      : <div className="field">
          <label htmlFor="f-alma-max">ALMA máxima</label>
          <input
            id="f-alma-max"
            className="input"
            type="number"
            value={d.sheet.alma.max}
            readOnly
          />
        </div>}

    {canStage
      ? num(
          'f-def',
          'Defesa',
          d.sheet.defense,
          (n) => upd({ defense: n }),
          99,
        )
      : <div className="field">
          <label htmlFor="f-def">Defesa</label>
          <input
            id="f-def"
            className="input"
            type="number"
            value={d.sheet.defense}
            readOnly
          />
        </div>}
  </div>
  <p className="hint">
    Sem cálculo automático de dano ou recuperação nesta fase.
  </p>
</Panel>}
            {(tab === 'habilidades' || tab === 'equipamento') && <Panel title={tab === 'habilidades' ? 'Habilidades' : 'Equipamento e inventário'} icon={tab === 'habilidades' ? 'spark' : 'pack'}>
              {(tab === 'habilidades' ? d.sheet.abilities : d.sheet.equipment).length === 0
                ? <EmptyState icon={tab === 'habilidades' ? 'spark' : 'pack'} title="Nada cadastrado">A edição de {tab === 'habilidades' ? 'habilidades' : 'itens'} chega em uma fase futura.</EmptyState>
                : <pre className="small" style={{ overflow: 'auto' }}>{JSON.stringify(tab === 'habilidades' ? d.sheet.abilities : d.sheet.equipment, null, 2)}</pre>}</Panel>}
            {tab === 'narrativa' && <Panel title="Narrativa" icon="feather"><div className="stack">
              {txt('f-hist', 'História', d.sheet.history, (v) => upd({ history: v }), 5000, true)}{txt('f-pers', 'Personalidade', d.sheet.personality, (v) => upd({ personality: v }), 1000)}{txt('f-notes', 'Anotações', d.sheet.notes, (v) => upd({ notes: v }), 5000, true)}</div></Panel>}
          </TabPanel>
        </div>
      </div>
    </>
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
