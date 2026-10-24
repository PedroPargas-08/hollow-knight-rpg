import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { friendlyError } from '../lib/sheet';

export interface Profile { id: string; display_name: string; role: 'jogador' | 'mestre' }
type Status = 'loading' | 'anon' | 'authed';
interface AuthCtx {
  status: Status; session: Session | null; profile: Profile | null; profileError: string | null;
  /** true quando o usuário chegou por um link de recuperação de senha válido */
  recovery: boolean; notice: string | null; clearNotice: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  refreshProfile: () => void;
}
const Ctx = createContext<AuthCtx | null>(null);
const baseUrl = () => window.location.origin + window.location.pathname;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [recovery, setRecovery] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const manual = useRef(false);

  // IMPORTANTE: o callback NÃO chama o Supabase (evita deadlock); só atualiza o estado.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') {
        setSession(null); setProfile(null); setProfileError(null); setRecovery(false); setStatus('anon');
        if (!manual.current) setNotice('Sua sessão expirou. Entre novamente.');
        manual.current = false;
        return;
      }
      setSession(s); setStatus(s ? 'authed' : 'anon');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  // O perfil vem do banco (nunca do JWT/metadata): é a única fonte do papel.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    let alive = true; setProfileError(null);
    supabase.from('profiles').select('id, display_name, role').eq('id', userId).maybeSingle().then(({ data, error }) => {
      if (!alive) return;
      if (error) setProfileError(friendlyError(error)); else if (!data) setProfileError('Não encontramos seu perfil. Saia e entre novamente.'); else setProfile(data as Profile);
    });
    return () => { alive = false; };
  }, [userId, tick]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw error;
    setNotice(null);
  }, []);
  const signUp = useCallback(async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { display_name: name.trim() }, emailRedirectTo: baseUrl() } });
    if (error) throw error;
    return { needsConfirmation: !data.session };
  }, []);
  const signOut = useCallback(async () => {
    manual.current = true;
    const { error } = await supabase.auth.signOut();
    if (error) { manual.current = false; throw error; }
  }, []);
  const requestReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: baseUrl() + '#/redefinir-senha' });
    if (error) throw error;
  }, []);
  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    setRecovery(false);
  }, []);

  const value = useMemo<AuthCtx>(() => ({
    status, session, profile, profileError, recovery, notice, clearNotice: () => setNotice(null),
    signIn, signUp, signOut, requestReset, updatePassword, refreshProfile: () => setTick((t) => t + 1),
  }), [status, session, profile, profileError, recovery, notice, signIn, signUp, signOut, requestReset, updatePassword]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth() { const c = useContext(Ctx); if (!c) throw new Error('useAuth fora do AuthProvider'); return c; }
