import { useState, type FormEvent } from 'react';
import { Link, navigate } from '../app/router';
import { useAuth } from '../app/auth';
import { Alert, Button, Field } from '../components/ui';
import { Icon } from '../components/Icon';
import { Modal } from '../components/overlay';
import { friendlyError } from '../lib/sheet';
import { passwordStrength, validateLogin, validateNewPassword, validateRecovery, validateRegister, type Errors, type RegisterValues } from '../lib/validation';

function PasswordInput({ id, value, onChange, onBlur, invalid, autoComplete, describedBy }: { id: string; value: string; onChange: (v: string) => void; onBlur?: () => void; invalid?: boolean; autoComplete: string; describedBy?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-wrap">
      <input id={id} className="input" type={show ? 'text' : 'password'} value={value} autoComplete={autoComplete} aria-invalid={invalid || undefined} aria-describedby={describedBy} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} />
      <button type="button" className="btn btn-icon" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} aria-pressed={show}><Icon name={show ? 'eyeoff' : 'eye'} /></button>
    </div>
  );
}
const Heading = ({ title, sub }: { title: string; sub: string }) => <><h1 style={{ textAlign: 'center' }}>{title}</h1><p className="dim" style={{ textAlign: 'center' }}>{sub}</p></>;

export function LoginPage() {
  const { signIn, notice, clearNotice } = useAuth();
  const [v, setV] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<Errors<'email' | 'password'>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const blur = (k: 'email' | 'password') => setErrors((p) => ({ ...p, [k]: validateLogin(v)[k] }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er = validateLogin(v); setErrors(er); setServerError(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { await signIn(v.email, v.password); /* o redirecionamento por papel é feito pelo App quando o perfil carrega */ }
    catch (err) { setServerError(friendlyError(err)); setBusy(false); }
  };
  return (
    <>
      <Heading title="Entrar" sub="Retome sua jornada nas ruínas." />
      <form className="stack" onSubmit={submit} noValidate>
        {notice && <Alert tone="warn">{notice} <button type="button" className="linklike" onClick={clearNotice}>Dispensar</button></Alert>}
        {serverError && <Alert tone="bad">{serverError}</Alert>}
        <Field label="E-mail" htmlFor="login-email" error={errors.email}>
          <input id="login-email" className="input" type="email" value={v.email} autoComplete="username" aria-invalid={!!errors.email || undefined} aria-describedby={errors.email ? 'login-email-err' : undefined} onChange={(e) => setV({ ...v, email: e.target.value })} onBlur={() => blur('email')} />
        </Field>
        <Field label="Senha" htmlFor="login-pw" error={errors.password}>
          <PasswordInput id="login-pw" value={v.password} onChange={(x) => setV({ ...v, password: x })} onBlur={() => blur('password')} invalid={!!errors.password} autoComplete="current-password" describedBy={errors.password ? 'login-pw-err' : undefined} />
        </Field>
        <div className="row row-between"><span className="muted small">A sessão continua ao recarregar a página.</span><Link to="/recuperar">Esqueci a senha</Link></div>
        <Button type="submit" variant="primary" block loading={busy}>{busy ? 'Entrando…' : 'Entrar'}</Button>
      </form>
      <hr className="divider" />
      <p className="center small" style={{ margin: 0 }}>Ainda não tem conta? <Link to="/cadastro">Criar conta</Link> · <Link to="/regras">Regras públicas</Link></p>
    </>
  );
}

export function RegisterPage() {
  const { signUp } = useAuth();
  const [v, setV] = useState<RegisterValues>({ displayName: '', email: '', password: '', confirm: '', terms: false });
  const [errors, setErrors] = useState<Errors<keyof RegisterValues>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { needsConfirmation: boolean }>(null);
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const strength = passwordStrength(v.password);
  const set = <K extends keyof RegisterValues>(k: K, val: RegisterValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const blur = (k: keyof RegisterValues) => setErrors((p) => ({ ...p, [k]: validateRegister(v)[k] }));
  const err = (k: keyof RegisterValues) => (errors[k] ? `reg-${k}-err` : undefined);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er = validateRegister(v); setErrors(er); setServerError(null);
    if (Object.keys(er).length) return;
    setBusy(true);
    try { setDone(await signUp(v.displayName, v.email, v.password)); }
    catch (x) { setServerError(friendlyError(x)); }
    finally { setBusy(false); }
  };

  if (done) return (
    <>
      <Heading title="Quase lá" sub="Sua conta foi registrada." />
      <div className="stack fade-in">
        {done.needsConfirmation
          ? <Alert tone="ok" icon="check"><strong>Confirme seu e-mail.</strong> Enviamos uma mensagem para <strong>{v.email}</strong>. Depois de confirmar, volte e entre. Se não chegar, verifique o spam.</Alert>
          : <Alert tone="ok" icon="check">Conta criada e sessão iniciada.</Alert>}
        <Button variant="primary" onClick={() => navigate('/entrar')}>Ir para o login</Button>
      </div>
    </>
  );
  return (
    <>
      <Heading title="Criar conta" sub="Toda conta nova começa como jogador. O papel de mestre é concedido por um processo controlado, nunca escolhido aqui." />
      <form className="stack" onSubmit={submit} noValidate>
        {serverError && <Alert tone="bad">{serverError}</Alert>}
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
        <Button type="submit" variant="primary" block loading={busy}>{busy ? 'Criando…' : 'Criar conta'}</Button>
      </form>
      <hr className="divider" />
      <p className="center small" style={{ margin: 0 }}><Link to="/entrar">← Voltar ao login</Link></p>
      {terms && <Modal title="Termos provisórios" onClose={() => setTerms(false)} actions={<Button variant="primary" onClick={() => { set('terms', true); setErrors((p) => ({ ...p, terms: undefined })); setTerms(false); }}>Aceitar</Button>}>
        <p>Texto de exemplo: os termos reais ainda não foram escritos. Guardamos apenas e-mail, nome de exibição e os dados das suas campanhas e fichas.</p>
      </Modal>}
    </>
  );
}

export function RecoverPage() {
  const { requestReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [serverError, setServerError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setServerError(null);
    const er = validateRecovery({ email }); setError(er.email); if (er.email) return;
    setBusy(true);
    try { await requestReset(email); setSent(true); } catch (x) { setServerError(friendlyError(x)); } finally { setBusy(false); }
  };
  return (
    <>
      <Heading title="Recuperar acesso" sub="Informe o e-mail da conta para receber o link de redefinição." />
      {sent ? <div className="stack fade-in"><Alert tone="ok" icon="check">Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha. Ele expira em pouco tempo.</Alert><Link to="/entrar">← Voltar ao login</Link></div> : (
        <form className="stack" onSubmit={submit} noValidate>
          {serverError && <Alert tone="bad">{serverError}</Alert>}
          <Field label="E-mail" htmlFor="rec-email" error={error}>
            <input id="rec-email" className="input" type="email" value={email} autoComplete="email" aria-invalid={!!error || undefined} aria-describedby={error ? 'rec-email-err' : undefined} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" variant="primary" block loading={busy}>{busy ? 'Enviando…' : 'Enviar link'}</Button>
          <p className="center small" style={{ margin: 0 }}><Link to="/entrar">← Voltar ao login</Link></p>
        </form>
      )}
    </>
  );
}

/** Destino do link do e-mail. Só mostra o formulário se houver uma sessão de recuperação válida. */
export function ResetPasswordPage() {
  const { recovery, status, updatePassword, signOut } = useAuth();
  const [v, setV] = useState({ password: '', confirm: '' });
  const [errors, setErrors] = useState<Errors<'password' | 'confirm'>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const linkError = new URLSearchParams(window.location.search).get('error_description');

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setServerError(null);
    const er = validateNewPassword(v); setErrors(er); if (Object.keys(er).length) return;
    setBusy(true);
    try { await updatePassword(v.password); setDone(true); } catch (x) { setServerError(friendlyError(x)); } finally { setBusy(false); }
  };
  if (done) return <><Heading title="Senha atualizada" sub="Use a nova senha nos próximos acessos." /><Button variant="primary" block onClick={() => navigate(status === 'authed' ? '/jogador' : '/entrar')}>Continuar</Button></>;
  if (!recovery) return (
    <>
      <Heading title="Link inválido ou expirado" sub="Não encontramos uma solicitação de redefinição válida." />
      <div className="stack">
        <Alert tone="warn">{linkError ? 'O link expirou ou já foi usado.' : 'Abra o link mais recente enviado ao seu e-mail ou peça um novo.'}</Alert>
        <Button variant="primary" onClick={() => navigate('/recuperar')}>Pedir novo link</Button>
        {status === 'authed' && <Button variant="ghost" onClick={() => signOut()}>Sair</Button>}
      </div>
    </>
  );
  return (
    <>
      <Heading title="Definir nova senha" sub="Escolha uma senha forte que você não use em outros lugares." />
      <form className="stack" onSubmit={submit} noValidate>
        {serverError && <Alert tone="bad">{serverError}</Alert>}
        <Field label="Nova senha" htmlFor="new-pw" error={errors.password} hint="Mínimo de 8 caracteres, com letras e números.">
          <PasswordInput id="new-pw" value={v.password} onChange={(x) => setV({ ...v, password: x })} invalid={!!errors.password} autoComplete="new-password" describedBy={errors.password ? 'new-pw-err' : undefined} />
        </Field>
        <Field label="Confirmar nova senha" htmlFor="new-confirm" error={errors.confirm}>
          <PasswordInput id="new-confirm" value={v.confirm} onChange={(x) => setV({ ...v, confirm: x })} invalid={!!errors.confirm} autoComplete="new-password" describedBy={errors.confirm ? 'new-confirm-err' : undefined} />
        </Field>
        <Button type="submit" variant="primary" block loading={busy}>{busy ? 'Salvando…' : 'Salvar nova senha'}</Button>
      </form>
    </>
  );
}
