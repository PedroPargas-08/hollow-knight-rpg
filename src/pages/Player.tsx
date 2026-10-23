import { useState } from 'react';
import { Link, navigate, useRoute } from '../app/router';
import { useDemo } from '../app/demo';
import { SHEET_TABS, type SheetTab } from '../app/nav';
import { Alert, Badge, Button, DemoBadge, EmptyState, LinkButton, Meter, PageHead, Panel, Seg, TabPanel, Tabs } from '../components/ui';
import { CampaignArt, MaskGlyph, RegionMap } from '../components/domain';
import { Icon } from '../components/Icon';
import { usePlanned, useToast } from '../components/overlay';
import { campaigns, character as ch, demoUsers, nextObjectives, notifications, quests, regions, rollHistory } from '../data/demo';

function Crest({ compact }: { compact?: boolean }) {
  return (
    <div className="crest">
      <div className="portrait" aria-hidden="true"><MaskGlyph className="mask" /></div>
      <div><div className="crest-name">{ch.name}</div><div className="muted small">{ch.stage} · {ch.campaign}</div>{!compact && <p className="dim small" style={{ margin: '.4rem 0 0' }}>{ch.concept}</p>}</div>
    </div>
  );
}

/* ================= PAINEL DO JOGADOR ================= */
export function PlayerDashboard() {
  const { empty } = useDemo();
  const toast = useToast();
  const [done, setDone] = useState<Record<number, boolean>>({});
  const [note, setNote] = useState('');
  const camp = campaigns.find((c) => c.id === ch.campaignId)!;
  const known = quests.filter((q) => q.visibility === 'jogadores');
  const revealed = regions.filter((r) => r.revealed);

  return (
    <>
      <PageHead eyebrow="Painel do jogador" title={`Bem-vindo de volta, ${demoUsers.jogador.name}`} actions={<DemoBadge />}>
        {empty ? 'Você ainda não participa de nenhuma campanha.' : <>Sua jornada em <strong>{camp.name}</strong> continua.</>}
      </PageHead>

      <div className="dash">
        <div className="stack">
          <Panel title="Campanha ativa" icon="flag" actions={!empty && <Badge tone="ok">{camp.state}</Badge>}>
            {empty ? <EmptyState icon="flag" title="Nenhuma campanha ainda" action={<LinkButton to="/campanhas" variant="primary">Ver campanhas</LinkButton>}>Quando um mestre convidar você, a campanha aparecerá aqui.</EmptyState> : (
              <div className="camp-mini"><div className="art"><CampaignArt art={camp.art} /></div>
                <div><h3 style={{ marginBottom: '.2rem' }}>{camp.name}</h3><p className="muted small" style={{ margin: 0 }}>Mestre: {camp.master} · {camp.players.length} participantes</p>
                  <p className="dim" style={{ margin: '.6rem 0 .3rem' }}><strong>Última sessão:</strong> {camp.lastSession}</p>
                  <LinkButton to="/campanhas" size="sm">Minhas campanhas</LinkButton></div></div>)}
          </Panel>

          <Panel title="Personagem principal" icon="user">
            {empty ? <EmptyState icon="user" title="Sem personagem">Você ainda não tem personagem. A criação de fichas chega em uma fase futura.</EmptyState> : (
              <div className="stack">
                <Crest />
                <div className="grid cols-2"><Meter label="PV" kind="pv" now={ch.pv.now} max={ch.pv.max} /><Meter label="ALMA" kind="alma" now={ch.alma.now} max={ch.alma.max} /></div>
                <div className="row">
                  <LinkButton to="/jogador/ficha" variant="primary" icon="sheet" size="sm">Abrir ficha</LinkButton>
                  <LinkButton to="/jogador/ficha?aba=habilidades" icon="spark" size="sm">Habilidades</LinkButton>
                  <LinkButton to="/jogador/ficha?aba=equipamento" icon="sword" size="sm">Equipamento</LinkButton>
                  <LinkButton to="/jogador/ficha?aba=equipamento" icon="pack" size="sm">Inventário</LinkButton>
                </div>
              </div>)}
          </Panel>

          <Panel title="Missões conhecidas" icon="flag">
            {empty || !known.length ? <EmptyState icon="flag" title="Nenhuma missão conhecida">Missões reveladas pelo mestre aparecerão aqui.</EmptyState> : (
              <ul className="list">{known.map((q) => (
                <li key={q.id} className="list-row"><Icon name={q.status === 'Concluída' ? 'check' : 'flag'} /><div className="grow"><strong>{q.title}</strong><span className="dim small">{q.text}</span></div><Badge tone={q.status === 'Concluída' ? 'ok' : 'accent'}>{q.status}</Badge></li>))}</ul>)}
          </Panel>

          <Panel title="Mapas e regiões reveladas" icon="map" actions={<Badge>{empty ? 0 : revealed.length} reveladas</Badge>}>
            {empty ? <EmptyState icon="map" title="Nenhuma região revelada">O mapa se completa conforme o mestre revela regiões.</EmptyState> : (<><RegionMap regions={regions} showSecret={false} />
              <p className="hint">Regiões ainda não reveladas pelo mestre não aparecem aqui — nem mesmo o nome.</p></>)}
          </Panel>
        </div>

        <div className="stack">
          <Alert tone="info" icon="eye">Você vê apenas o que foi revelado a você. Informações privadas do mestre nunca aparecem neste painel.</Alert>
          <Panel title="Próximos objetivos" icon="compass">
            {empty ? <p className="muted">Sem objetivos por enquanto.</p> : (
              <ul className="list">{nextObjectives.map((o, i) => <li key={o} className="list-row"><label className="check" style={{ minHeight: 'auto' }}><input type="checkbox" checked={!!done[i]} onChange={() => setDone({ ...done, [i]: !done[i] })} /><span style={{ textDecoration: done[i] ? 'line-through' : undefined, opacity: done[i] ? .6 : 1 }}>{o}</span></label></li>)}</ul>)}
          </Panel>
          <Panel title="Notificações" icon="bell">
            {empty ? <p className="muted">Nenhuma notificação.</p> : <ul className="list">{notifications.map((n) => <li key={n.id} className="list-row"><div className="grow"><span>{n.text}</span><span className="muted small" style={{ display: 'block' }}>{n.when}</span></div></li>)}</ul>}
          </Panel>
          <Panel title="Diário pessoal" icon="feather">
            <label className="sr-only" htmlFor="diary">Anotações pessoais</label>
            <textarea id="diary" className="input" placeholder="Anote o que seu personagem descobriu…" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row row-between" style={{ marginTop: '.6rem' }}><span className="hint">Demonstração: não é salvo.</span>
              <Button size="sm" disabled={!note.trim()} onClick={() => toast('Anotação não salva — persistência planejada para a próxima fase.')}>Salvar</Button></div>
          </Panel>
          <Panel title="Histórico de rolagens" icon="dice" actions={<DemoBadge text="Exemplo" />}>
            {empty ? <p className="muted">Nenhuma rolagem registrada.</p> : <ul className="list">{rollHistory.map((r, i) => <li key={i} className="list-row"><div className="grow"><strong>{r.what}</strong><span className="muted small">{r.when}</span></div><Badge>{r.result}</Badge></li>)}</ul>}
            <p className="hint" style={{ margin: '.5rem 0 0' }}>A plataforma ainda não rola dados.</p>
          </Panel>
        </div>
      </div>
    </>
  );
}

