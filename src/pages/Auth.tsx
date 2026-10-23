import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, navigate } from '../app/router';
import { useDemo } from '../app/demo';
import { Alert, Button, Field } from '../components/ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/overlay';
import { passwordStrength, validateLogin, validateRecovery, validateRegister, type Errors, type RegisterValues } from '../lib/validation';

type Status = 'idle' | 'loading' | 'done' | 'error';
function useDelayed() {
  const t = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(t.current), []);
  return (fn: () => void, ms = 900) => { window.clearTimeout(t.current); t.current = window.setTimeout(fn, ms); };
}
const DemoNote = () => <Alert tone="info" icon="info">Fase 1: esta tela é uma <strong>demonstração visual</strong>. Nenhuma credencial é verificada e nenhuma conta é criada.</Alert>;

function PasswordInput({ id, value, onChange, onBlur, invalid, autoComplete, describedBy }: { id: string; value: string; onChange: (v: string) => void; onBlur?: () => void; invalid?: boolean; autoComplete: string; describedBy?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input id={id} className="input" type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      <button type="button" className="btn btn-icon" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}><Icon name={show ? 'eyeoff' : 'eye'} /></button>
    </div>
  );
}

export function LoginPage() {
  const { setRole } = useDemo();
  const later = useDelayed();
  const [v, setV] = useState({ identifier: '', password: '' });
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<Errors<'identifier' | 'password'>>({});
  const [status, setStatus] = useState<Status>('idle');
  const canSubmit = v.identifier.trim() !== '' && v.password !== '';
  const blur = (k: 'identifier' | 'password') => setErrors((p) => ({ ...p, [k]: validateLogin(v)[k] }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er = validateLogin(v); setErrors(er);
    if (Object.keys(er).length) { setStatus('idle'); return; }
    setStatus('loading'); later(() => setStatus('done'));
  };
  const enter = (r: 'jogador' | 'mestre') => { setRole(r); navigate(r === 'mestre' ? '/mestre' : '/jogador'); };

  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Entrar</h1>
      <p className="dim" style={{ textAlign: 'center' }}>Retome sua jornada nas ruínas.</p>
      <form className="stack" onSubmit={submit} noValidate aria-describedby="login-demo">
        <div id="login-demo"><DemoNote /></div>
        {status === 'error' && <Alert tone="bad">Não foi possível entrar. <span className="muted">(Mensagem de erro simulada para demonstração.)</span></Alert>}
        <Field label="E-mail ou identificador de acesso" htmlFor="login-id" error={errors.identifier}>
          <input id="login-id" className="input" value={v.identifier} autoComplete="username" aria-invalid={!!errors.identifier || undefined} aria-describedby={errors.identifier ? 'login-id-err' : undefined}
            onChange={(e) => setV({ ...v, identifier: e.target.value })} onBlur={() => blur('identifier')} />
        </Field>
        <Field label="Senha" htmlFor="login-pw" error={errors.password}>
          <PasswordInput id="login-pw" value={v.password} onChange={(x) => setV({ ...v, password: x })} onBlur={() => blur('password')} invalid={!!errors.password} autoComplete="current-password" describedBy={errors.password ? 'login-pw-err' : undefined} />
        </Field>
        <div className="row row-between">
          <label className="check" style={{ minHeight: 'auto' }}><input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> <span>Lembrar de mim <span className="muted small">(visual)</span></span></label>
          <Link to="/recuperar">Esqueci a senha</Link>
        </div>
        <Button type="submit" variant="primary" block loading={status === 'loading'} disabled={!canSubmit}>{status === 'loading' ? 'Verificando…' : 'Entrar'}</Button>
        <button type="button" className="linklike" onClick={() => setStatus('error')}>Simular mensagem de erro</button>
      </form>

      {status === 'done' && (
        <div className="stack fade-in" style={{ marginTop: '1rem' }}>
          <Alert tone="warn">Validação local concluída. <strong>Nenhuma autenticação real foi feita.</strong> Para explorar a demonstração, escolha um perfil fictício:</Alert>
          <div className="row"><Button variant="primary" icon="user" onClick={() => enter('jogador')}>Entrar como jogador (demo)</Button><Button icon="crown" onClick={() => enter('mestre')}>Entrar como mestre (demo)</Button></div>
        </div>
      )}
      <hr className="divider" />
      <p className="center small" style={{ margin: 0 }}>Ainda não tem conta? <Link to="/cadastro">Criar conta</Link> · <Link to="/regras">Regras públicas</Link></p>
    </>
  );
}

