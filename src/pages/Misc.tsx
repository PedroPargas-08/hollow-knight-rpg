import { useState, type FormEvent } from 'react';
import { navigate } from '../app/router';
import { useAuth } from '../app/auth';
import { usePrefs } from '../app/prefs';
import { Alert, Badge, Button, EmptyState, Field, LinkButton, PageHead, Panel, Switch } from '../components/ui';
import { MaskGlyph } from '../components/domain';
import { Modal, useToast } from '../components/overlay';
import { updateDisplayName } from '../lib/api';
import { friendlyError } from '../lib/sheet';
import { Icon } from '../components/Icon';
import type { IconName } from '../types';

export function NotFoundPage() {
  return (
    <div className="pub-wrap"><Panel><EmptyState icon="compass" title="Esta região ainda não foi mapeada" action={<LinkButton to="/" variant="primary">Voltar ao início</LinkButton>}>A página que você procura não existe nesta demonstração.</EmptyState></Panel></div>
  );
}

const areas: { icon: IconName; title: string; items: string[] }[] = [
  { icon: 'compass', title: 'Visão geral da plataforma', items: ['Indicadores de uso', 'Atividade recente'] },
  { icon: 'users', title: 'Usuários', items: ['Lista de contas', 'Suspensão e recuperação'] },
  { icon: 'flag', title: 'Campanhas', items: ['Todas as campanhas', 'Moderação e arquivamento'] },
  { icon: 'alert', title: 'Estado geral do sistema', items: ['Saúde dos serviços', 'Registros de erro'] },
  { icon: 'gear', title: 'Configurações globais', items: ['Regras globais do sistema', 'Parâmetros da plataforma'] },
];
export function AdminPlannedPage() {
  return (
    <>
      <PageHead eyebrow="Estrutura planejada" title="Administração global">Área futura, separada do painel do mestre. Nada aqui está implementado.</PageHead>
      <div className="stack">
        <Alert tone="warn" icon="lock">Não existe conta de administrador, credencial fixa ou promoção de usuários. O papel de administrador global será concedido por um processo seguro e controlado — nunca por cadastro público ou por alterações feitas na interface.</Alert>
        <div className="grid cols-3">
          {areas.map((a) => (
            <Panel key={a.title} title={a.title} icon={a.icon} quiet actions={<Badge>Planejado</Badge>}>
              <ul className="dim" style={{ margin: 0 }}>{a.items.map((i) => <li key={i}>{i}</li>)}</ul>
            </Panel>
          ))}
        </div>
      </div>
    </>
  );
}

export function ProfilePage() {
  const { profile, session, signOut, refreshProfile } = useAuth();
  const { prefs, setPrefs } = usePrefs();
  const toast = useToast();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [confirm, setConfirm] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2 || n.length > 32) { setError('O nome precisa ter entre 2 e 32 caracteres.'); return; }
    setError(undefined); setBusy(true);
    try { await updateDisplayName(profile!.id, n); refreshProfile(); toast('Nome atualizado.', 'ok'); }
    catch (x) { setError(friendlyError(x)); } finally { setBusy(false); }
  };
  const leave = async () => {
    setLeaving(true);
    try { await signOut(); navigate('/'); } catch (x) { toast(friendlyError(x), 'bad'); setLeaving(false); setConfirm(false); }
  };
  return (
    <>
      <PageHead eyebrow="Conta" title="Perfil e configurações">Seu nome de exibição é salvo no banco. As preferências visuais valem apenas enquanto a página estiver aberta.</PageHead>
      <div className="grid cols-2">
        <Panel title="Conta" icon="user" actions={<Badge tone="accent">{profile?.role === 'mestre' ? 'Mestre' : 'Jogador'}</Badge>}>
          <form className="stack" onSubmit={save} noValidate>
            <Field label="Nome de exibição" htmlFor="prof-name" error={error}>
              <input id="prof-name" className="input" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} aria-invalid={!!error || undefined} aria-describedby={error ? 'prof-name-err' : undefined} />
            </Field>
            <dl className="kv"><dt>E-mail</dt><dd>{session?.user.email}</dd><dt>Papel</dt><dd>{profile?.role === 'mestre' ? 'Mestre' : 'Jogador'} <span className="muted small">— definido pelo sistema; não pode ser alterado aqui.</span></dd></dl>
            <div className="row"><Button type="submit" variant="primary" loading={busy} disabled={name.trim() === profile?.display_name}>Salvar nome</Button><Button type="button" variant="danger" icon="logout" onClick={() => setConfirm(true)}>Sair</Button></div>
          </form>
        </Panel>
        <Panel title="Preferências visuais" icon="spark">
          <Switch label="Reduzir efeitos e animações" desc="Também respeitamos a preferência de movimento reduzido do seu sistema." checked={prefs.reduceEffects} onChange={(v) => setPrefs({ reduceEffects: v })} />
          <Switch label="Contraste alto" desc="Textos e bordas mais fortes." checked={prefs.highContrast} onChange={(v) => setPrefs({ highContrast: v })} />
          <div className="switch"><div><div>Tamanho do texto</div><div className="hint">Ajuste para leitura confortável.</div></div>
            <div className="seg" role="group" aria-label="Tamanho do texto">{(['normal', 'grande', 'maior'] as const).map((s) => <button key={s} type="button" aria-pressed={prefs.textScale === s} onClick={() => setPrefs({ textScale: s })}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div></div>
        </Panel>
      </div>
      {confirm && <Modal title="Sair da conta?" onClose={() => setConfirm(false)} actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="danger" loading={leaving} onClick={leave}>Sair</Button></>}>
        <p>Sua sessão será encerrada neste navegador. Você precisará entrar de novo para ver suas campanhas e fichas.</p>
      </Modal>}
    </>
  );
}
