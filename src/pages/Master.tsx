import { useState, type ReactNode } from 'react';
import { Link, navigate } from '../app/router';
import { useDemo } from '../app/demo';
import { MASTER_SECTIONS, type MasterSection } from '../app/nav';
import { Alert, Badge, Button, DemoBadge, EmptyState, Meter, PageHead, Panel, Seg, TabPanel, Tabs, VisTag } from '../components/ui';
import { RegionMap } from '../components/domain';
import { Icon } from '../components/Icon';
import { Modal, usePlanned, useToast } from '../components/overlay';
import { bestiary, campaigns, encounters, eventLog, masterPlayers, quests, regions as regionData, rewardPackages, sessionAgenda } from '../data/demo';
import type { IconName } from '../types';

const Legend = () => (
  <div className="stack-sm">
    <div className="row"><VisTag v="publico" /><span className="dim small">Qualquer pessoa, inclusive visitantes (ex.: regras públicas).</span></div>
    <div className="row"><VisTag v="jogadores" /><span className="dim small">Participantes da campanha, só após a revelação do mestre.</span></div>
    <div className="row"><VisTag v="mestre" /><span className="dim small">Somente o mestre desta campanha. Nunca aparece nos painéis dos jogadores.</span></div>
  </div>
);
const Planned = ({ children }: { children: ReactNode }) => <Alert tone="info" icon="hourglass">{children} <strong>Controles demonstrativos</strong> — a lógica real chega em fases futuras.</Alert>;
const Stat = ({ n, label, icon }: { n: number; label: string; icon: IconName }) => <div className="stat"><Icon name={icon} /><b>{n}</b><span className="muted small">{label}</span></div>;

