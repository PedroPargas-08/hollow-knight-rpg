import { useState, type FormEvent } from 'react';
import { useAuth } from '../app/auth';
import { Alert, Badge, Button, EmptyState, Field, PageHead, Panel } from '../components/ui';
import { CampaignArt } from '../components/domain';
import { Icon } from '../components/Icon';
import { Modal, useToast } from '../components/overlay';
import { createCampaign, createInvite, deleteCampaign, listCampaigns, listMembers, redeemInvite, removeMember, STATUS_LABEL, type Campaign } from '../lib/api';
import { friendlyError } from '../lib/sheet';
import { useAsync } from '../lib/useAsync';

const artOf = (id: string) => (['cinzas', 'coro', 'sinos'] as const)[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % 3];

function NewCampaign({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: '', description: '' });
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!v.name.trim() || v.name.trim().length > 80) { setError('Informe um nome de até 80 caracteres.'); return; }
    setBusy(true); setError(undefined);
    try { await createCampaign(v); toast('Campanha criada.', 'ok'); onDone(); onClose(); } catch (x) { setError(friendlyError(x)); setBusy(false); }
  };
  return (
    <Modal title="Nova campanha" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="Nome" htmlFor="nc-name" error={error}><input id="nc-name" className="input" maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Descrição" htmlFor="nc-desc"><textarea id="nc-desc" className="input" maxLength={2000} value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} /></Field>
        <div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" loading={busy}>Criar campanha</Button></div>
      </form>
    </Modal>
  );
}

function RedeemInvite({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (token.trim().length < 8) { setError('Cole o código de convite recebido.'); return; }
    setBusy(true); setError(undefined);
    try { await redeemInvite(token); toast('Você entrou na campanha.', 'ok'); onDone(); onClose(); } catch (x) { setError(friendlyError(x)); setBusy(false); }
  };
  return (
    <Modal title="Entrar com convite" onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <p className="dim" style={{ margin: 0 }}>Cole o código que o mestre enviou. Cada código vale uma vez e expira.</p>
        <Field label="Código do convite" htmlFor="inv-token" error={error}><input id="inv-token" className="input" autoComplete="off" spellCheck={false} value={token} onChange={(e) => setToken(e.target.value)} /></Field>
        <div className="modal-actions"><Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button><Button type="submit" variant="primary" loading={busy}>Entrar na campanha</Button></div>
      </form>
    </Modal>
  );
}