export function RegisterPage() {
  const later = useDelayed();
  const [v, setV] = useState<RegisterValues>({ displayName: '', email: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState<Errors<keyof RegisterValues>>({});
  const [status, setStatus] = useState<Status>('idle');
  const [terms, setTerms] = useState(false);
  const strength = passwordStrength(v.password);
  const set = <K extends keyof RegisterValues>(k: K, val: RegisterValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const blur = (k: keyof RegisterValues) => setErrors((p) => ({ ...p, [k]: validateRegister(v)[k] }));
  const err = (k: keyof RegisterValues) => (errors[k] ? `reg-${k}-err` : undefined);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er = validateRegister(v); setErrors(er);
    if (Object.keys(er).length) { setStatus('idle'); return; }
    setStatus('loading'); later(() => setStatus('done'));
  };

  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Criar conta</h1>
      <p className="dim" style={{ textAlign: 'center' }}>Toda conta nova começa como jogador. Papéis de mestre e administração não são escolhidos no cadastro.</p>
      {status === 'done' ? (
        <div className="stack fade-in">
          <Alert tone="ok" icon="check"><strong>Validação concluída (demonstração).</strong> Nenhuma conta foi criada e nenhum e-mail foi enviado.</Alert>
          <Button variant="primary" onClick={() => navigate('/entrar')}>Voltar ao login</Button>
        </div>
      ) : (
        <form className="stack" onSubmit={submit} noValidate>
          <DemoNote />
          <Field label="Nome de exibição" htmlFor="reg-name" error={errors.displayName}>
            <input id="reg-name" className="input" value={v.displayName} autoComplete="nickname" aria-invalid={!!errors.displayName || undefined} aria-describedby={err('displayName')} onChange={(e) => set('displayName', e.target.value)} onBlur={() => blur('displayName')} />
          </Field>
          <Field label="E-mail" htmlFor="reg-email" error={errors.email}>
            <input id="reg-email" className="input" type="email" value={v.email} autoComplete="email" aria-invalid={!!errors.email || undefined} aria-describedby={err('email')} onChange={(e) => set('email', e.target.value)} onBlur={() => blur('email')} />
          </Field>
          <Field label="Senha" htmlFor="reg-pw" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
            <PasswordInput id="reg-pw" value={v.password} onChange={(x) => set('password', x)} onBlur={() => blur('password')} invalid={!!errors.password} autoComplete="new-password" describedBy={err('password')} />
            <div className="strength" aria-hidden="true">{[1, 2, 3, 4].map((i) => <i key={i} data-on={strength >= i} />)}</div>
            <span className="sr-only">Força da senha: {strength} de 4</span>
          </Field>
          <Field label="Confirmação de senha" htmlFor="reg-confirm" error={errors.confirm}>
            <PasswordInput id="reg-confirm" value={v.confirm} onChange={(x) => set('confirm', x)} onBlur={() => blur('confirm')} invalid={!!errors.confirm} autoComplete="new-password" describedBy={err('confirm')} />
          </Field>
          <div>
            <label className="check"><input type="checkbox" checked={v.terms} onChange={(e) => { set('terms', e.target.checked); setErrors((p) => ({ ...p, terms: undefined })); }} aria-describedby={err('terms')} />
              <span>Li e aceito os <button type="button" className="linklike" onClick={() => setTerms(true)}>termos provisórios</button>.</span></label>
            {errors.terms && <div className="field-error" id="reg-terms-err"><Icon name="alert" />{errors.terms}</div>}
          </div>
          <Button type="submit" variant="primary" block loading={status === 'loading'}>{status === 'loading' ? 'Validando…' : 'Criar conta'}</Button>
        </form>
      )}
      <hr className="divider" />
      <p className="center small" style={{ margin: 0 }}><Link to="/entrar">← Voltar ao login</Link></p>
      {terms && <Modal title="Termos provisórios" onClose={() => setTerms(false)} actions={<Button variant="primary" onClick={() => { set('terms', true); setErrors((p) => ({ ...p, terms: undefined })); setTerms(false); }}>Aceitar</Button>}>
        <p>Texto de exemplo para demonstrar o modal. Os termos reais ainda não foram escritos e nenhum dado é coletado nesta fase.</p>
      </Modal>}
    </>
  );
}

export function RecoverPage() {
  const later = useDelayed();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>('idle');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const er = validateRecovery({ email }); setError(er.email);
    if (er.email) return;
    setStatus('loading'); later(() => setStatus('done'));
  };
  return (
    <>
      <h1 style={{ textAlign: 'center' }}>Recuperar acesso</h1>
      <p className="dim" style={{ textAlign: 'center' }}>Informe o e-mail da conta para receber instruções.</p>
      <form className="stack" onSubmit={submit} noValidate>
        <DemoNote />
        {status === 'done' && <Alert tone="ok" icon="check"><strong>Resposta demonstrativa:</strong> se esse e-mail existisse, você receberia instruções. Nenhum e-mail foi enviado.</Alert>}
        <Field label="E-mail" htmlFor="rec-email" error={error}>
          <input id="rec-email" className="input" type="email" value={email} autoComplete="email" aria-invalid={!!error || undefined} aria-describedby={error ? 'rec-email-err' : undefined} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button type="submit" variant="primary" block loading={status === 'loading'}>{status === 'loading' ? 'Solicitando…' : 'Solicitar recuperação'}</Button>
      </form>
      <hr className="divider" />
      <p className="center small" style={{ margin: 0 }}><Link to="/entrar">← Voltar ao login</Link></p>
    </>
  );
}