export function MasterPage({ section }: { section: MasterSection }) {
  const { empty } = useDemo();
  const planned = usePlanned();
  const toast = useToast();
  const mine = empty ? [] : campaigns.filter((c) => c.asMaster);
  const [campId, setCampId] = useState('cinzas');
  const camp = mine.find((c) => c.id === campId) ?? mine[0];
  const hasData = !!camp && camp.id === 'cinzas';
  const sec = MASTER_SECTIONS.find((s) => s.id === section)!;

  const [agenda, setAgenda] = useState(sessionAgenda.map((a) => a.done));
  const [filter, setFilter] = useState<'todas' | 'Ativa' | 'Concluída' | 'Secreta'>('todas');
  const [bTab, setBTab] = useState<'npcs' | 'criaturas' | 'chefes'>('npcs');
  const [reveal, setReveal] = useState<Record<string, boolean>>(Object.fromEntries(regionData.map((r) => [r.id, r.revealed])));
  const [note, setNote] = useState('');
  const [grant, setGrant] = useState<string | null>(null);
  const mapRegions = regionData.map((r) => ({ ...r, revealed: reveal[r.id] }));

  const noCamp = !camp;
  const emptyData = (icon: IconName, title: string, text: string) => <Panel><EmptyState icon={icon} title={title}>{text}</EmptyState></Panel>;

  const body = (() => {
    if (noCamp) return <Panel><EmptyState icon="flag" title="Nenhuma campanha para administrar" action={<Button variant="primary" icon="plus" onClick={() => planned('Criar campanha')}>Criar campanha</Button>}>Crie uma campanha para liberar as ferramentas de sessão, missões, criaturas e mapas.</EmptyState></Panel>;
    switch (section) {
      case 'visao': return (
        <div className="stack">
          <Panel title="Tarefas frequentes" icon="spark">
            <div className="row">
              <Button variant="primary" icon="hourglass" onClick={() => navigate('/mestre/sessao')}>Iniciar sessão</Button>
              <Button icon="flag" onClick={() => planned('Nova missão')}>Nova missão</Button>
              <Button icon="skull" onClick={() => planned('Novo NPC ou criatura')}>Novo NPC</Button>
              <Button icon="map" onClick={() => navigate('/mestre/mapas')}>Revelar região</Button>
              <Button icon="gem" onClick={() => navigate('/mestre/recompensas')}>Conceder recompensa</Button>
            </div>
          </Panel>
          <div className="grid cols-2">
            <Panel title={`Resumo — ${camp.name}`} icon="crown" actions={<Badge tone={camp.state === 'Em andamento' ? 'ok' : undefined}>{camp.state}</Badge>}>
              <div className="stats">
                <Stat n={hasData ? masterPlayers.length : 0} label="jogadores" icon="users" /><Stat n={hasData ? masterPlayers.length : 0} label="personagens" icon="user" />
                <Stat n={hasData ? quests.length : 0} label="missões" icon="flag" /><Stat n={hasData ? encounters.length : 0} label="encontros" icon="sword" />
              </div>
              <p className="dim small" style={{ margin: '.8rem 0 0' }}>{camp.lastSession}</p>
            </Panel>
            <Panel title="Pendências" icon="alert" actions={<VisTag v="mestre" />}>
              {hasData ? <ul className="list"><li className="list-row">Tâmaro ausente — revisar ficha antes da sessão.</li><li className="list-row">Missão secreta aguardando gatilho.</li><li className="list-row">Chefe “O Badalo Oco” ainda em rascunho.</li></ul> : <p className="muted">Nenhuma pendência nesta campanha.</p>}
            </Panel>
          </div>
          <div className="grid cols-2">
            <Panel title="Campanhas administradas" icon="flag">
              <ul className="list">{mine.map((c) => <li className="list-row" key={c.id}><div className="grow"><strong>{c.name}</strong><span className="muted small">{c.players.length} participante(s)</span></div><Badge tone={c.state === 'Em andamento' ? 'ok' : undefined}>{c.state}</Badge></li>)}</ul>
              <Link to="/campanhas">Ver todas as campanhas →</Link>
            </Panel>
            <Panel title="Quem vê o quê" icon="eye"><Legend /></Panel>
          </div>
        </div>);
      case 'sessao': return (
        <div className="stack">
          <Planned>Ferramentas de sessão de exemplo; não há combate nem rolagem real.</Planned>
          <div className="grid cols-2">
            <Panel title="Pauta da sessão" icon="hourglass">
              <ul className="list">{sessionAgenda.map((a, i) => <li className="list-row" key={a.text}><label className="check" style={{ minHeight: 'auto' }}><input type="checkbox" checked={agenda[i]} onChange={() => setAgenda(agenda.map((v, j) => (j === i ? !v : v)))} /><span style={{ opacity: agenda[i] ? .6 : 1 }}>{a.text}</span></label></li>)}</ul>
            </Panel>
            <Panel title="Ordem de turnos (exemplo)" icon="sword">
              {hasData ? <ol className="timeline">{masterPlayers.map((p) => <li key={p.name}><strong>{p.character}</strong> <span className="muted small">— posição de exemplo</span></li>)}</ol> : <p className="muted">Nenhum participante.</p>}
              <div className="row"><Button size="sm" onClick={() => planned('Próximo turno')}>Próximo turno</Button><Button size="sm" variant="ghost" onClick={() => planned('Encerrar sessão')}>Encerrar sessão</Button></div>
            </Panel>
          </div>
        </div>);
      case 'jogadores': return !hasData ? emptyData('users', 'Nenhum jogador ainda', 'Convide jogadores para que seus personagens apareçam aqui.') : (
        <Panel title="Participantes e personagens" icon="users" actions={<Button size="sm" icon="plus" onClick={() => planned('Convidar jogador')}>Convidar</Button>}>
          <div className="table-wrap"><table><thead><tr><th>Jogador</th><th>Personagem</th><th>PV</th><th>ALMA</th><th>Estado</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{masterPlayers.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.character}</td><td style={{ minWidth: 110 }}><Meter label="PV" kind="pv" small now={p.pv[0]} max={p.pv[1]} /></td><td style={{ minWidth: 110 }}><Meter label="ALMA" kind="alma" small now={p.alma[0]} max={p.alma[1]} /></td><td><Badge tone={p.status === 'Presente' ? 'ok' : undefined}>{p.status}</Badge></td><td><Button size="sm" variant="ghost" onClick={() => planned(`Ver ficha de ${p.character}`)}>Ver ficha</Button></td></tr>)}</tbody></table></div>
        </Panel>);
      case 'missoes': {
        if (!hasData) return emptyData('flag', 'Nenhuma missão criada', 'Crie missões e decida quando revelá-las aos jogadores.');
        const list = quests.filter((q) => filter === 'todas' || q.status === filter);
        return (
          <Panel title="Missões e objetivos" icon="flag" actions={<Button size="sm" icon="plus" onClick={() => planned('Nova missão')}>Nova missão</Button>}>
            <div style={{ marginBottom: '.8rem' }}><Seg value={filter} onChange={setFilter} label="Filtrar missões" items={[{ id: 'todas', label: 'Todas' }, { id: 'Ativa', label: 'Ativas' }, { id: 'Concluída', label: 'Concluídas' }, { id: 'Secreta', label: 'Secretas' }]} /></div>
            {list.length === 0 ? <p className="muted">Nenhuma missão neste filtro.</p> : <ul className="list">{list.map((q) => <li className="list-row" key={q.id}><div className="grow"><strong>{q.title}</strong><span className="dim small">{q.text}</span></div><VisTag v={q.visibility} /><Badge>{q.status}</Badge><Button size="sm" variant="ghost" onClick={() => planned('Editar missão')}>Editar</Button></li>)}</ul>}
          </Panel>);
      }
      case 'bestiario': {
        if (!hasData) return emptyData('skull', 'Bestiário vazio', 'Cadastre NPCs, criaturas e chefes para usá-los nos encontros.');
        const items = bestiary[bTab];
        return (
          <Panel title="NPCs, criaturas e chefes" icon="skull" actions={<Button size="sm" icon="plus" onClick={() => planned('Novo registro')}>Novo</Button>}>
            <Tabs<typeof bTab> label="Tipo de registro" value={bTab} onChange={setBTab} items={[{ id: 'npcs', label: 'NPCs' }, { id: 'criaturas', label: 'Criaturas' }, { id: 'chefes', label: 'Chefes' }]} />
            <TabPanel id={bTab}><ul className="list">{items.map((i) => <li className="list-row" key={i.name}><div className="grow"><strong>{i.name}</strong><span className="dim small">{i.note}</span></div><VisTag v={i.visibility} /><Button size="sm" variant="ghost" onClick={() => planned(`Abrir ${i.name}`)}>Abrir</Button></li>)}</ul></TabPanel>
          </Panel>);
      }
      case 'mapas': return !hasData ? emptyData('map', 'Nenhum mapa ainda', 'Crie regiões e escolha quais os jogadores podem ver.') : (
        <div className="grid cols-2">
          <Panel title="Mapa (visão do mestre)" icon="map" actions={<VisTag v="mestre" />}><RegionMap regions={mapRegions} showSecret /><p className="hint">Linhas tracejadas e “?” indicam regiões secretas.</p></Panel>
          <Panel title="Revelação de regiões" icon="eye">
            <ul className="list">{mapRegions.map((r) => <li className="list-row" key={r.id}><div className="grow"><strong>{r.name}</strong><span className="dim small">{r.note}</span></div><Badge tone={r.revealed ? 'ok' : undefined}>{r.revealed ? 'Revelada' : 'Secreta'}</Badge>
              <Button size="sm" onClick={() => { setReveal({ ...reveal, [r.id]: !r.revealed }); toast(`“${r.name}” ${r.revealed ? 'ocultada' : 'revelada'} apenas nesta tela de demonstração.`); }}>{r.revealed ? 'Ocultar' : 'Revelar'}</Button></li>)}</ul>
            <p className="hint">Somente o mestre controla a revelação. A alteração não é salva e não afeta o painel do jogador nesta fase.</p>
          </Panel>
        </div>);
      case 'encontros': return !hasData ? emptyData('sword', 'Nenhum encontro', 'Prepare encontros e combates para suas sessões.') : (
        <div className="stack"><Planned>O combate não é funcional nesta fase.</Planned>
          <Panel title="Encontros e combates" icon="sword" actions={<Button size="sm" icon="plus" onClick={() => planned('Novo encontro')}>Novo encontro</Button>}>
            <ul className="list">{encounters.map((e) => <li className="list-row" key={e.name}><div className="grow"><strong>{e.name}</strong><span className="muted small">{e.where}</span></div><Badge tone={e.state === 'Pronto' ? 'ok' : undefined}>{e.state}</Badge><Button size="sm" variant="ghost" onClick={() => planned(`Preparar “${e.name}”`)}>Preparar</Button></li>)}</ul>
          </Panel></div>);
      case 'recompensas': return !hasData ? emptyData('gem', 'Sem recompensas', 'Crie pacotes de recompensa para conceder ao grupo.') : (
        <div className="grid cols-2">
          <Panel title="Pacotes de recompensa" icon="gem" actions={<VisTag v="mestre" />}>
            <ul className="list">{rewardPackages.map((r) => <li className="list-row" key={r.name}><div className="grow"><strong>{r.name}</strong><span className="dim small">Para: {r.for} — {r.note}</span></div><Button size="sm" onClick={() => setGrant(r.name)}>Conceder</Button></li>)}</ul>
          </Panel>
          <Panel title="Progressão do grupo" icon="star"><ul className="list">{masterPlayers.map((p, i) => <li className="list-row" key={p.name}><div className="grow">{p.character}</div><Badge>Estágio {3 - (i % 2)} (exemplo)</Badge></li>)}</ul></Panel>
        </div>);
      case 'diario': return (
        <div className="grid cols-2">
          <Panel title="Registro de eventos" icon="hourglass">{!hasData ? <p className="muted">Nenhum evento registrado.</p> : <ul className="list">{eventLog.map((e, i) => <li className="list-row" key={i}><div className="grow"><span>{e.text}</span><span className="muted small" style={{ display: 'block' }}>{e.when}</span></div><VisTag v={e.visibility} /></li>)}</ul>}</Panel>
          <Panel title="Anotações privadas" icon="lock" actions={<VisTag v="mestre" />}>
            <label className="sr-only" htmlFor="mnote">Anotações privadas do mestre</label>
            <textarea id="mnote" className="input" placeholder="Planos, segredos, ganchos… (só você vê)" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row row-between" style={{ marginTop: '.6rem' }}><span className="hint">Demonstração: não é salvo.</span><Button size="sm" disabled={!note.trim()} onClick={() => planned('Salvar anotação')}>Salvar</Button></div>
          </Panel>
        </div>);
      case 'regras': return (
        <div className="grid cols-2">
          <Panel title="Regras globais" icon="scroll"><p className="dim">Valem para todas as campanhas e não podem ser alteradas por um mestre.</p><Link to="/regras">Abrir o compêndio →</Link></Panel>
          <Panel title="Regras locais desta campanha" icon="crown" actions={<VisTag v="mestre" />}><EmptyState icon="scroll" title="Nenhuma regra local"><span>Ajustes e regras opcionais valerão só nesta campanha.</span></EmptyState><div className="row" style={{ justifyContent: 'center' }}><Button size="sm" onClick={() => planned('Criar regra local')}>Criar regra local</Button></div></Panel>
        </div>);
    }
  })();

  return (
    <>
      <PageHead eyebrow={`Painel do mestre${camp ? ' · ' + camp.name : ''}`} title={sec.label} actions={<>
        <DemoBadge />
        {mine.length > 0 && <><label className="sr-only" htmlFor="camp-sel">Campanha</label><select id="camp-sel" className="input" style={{ width: 'auto', minHeight: 40 }} value={camp?.id} onChange={(e) => setCampId(e.target.value)}>{mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></>}
      </>}>Você só vê e administra campanhas suas. Informações marcadas como privadas nunca chegam aos jogadores.</PageHead>
      {section !== 'visao' && <div className="row" style={{ marginBottom: '1rem' }}><span className="muted small">Visibilidade:</span><VisTag v="publico" /><VisTag v="jogadores" /><VisTag v="mestre" /></div>}
      <div className="fade-in" key={section + (camp?.id ?? '')}>{body}</div>
      {grant && <Modal title="Conceder recompensa?" onClose={() => setGrant(null)} actions={<><Button variant="ghost" onClick={() => setGrant(null)}>Cancelar</Button><Button variant="primary" onClick={() => { setGrant(null); planned('Conceder recompensa'); }}>Confirmar</Button></>}><p>Você concederia <strong>{grant}</strong> ao grupo. Nesta fase nada será realmente concedido.</p></Modal>}
    </>
  );
}
