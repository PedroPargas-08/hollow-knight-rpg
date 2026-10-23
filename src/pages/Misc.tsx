import { useState } from 'react';
import { navigate } from '../app/router';
import { useDemo } from '../app/demo';
import { Alert, Badge, Button, EmptyState, LinkButton, PageHead, Panel, Switch } from '../components/ui';
import { MaskGlyph } from '../components/domain';
import { Modal, usePlanned } from '../components/overlay';
import { Icon } from '../components/Icon';
import { demoUsers, DEMO_NOTE } from '../data/demo';
import type { IconName } from '../types';

export function AccessGate({ required }: { required: 'auth' | 'jogador' | 'mestre' }) {
  const { role, setRole } = useDemo();
  const msg = {
    auth: ['Entre para ver esta área', 'Esta tela só aparece para quem já entrou na plataforma.'],
    jogador: ['Área do jogador', 'Esta tela mostra a ficha e o painel de um jogador.'],
    mestre: ['Área exclusiva do mestre', 'Aqui ficam informações privadas das campanhas. Jogadores e visitantes não as veem.'],
  }[required];
  return (
    <div className="gate fade-in">
      <Panel>
        <EmptyState icon="lock" title={msg[0]} action={
          <div className="stack" style={{ maxWidth: 460 }}>
            <p style={{ margin: 0 }}>{msg[1]}</p>
            <Alert tone="warn">Na Fase 1 este bloqueio é <strong>apenas visual</strong>. Esconder telas não é segurança — a imposição real virá no servidor e no banco de dados.</Alert>
            <div className="row" style={{ justifyContent: 'center' }}>
              {role === 'visitante' && <LinkButton to="/entrar" variant="primary">Ir para o login</LinkButton>}
              <Button icon="user" onClick={() => setRole('jogador')}>Ver como jogador (demo)</Button>
              <Button icon="crown" onClick={() => setRole('mestre')}>Ver como mestre (demo)</Button>
            </div>
          </div>
        } />
      </Panel>
    </div>
  );
}

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
  const { role, setRole, prefs, setPrefs } = useDemo();
  const planned = usePlanned();
  const [confirm, setConfirm] = useState(false);
  const [notif, setNotif] = useState({ sessao: true, revelacao: true, rolagem: false });
  const [density, setDensity] = useState(false);
  const user = role === 'mestre' ? demoUsers.mestre : demoUsers.jogador;
  return (
    <>
      <PageHead eyebrow="Conta" title="Perfil e configurações">Suas preferências valem só enquanto esta página estiver aberta. Nada é salvo nesta fase.</PageHead>
      <div className="grid cols-2">
        <Panel title="Conta de demonstração" icon="user" actions={<Badge tone="accent">{role === 'mestre' ? 'Mestre' : 'Jogador'}</Badge>}>
          <div className="row" style={{ marginBottom: '1rem' }}>
            <div className="avatar" aria-hidden="true"><MaskGlyph className="mask" /></div>
            <div><strong style={{ fontSize: '1.1rem' }}>{user.name}</strong><div className="muted small">{user.email}</div><div className="muted small">{DEMO_NOTE}</div></div>
          </div>
          <dl className="kv"><dt>Papel atual</dt><dd>{role === 'mestre' ? 'Mestre' : 'Jogador'} (demonstração)</dd><dt>Mudar de papel</dt><dd className="muted">Só pela barra de demonstração. Na versão real, ninguém se torna mestre ou administrador por conta própria.</dd></dl>
          <div className="row" style={{ marginTop: '1rem' }}><Button variant="ghost" onClick={() => planned('Editar perfil')}>Editar perfil</Button><Button variant="danger" icon="logout" onClick={() => setConfirm(true)}>Sair</Button></div>
        </Panel>
        <Panel title="Preferências visuais" icon="spark">
          <Switch label="Reduzir efeitos e animações" desc="Também respeitamos a preferência de movimento reduzido do seu sistema." checked={prefs.reduceEffects} onChange={(v) => setPrefs({ reduceEffects: v })} />
          <Switch label="Contraste alto" desc="Textos e bordas mais fortes." checked={prefs.highContrast} onChange={(v) => setPrefs({ highContrast: v })} />
          <div className="switch"><div><div>Tamanho do texto</div><div className="hint">Ajuste para leitura confortável.</div></div>
            <div className="seg" role="group" aria-label="Tamanho do texto">{(['normal', 'grande', 'maior'] as const).map((s) => <button key={s} type="button" aria-pressed={prefs.textScale === s} onClick={() => setPrefs({ textScale: s })}>{s[0].toUpperCase() + s.slice(1)}</button>)}</div></div>
        </Panel>
        <Panel title="Preferências de interface" icon="gear">
          <Switch label="Listas mais compactas" desc="Apenas visual nesta fase." checked={density} onChange={setDensity} />
          <p className="hint" style={{ margin: '.6rem 0 0' }}>Idioma: Português (Brasil). Outros idiomas: planejado.</p>
        </Panel>
        <Panel title="Notificações" icon="bell">
          <Switch label="Lembrete de sessão" checked={notif.sessao} onChange={(v) => setNotif({ ...notif, sessao: v })} />
          <Switch label="Novas regiões reveladas" checked={notif.revelacao} onChange={(v) => setNotif({ ...notif, revelacao: v })} />
          <Switch label="Rolagens do grupo" checked={notif.rolagem} onChange={(v) => setNotif({ ...notif, rolagem: v })} />
          <p className="hint" style={{ margin: '.6rem 0 0' }}>Nenhuma notificação real é enviada nesta fase.</p>
        </Panel>
      </div>
      {confirm && <Modal title="Sair da demonstração?" onClose={() => setConfirm(false)} actions={<><Button variant="ghost" onClick={() => setConfirm(false)}>Cancelar</Button><Button variant="danger" onClick={() => { setConfirm(false); setRole('visitante'); navigate('/'); }}>Sair</Button></>}>
        <p>Você voltará a ser um visitante. Como nada é salvo, não há nada a perder.</p>
      </Modal>}
    </>
  );
}
