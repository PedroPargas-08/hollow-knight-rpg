import { useState } from 'react';
import { useAuth } from '../app/auth';
import { MASTER_SECTIONS, type MasterSection } from '../app/nav';
import { Alert, Badge, Button, EmptyState, LinkButton, PageHead, Panel, VisTag } from '../components/ui';
import { Icon } from '../components/Icon';
import { listCampaigns, listCharacters, listMembers, STATUS_LABEL } from '../lib/api';
import { useAsync } from '../lib/useAsync';

const Legend = () => (
  <div className="stack-sm">
    <div className="row"><VisTag v="publico" /><span className="dim small">Qualquer pessoa (ex.: regras públicas).</span></div>
    <div className="row"><VisTag v="jogadores" /><span className="dim small">Participantes da campanha.</span></div>
    <div className="row"><VisTag v="mestre" /><span className="dim small">Somente o mestre. O banco impede que jogadores leiam.</span></div>
  </div>
);

export function MasterPage({ section }: { section: MasterSection }) {
  const { profile } = useAuth();
  const camps = useAsync(listCampaigns, []);
  const chars = useAsync(listCharacters, []);
  const mine = (camps.data ?? []).filter((c) => c.owner_id === profile!.id);
  const [pick, setPick] = useState<string>('');
  const camp = mine.find((c) => c.id === pick) ?? mine[0];
  const members = useAsync(() => (camp ? listMembers(camp.id) : Promise.resolve([])), [camp?.id]);
  const campChars = (chars.data ?? []).filter((c) => c.campaign_id === camp?.id);
  const sec = MASTER_SECTIONS.find((s) => s.id === section)!;
  const real = section === 'visao' || section === 'jogadores';
  const loading = (camps.loading && !camps.data) || (chars.loading && !chars.data);
  const err = camps.error ?? chars.error;

  let body;
  if (!real) body = <Panel><EmptyState icon="hourglass" title="Planejado para uma fase futura">Esta ferramenta ainda não existe. Nenhum dado de exemplo é exibido para evitar confusão com registros reais.</EmptyState></Panel>;
  else if (loading) body = <Panel><EmptyState icon="hourglass" title="Carregando…"><span className="spinner" role="status" aria-label="Carregando" /></EmptyState></Panel>;
  else if (err) body = <Panel><EmptyState icon="alert" title="Não foi possível carregar" action={<Button onClick={() => { camps.reload(); chars.reload(); }}>Tentar de novo</Button>}>{err}</EmptyState></Panel>;
  else if (!mine.length) body = <Panel><EmptyState icon="flag" title="Você ainda não administra campanhas" action={<LinkButton to="/campanhas" variant="primary" icon="plus">Criar campanha</LinkButton>}>Crie uma campanha para convidar jogadores e acompanhar as fichas.</EmptyState></Panel>;
  else if (section === 'visao') body = (
    <div className="stack">
      <div className="grid cols-2">
        <Panel title="Campanhas que você administra" icon="flag" actions={<LinkButton to="/campanhas" size="sm">Gerenciar</LinkButton>}>
          <ul className="list">{mine.map((c) => <li className="list-row" key={c.id}><div className="grow"><strong>{c.name}</strong></div><Badge tone={c.status === 'andamento' ? 'ok' : undefined}>{STATUS_LABEL[c.status]}</Badge></li>)}</ul>
        </Panel>
        <Panel title="Quem vê o quê" icon="eye"><Legend /></Panel>
      </div>
      <Panel title={`Resumo — ${camp!.name}`} icon="crown">
        <div className="stats">
          <div className="stat"><Icon name="users" /><b>{members.data?.length ?? '…'}</b><span className="muted small">participantes</span></div>
          <div className="stat"><Icon name="sheet" /><b>{campChars.length}</b><span className="muted small">fichas</span></div>
        </div>
        <div className="row" style={{ marginTop: '.8rem' }}><LinkButton to="/mestre/jogadores" icon="users" size="sm">Ver jogadores e fichas</LinkButton><LinkButton to="/campanhas" icon="plus" size="sm">Gerar convite</LinkButton></div>
      </Panel>
    </div>);
  else body = (
    <div className="stack">
      <Panel title="Participantes" icon="users">
        {members.loading && !members.data ? <span className="spinner" role="status" aria-label="Carregando" /> : members.error ? <p className="muted">{members.error}</p>
          : !members.data?.length ? <EmptyState icon="users" title="Nenhum participante ainda">Gere um convite em Campanhas para chamar jogadores.</EmptyState>
          : <ul className="list">{members.data.map((m) => <li className="list-row" key={m.id}><div className="grow"><strong>{m.display_name}</strong></div><Badge>{m.member_role === 'co_mestre' ? 'Co-mestre' : 'Jogador'}</Badge></li>)}</ul>}
      </Panel>
      <Panel title="Fichas da campanha" icon="sheet" actions={<VisTag v="mestre" />}>
        {!campChars.length ? <EmptyState icon="sheet" title="Nenhuma ficha ainda">Os jogadores criam seus personagens no painel deles.</EmptyState>
          : <div className="table-wrap"><table><thead><tr><th>Personagem</th><th>Estágio</th><th>PV</th><th>ALMA</th><th><span className="sr-only">Ações</span></th></tr></thead>
            <tbody>{campChars.map((c) => <tr key={c.id}><td>{c.name}</td><td>{c.stage}</td><td>{c.sheet.pv.now}/{c.sheet.pv.max}</td><td>{c.sheet.alma.now}/{c.sheet.alma.max}</td><td><LinkButton to={`/jogador/ficha?id=${c.id}`} size="sm" variant="ghost">Abrir ficha</LinkButton></td></tr>)}</tbody></table></div>}
      </Panel>
    </div>);

  return (
    <>
      <PageHead eyebrow={`Painel do mestre${camp && real ? ' · ' + camp.name : ''}`} title={sec.label} actions={real && mine.length > 1 ? <><label className="sr-only" htmlFor="camp-sel">Campanha</label><select id="camp-sel" className="input" style={{ width: 'auto', minHeight: 40 }} value={camp?.id} onChange={(e) => setPick(e.target.value)}>{mine.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></> : undefined}>
        Você só vê e administra campanhas suas. O banco garante isso, não apenas esta tela.
      </PageHead>
      {!real && <div style={{ marginBottom: '1rem' }}><Alert tone="info" icon="hourglass">Seção reservada para as próximas fases.</Alert></div>}
      <div className="fade-in" key={section + (camp?.id ?? '')}>{body}</div>
    </>
  );
}
