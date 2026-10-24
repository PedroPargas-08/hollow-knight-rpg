// Validação local e básica (apenas visual na Fase 1; o servidor validará de verdade depois).
export type Errors<K extends string> = Partial<Record<K, string>>;

export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export function validateLogin(v: { email: string; password: string }): Errors<'email' | 'password'> {
  const e: Errors<'email' | 'password'> = {};
  if (!v.email.trim()) e.email = 'Informe seu e-mail.';
  else if (!isEmail(v.email)) e.email = 'Esse e-mail parece incompleto. Exemplo: nome@dominio.com';
  if (!v.password) e.password = 'Informe sua senha.';
  return e;
}

/** 0 (vazia) a 4 (forte) — indicador visual simples. */
export function passwordStrength(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) s++;
  return s;
}

export type RegisterValues = { displayName: string; email: string; password: string; confirm: string; terms: boolean };
export function validateRegister(v: RegisterValues): Errors<keyof RegisterValues> {
  const e: Errors<keyof RegisterValues> = {};
  const name = v.displayName.trim();
  if (name.length < 2) e.displayName = 'O nome de exibição precisa ter ao menos 2 caracteres.';
  else if (name.length > 32) e.displayName = 'Use no máximo 32 caracteres.';
  if (!v.email.trim()) e.email = 'Informe seu e-mail.';
  else if (!isEmail(v.email)) e.email = 'Esse e-mail parece incompleto. Exemplo: nome@dominio.com';
  if (v.password.length < 8) e.password = 'A senha precisa ter ao menos 8 caracteres.';
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) e.password = 'Misture letras e números.';
  if (!v.confirm) e.confirm = 'Repita a senha para confirmar.';
  else if (v.confirm !== v.password) e.confirm = 'As senhas não são iguais.';
  if (!v.terms) e.terms = 'É preciso aceitar os termos provisórios para continuar.';
  return e;
}

export function validateNewPassword(v: { password: string; confirm: string }): Errors<'password' | 'confirm'> {
  const e: Errors<'password' | 'confirm'> = {};
  if (v.password.length < 8) e.password = 'A senha precisa ter ao menos 8 caracteres.';
  else if (!/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) e.password = 'Misture letras e números.';
  if (!v.confirm) e.confirm = 'Repita a senha para confirmar.';
  else if (v.confirm !== v.password) e.confirm = 'As senhas não são iguais.';
  return e;
}

export function validateRecovery(v: { email: string }): Errors<'email'> {
  if (!v.email.trim()) return { email: 'Informe o e-mail da conta.' };
  if (!isEmail(v.email)) return { email: 'Esse e-mail parece incompleto. Exemplo: nome@dominio.com' };
  return {};
}
