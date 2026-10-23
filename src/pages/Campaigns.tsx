import { useState } from 'react';
import { navigate } from '../app/router';
import { useDemo } from '../app/demo';
import { Alert, Badge, Button, DemoBadge, EmptyState, PageHead, Panel, Seg } from '../components/ui';
import { CampaignArt } from '../components/domain';
import { Icon } from '../components/Icon';
import { Modal, usePlanned } from '../components/overlay';
import { campaigns, privateCampaignNote, type Campaign } from '../data/demo';

type Filter = 'todas' | 'Em andamento' | 'Em preparação';

export function CampaignsPage() {
  const { role, empty } = useDemo();
  const planned = usePlanned();
  const [filter, setFilter] = useState<Filter>('todas');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<Campaign | null>(null);
  const isMaster = role === 'mestre';

  const mine = empty ? [] : campaigns.filter((c) => (isMaster ? c.asMaster : c.asPlayer));
  const shown = mine.filter((c) => (filter === 'todas' || c.state === filter) && c.name.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <>
      <PageHead eyebrow={isMaster ? 'Campanhas que você administra' : 'Campanhas das quais você participa'} title="Campanhas" actions={<><DemoBadge />{isMaster && <Button icon="plus" onClick={() => planned('Criar campanha')}>Nova campanha</Button>}</>}>
        {isMaster ? 'Você só vê e administra campanhas suas.' : 'Você só vê campanhas em que foi aceito como participante.'}
      </PageHead>
      <div className="row row-between" style={{ marginBottom: '1rem' }}>
        <Seg<Filter> label="Filtrar por estado" value={filter} onChange={setFilter} items={[{ id: 'todas', label: 'Todas' }, { id: 'Em andamento', label: 'Em andamento' }, { id: 'Em preparação', label: 'Em preparação' }]} />
        <div className="input-wrap" style={{ width: 'min(280px,100%)' }}><label className="sr-only" htmlFor="camp-q">Buscar campanha</label><input id="camp-q" className="input" placeholder="Buscar por nome…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {shown.length === 0 ? (
        <Panel><EmptyState icon="flag" title={mine.length === 0 ? (isMaster ? 'Você ainda não administra campanhas' : 'Você ainda não participa de campanhas') : 'Nenhuma campanha encontrada'}
          action={mine.length === 0 && isMaster ? <Button variant="primary" icon="plus" onClick={() => planned('Criar campanha')}>Criar campanha</Button> : undefined}>
          {mine.length === 0 ? (isMaster ? 'Crie sua primeira campanha para convidar jogadores.' : 'Quando um mestre convidar você, a campanha aparecerá aqui.') : 'Tente outro filtro ou outro termo de busca.'}</EmptyState></Panel>
      ) : (
        <div className="camps">{shown.map((c) => (
          <article key={c.id} className="camp panel">
            <div className="camp-cover"><CampaignArt art={c.art} /><Badge tone={c.state === 'Em andamento' ? 'ok' : undefined}>{c.state}</Badge></div>
            <div className="camp-body">
              <h2>{c.name}</h2>
              <p className="dim">{c.description}</p>
              <p className="muted small" style={{ margin: 0 }}><Icon name="crown" /> Mestre: {c.master} · <Icon name="users" /> {c.players.length} participante(s)</p>
              <p className="small" style={{ margin: '.5rem 0' }}><strong>Última sessão:</strong> <span className="dim">{c.lastSession}</span></p>
              <div className="row">
                <Button size="sm" onClick={() => setOpen(c)}>Abrir detalhes</Button>
                {isMaster && c.asMaster && <Button size="sm" variant="primary" icon="crown" onClick={() => navigate('/mestre')}>Administrar</Button>}
              </div>
            </div>
          </article>))}
        </div>
      )}

      <h2 style={{ marginTop: '2rem' }}>Fora do seu alcance</h2>
      <Panel quiet><div className="row"><Icon name="lock" /><div className="grow"><strong>Campanha privada</strong><div className="muted small">{privateCampaignNote}</div></div><Button size="sm" disabled aria-label="Sem acesso à campanha privada">Sem acesso</Button></div></Panel>

      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)} actions={<>
          <Button variant="ghost" onClick={() => setOpen(null)}>Fechar</Button>
          {isMaster && open.asMaster ? <Button variant="primary" onClick={() => { setOpen(null); navigate('/mestre'); }}>Administrar</Button> : open.asPlayer && <Button variant="primary" onClick={() => { setOpen(null); navigate('/jogador/ficha'); }}>Ver minha ficha</Button>}
        </>}>
          <p className="dim">{open.description}</p>
          <dl className="kv"><dt>Estado</dt><dd>{open.state}</dd><dt>Mestre</dt><dd>{open.master}</dd><dt>Participantes</dt><dd>{open.players.join(', ')}</dd><dt>Última sessão</dt><dd>{open.lastSessionDate}</dd></dl>
          <div style={{ marginTop: '1rem' }}><Alert tone="info">Capa e textos provisórios, com dados fictícios.</Alert></div>
        </Modal>
      )}
    </>
  );
}