/* ================= FICHA DE PERSONAGEM ================= */
const EQUIP_LABELS: Record<keyof typeof ch.equipment, string> = { armas: 'Armas', protecoes: 'Armaduras e proteções', amuletos: 'Amuletos e acessórios', consumiveis: 'Consumíveis', especiais: 'Itens especiais' };

export function CharacterSheetPage() {
  const { query } = useRoute();
  const { empty } = useDemo();
  const planned = usePlanned();
  const tab = (SHEET_TABS.find((t) => t.id === query.get('aba'))?.id ?? 'identidade') as SheetTab;
  const [filter, setFilter] = useState<'todas' | 'disponiveis' | 'indisponiveis'>('todas');
  const relevant = quests.filter((q) => q.visibility === 'jogadores');
  const abilities = ch.abilities.filter((a) => filter === 'todas' || (filter === 'disponiveis' ? a.ok : !a.ok));

  if (empty) return (<><PageHead eyebrow="Ficha de personagem" title="Ficha" /><Panel><EmptyState icon="sheet" title="Nenhuma ficha disponível" action={<LinkButton to="/campanhas" variant="primary">Ver campanhas</LinkButton>}>Você ainda não tem um personagem. A criação de fichas chega em uma fase futura.</EmptyState></Panel></>);

  return (
    <>
      <PageHead eyebrow="Ficha de personagem" title={ch.short} actions={<><DemoBadge /><Button icon="feather" onClick={() => planned('Editar ficha')}>Editar ficha</Button></>}>
        Todos os valores desta ficha são fictícios e não possuem fórmulas reais. Edição e salvamento são planejados para a próxima fase.
      </PageHead>
      <div className="sheet-grid">
        <aside className="stack sheet-side">
          <Panel>
            <Crest compact />
            <hr className="divider" />
            <div className="stack-sm"><Meter label="PV" kind="pv" now={ch.pv.now} max={ch.pv.max} /><Meter label="ALMA" kind="alma" now={ch.alma.now} max={ch.alma.max} /></div>
            <div className="row" style={{ marginTop: '.8rem' }}><Badge><Icon name="shield" /> Defesa {ch.defense}</Badge>{ch.conditions.map((c) => <Badge key={c.name} tone="accent">{c.name}</Badge>)}</div>
          </Panel>
        </aside>
        <div>
          <Tabs<SheetTab> label="Seções da ficha" items={SHEET_TABS.map((t) => ({ id: t.id, label: t.label, icon: t.icon }))} value={tab} onChange={(id) => navigate(`/jogador/ficha?aba=${id}`)} />
          <TabPanel id={tab}>
            {tab === 'identidade' && (
              <div className="grid cols-2">
                <Panel title="Identidade" icon="user"><dl className="kv"><dt>Nome</dt><dd>{ch.name}</dd><dt>Conceito</dt><dd>{ch.concept}</dd><dt>Progressão</dt><dd>{ch.stage}</dd><dt>Arquétipo</dt><dd>{ch.archetype}</dd><dt>Origem</dt><dd>{ch.origin}</dd><dt>Campanha</dt><dd><Link to="/campanhas">{ch.campaign}</Link></dd></dl></Panel>
                <Panel title="Retrato" icon="mask" quiet><div className="portrait-big" aria-hidden="true"><MaskGlyph className="mask" /></div><p className="hint center" style={{ margin: 0 }}>Espaço para ilustração. Upload de imagem: planejado.</p></Panel>
              </div>)}
            {tab === 'atributos' && (
              <div className="stack">
                <Alert tone="warn">Lista e valores <strong>demonstrativos</strong>. Os atributos reais e as fórmulas de modificadores ainda não foram definidos.</Alert>
                <div className="attrs">{ch.attributes.map((a) => (
                  <details key={a.key} className="attr"><summary><span className="attr-name">{a.key}</span><span className="attr-val">{a.value}</span><Badge>{a.mod}</Badge></summary><p className="dim small" style={{ margin: '.6rem 0 0' }}>{a.note} <span className="muted">(descrição de exemplo)</span></p></details>))}</div>
              </div>)}
            {tab === 'combate' && (
              <div className="grid cols-2">
                <Panel title="Sobrevivência" icon="heart"><div className="stack"><Meter label="PV — pontos de vida" kind="pv" now={ch.pv.now} max={ch.pv.max} /><Meter label="ALMA" kind="alma" now={ch.alma.now} max={ch.alma.max} /><dl className="kv"><dt>Defesa</dt><dd>{ch.defense} <span className="muted small">(valor de exemplo; regra ainda não definida)</span></dd></dl>
                  <Button size="sm" onClick={() => planned('Ajustar PV/ALMA')}>Ajustar valores</Button></div></Panel>
                <Panel title="Condições e estados" icon="alert"><ul className="list">{ch.conditions.map((c) => <li className="list-row" key={c.name}><Badge tone="accent">{c.name}</Badge><span className="dim small grow">{c.note}</span></li>)}</ul>
                  <div className="row" style={{ marginTop: '.6rem' }}><Badge>Em combate: não</Badge><Badge>Descanso: pendente</Badge></div></Panel>
              </div>)}
            {tab === 'habilidades' && (
              <div className="stack">
                <div className="row row-between"><Seg value={filter} onChange={setFilter} label="Filtrar habilidades" items={[{ id: 'todas', label: 'Todas' }, { id: 'disponiveis', label: 'Disponíveis' }, { id: 'indisponiveis', label: 'Indisponíveis' }]} /><span className="hint">Sem cálculos reais de custo.</span></div>
                {abilities.length === 0 ? <EmptyState icon="spark" title="Nenhuma habilidade neste filtro" /> : (
                  <div className="grid cols-2">{abilities.map((a) => (
                    <Panel key={a.name} className={a.ok ? '' : 'locked'} title={a.name} icon={a.ok ? 'spark' : 'lock'} actions={<Badge tone={a.ok ? 'ok' : undefined}>{a.ok ? 'Disponível' : 'Indisponível'}</Badge>}>
                      <p className="dim">{a.text}</p><div className="row"><Badge>Custo: {a.cost}</Badge><span className="muted small">Requisito: {a.req}</span></div></Panel>))}</div>)}
              </div>)}
            {tab === 'equipamento' && (
              <div className="stack">{(Object.keys(ch.equipment) as (keyof typeof ch.equipment)[]).map((k) => (
                <details key={k} className="acc" open={k === 'armas' || k === 'consumiveis'}><summary><Icon name="chevron" className="acc-chev" /> {EQUIP_LABELS[k]} <Badge>{ch.equipment[k].length}</Badge></summary>
                  <ul className="list">{ch.equipment[k].map((it) => <li className="list-row" key={it.name}><div className="grow"><strong>{it.name}</strong><span className="dim small">{it.text}</span></div><Badge>×{it.qty}</Badge></li>)}</ul></details>))}</div>)}
            {tab === 'narrativa' && (
              <div className="grid cols-2">
                <Panel title="História e personalidade" icon="feather"><p>{ch.history}</p><p className="dim"><strong>Personalidade:</strong> {ch.personality}</p></Panel>
                <Panel title="Anotações e características" icon="book"><ul>{ch.notes.map((n) => <li key={n}>{n}</li>)}</ul></Panel>
                <Panel title="Missões relevantes" icon="flag"><ul className="list">{relevant.map((q) => <li className="list-row" key={q.id}><div className="grow"><strong>{q.title}</strong></div><Badge tone={q.status === 'Concluída' ? 'ok' : 'accent'}>{q.status}</Badge></li>)}</ul></Panel>
                <Panel title="Resumo de progressão" icon="hourglass"><ol className="timeline">{ch.progression.map((p) => <li key={p.when}><strong>{p.when}</strong><span className="dim"> — {p.what}</span></li>)}</ol></Panel>
              </div>)}
          </TabPanel>
        </div>
      </div>
    </>
  );
}