function Detail({ c, userId, isOwner, canAdmin, onClose, onChanged }: { c: Campaign; userId: string; isOwner: boolean; canAdmin: boolean; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const members = useAsync(() => listMembers(c.id), [c.id]);
  const [invite, setInvite] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [role, setRole] = useState<'jogador' | 'co_mestre'>('jogador');
  const [confirmDel, setConfirmDel] = useState(false);
  const run = async (key: string, fn: () => Promise<void>, ok: string) => {
    setBusy(key);
    try { await fn(); toast(ok, 'ok'); } catch (x) { toast(friendlyError(x), 'bad'); } finally { setBusy(null); }
  };
  return (
    <Modal title={c.name} onClose={onClose} actions={<Button variant="ghost" onClick={onClose}>Fechar</Button>}>
      <p className="dim">{c.description || 'Sem descrição.'}</p>
      <dl className="kv"><dt>Estado</dt><dd>{STATUS_LABEL[c.status]}</dd><dt>Seu papel</dt><dd>{isOwner ? 'Dono (mestre)' : canAdmin ? 'Co-mestre' : 'Jogador'}</dd></dl>
      <h3 style={{ marginTop: '1rem' }}>Participantes</h3>
      {members.loading && !members.data ? <span className="spinner" role="status" aria-label="Carregando participantes" /> : members.error ? <Alert tone="bad">{members.error}</Alert> :
        !members.data?.length ? <p className="muted">Ninguém participa ainda. Gere um convite para chamar jogadores.</p> : (
          <ul className="list" aria-label="Participantes">{members.data.map((m) => (
            <li className="list-row" key={m.id}><div className="grow"><strong>{m.display_name}</strong><span className="muted small">{m.member_role === 'co_mestre' ? 'Co-mestre' : 'Jogador'}</span></div>
              {m.user_id === userId && !isOwner && <Button size="sm" variant="danger" loading={busy === m.id} onClick={() => run(m.id, async () => { await removeMember(m.id); onChanged(); onClose(); }, 'Você saiu da campanha.')}>Sair</Button>}
              {m.user_id !== userId && canAdmin && (isOwner || m.member_role === 'jogador') && <Button size="sm" variant="danger" loading={busy === m.id} onClick={() => run(m.id, async () => { await removeMember(m.id); members.reload(); onChanged(); }, 'Participante removido.')}>Remover</Button>}
            </li>))}</ul>)}
      {canAdmin && (
        <div className="stack" style={{ marginTop: '1rem' }}>
          <h3>Convidar</h3>
          <div className="row">
            {isOwner && <select className="input" style={{ width: 'auto' }} aria-label="Papel do convidado" value={role} onChange={(e) => setRole(e.target.value as 'jogador' | 'co_mestre')}><option value="jogador">Jogador</option><option value="co_mestre">Co-mestre</option></select>}
            <Button loading={busy === 'inv'} icon="plus" onClick={() => run('inv', async () => setInvite(await createInvite(c.id, role)), 'Convite criado.')}>Gerar convite</Button>
          </div>
          {invite && <Alert tone="warn" icon="lock"><strong>Copie agora — este código não será mostrado de novo.</strong>
            <div className="row" style={{ marginTop: '.4rem' }}><code data-testid="invite-token" style={{ wordBreak: 'break-all' }}>{invite}</code><Button size="sm" onClick={() => navigator.clipboard?.writeText(invite).then(() => toast('Código copiado.'), () => toast('Não foi possível copiar; selecione o texto.', 'bad'))}>Copiar</Button></div>
            <span className="small muted">Vale por 72 horas e funciona uma única vez.</span></Alert>}
        </div>)}
      {isOwner && (
        <div className="stack" style={{ marginTop: '1rem' }}>
          <h3>Zona de risco</h3>
          {!confirmDel ? <Button variant="danger" onClick={() => setConfirmDel(true)}>Excluir campanha</Button> : (
            <Alert tone="bad">Isso apaga a campanha, participantes e <strong>todas as fichas</strong> dela. Não há como desfazer.
              <div className="row" style={{ marginTop: '.5rem' }}><Button variant="danger" loading={busy === 'del'} onClick={() => run('del', async () => { await deleteCampaign(c.id); onChanged(); onClose(); }, 'Campanha excluída.')}>Sim, excluir</Button><Button variant="ghost" onClick={() => setConfirmDel(false)}>Cancelar</Button></div></Alert>)}
        </div>)}
    </Modal>
  );
}

export function CampaignsPage() {
  const { profile } = useAuth();
  const list = useAsync(listCampaigns, []);
  const [creating, setCreating] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [open, setOpen] = useState<Campaign | null>(null);
  const isMaster = profile?.role === 'mestre';
  const uid = profile!.id;
  const adminOf = (c: Campaign) => isMaster && c.owner_id === uid;

  return (
    <>
      <PageHead eyebrow={isMaster ? 'Campanhas que você administra ou integra' : 'Campanhas das quais você participa'} title="Campanhas" actions={<>
        <Button icon="door" onClick={() => setRedeeming(true)}>Entrar com convite</Button>
        {isMaster && <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Nova campanha</Button>}</>}>
        Você só vê campanhas em que participa. Campanhas privadas de outras pessoas não aparecem — o banco impede o acesso.
      </PageHead>
      {list.loading && !list.data ? <Panel><EmptyState icon="hourglass" title="Carregando campanhas…"><span className="spinner" role="status" aria-label="Carregando" /></EmptyState></Panel>
        : list.error ? <Panel><EmptyState icon="alert" title="Não foi possível carregar" action={<Button onClick={list.reload}>Tentar de novo</Button>}>{list.error}</EmptyState></Panel>
        : !list.data?.length ? <Panel><EmptyState icon="flag" title={isMaster ? 'Você ainda não tem campanhas' : 'Você ainda não participa de campanhas'} action={isMaster ? <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>Criar campanha</Button> : <Button icon="door" onClick={() => setRedeeming(true)}>Entrar com convite</Button>}>
            {isMaster ? 'Crie sua primeira campanha para convidar jogadores.' : 'Peça um código de convite ao seu mestre.'}</EmptyState></Panel>
        : <div className="camps">{list.data.map((c) => (
          <article key={c.id} className="camp panel">
            <div className="camp-cover"><CampaignArt art={artOf(c.id)} /><Badge tone={c.status === 'andamento' ? 'ok' : undefined}>{STATUS_LABEL[c.status]}</Badge></div>
            <div className="camp-body"><h2>{c.name}</h2><p className="dim">{c.description || 'Sem descrição.'}</p>
              <p className="muted small"><Icon name={c.owner_id === uid ? 'crown' : 'user'} /> {c.owner_id === uid ? 'Você é o dono' : 'Você participa'}</p>
              <div className="row"><Button size="sm" onClick={() => setOpen(c)}>Abrir detalhes</Button></div></div>
          </article>))}</div>}
      {creating && <NewCampaign onClose={() => setCreating(false)} onDone={list.reload} />}
      {redeeming && <RedeemInvite onClose={() => setRedeeming(false)} onDone={list.reload} />}
      {open && <Detail c={open} userId={uid} isOwner={open.owner_id === uid} canAdmin={adminOf(open)} onClose={() => setOpen(null)} onChanged={list.reload} />}
    </>
  );
}
