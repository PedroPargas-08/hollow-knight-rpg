import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Role } from '../types';

export interface Prefs { reduceEffects: boolean; highContrast: boolean; textScale: 'normal' | 'grande' | 'maior' }
interface DemoCtx {
  role: Role; setRole: (r: Role) => void;
  empty: boolean; setEmpty: (v: boolean) => void;
  prefs: Prefs; setPrefs: (p: Partial<Prefs>) => void;
}
const Ctx = createContext<DemoCtx | null>(null);
const SCALE = { normal: '100%', grande: '112.5%', maior: '125%' } as const;

/** Estado de DEMONSTRAÇÃO, apenas em memória: nada é salvo, nenhuma autenticação real existe. */
export function DemoProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>('visitante');
  const [empty, setEmpty] = useState(false);
  const [prefs, setPrefsState] = useState<Prefs>({ reduceEffects: false, highContrast: false, textScale: 'normal' });
  useEffect(() => {
    const d = document.documentElement;
    d.dataset.effects = prefs.reduceEffects ? 'reduzidos' : 'normais';
    d.dataset.contrast = prefs.highContrast ? 'alto' : 'normal';
    d.style.fontSize = SCALE[prefs.textScale];
  }, [prefs]);
  const value = useMemo<DemoCtx>(() => ({ role, setRole, empty, setEmpty, prefs, setPrefs: (p) => setPrefsState((s) => ({ ...s, ...p })) }), [role, empty, prefs]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useDemo() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDemo fora do DemoProvider');
  return c;
}
