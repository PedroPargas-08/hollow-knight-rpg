
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './auth';

export interface Prefs {
  reduceEffects: boolean;
  highContrast: boolean;
  textScale: 'normal' | 'grande' | 'maior';
}

interface Ctx {
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
}

const C = createContext<Ctx | null>(null);

const DEFAULT_PREFS: Prefs = {
  reduceEffects: false,
  highContrast: false,
  textScale: 'normal',
};

const SCALE = {
  normal: '100%',
  grande: '112.5%',
  maior: '125%',
} as const;

function storageKey(userId: string | null) {
  return userId
    ? `valdrim:prefs:${userId}`
    : 'valdrim:prefs:guest';
}

function loadPrefs(userId: string | null): Prefs {
  try {
    const saved = localStorage.getItem(storageKey(userId));
    if (!saved) return DEFAULT_PREFS;

    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_PREFS;

    const data = parsed as Partial<Prefs>;

    return {
      reduceEffects:
        typeof data.reduceEffects === 'boolean'
          ? data.reduceEffects
          : DEFAULT_PREFS.reduceEffects,
      highContrast:
        typeof data.highContrast === 'boolean'
          ? data.highContrast
          : DEFAULT_PREFS.highContrast,
      textScale:
        data.textScale === 'grande' || data.textScale === 'maior'
          ? data.textScale
          : 'normal',
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const { status, session } = useAuth();
  const userId = status === 'authed' ? session?.user.id ?? null : null;

  const [prefs, set] = useState<Prefs>(DEFAULT_PREFS);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  const key = storageKey(userId);

  useEffect(() => {
    if (status === 'loading') return;

    set(loadPrefs(userId));
    setLoadedKey(key);
  }, [key, status, userId]);

  useEffect(() => {
    const d = document.documentElement;

    d.dataset.effects = prefs.reduceEffects ? 'reduzidos' : 'normais';
    d.dataset.contrast = prefs.highContrast ? 'alto' : 'normal';
    d.style.fontSize = SCALE[prefs.textScale];

    return () => {
      d.dataset.effects = 'normais';
      d.dataset.contrast = 'normal';
      d.style.fontSize = '';
    };
  }, [prefs]);

  useEffect(() => {
    if (status === 'loading' || loadedKey !== key) return;

    try {
      localStorage.setItem(key, JSON.stringify(prefs));
    } catch {
      // A aplicação continua funcionando mesmo se o armazenamento estiver indisponível.
    }
  }, [key, loadedKey, prefs, status]);

  const value = useMemo<Ctx>(
    () => ({
      prefs,
      setPrefs: (updates) => set((current) => ({ ...current, ...updates })),
    }),
    [prefs],
  );

  return <C.Provider value={value}>{children}</C.Provider>;
}

export function usePrefs() {
  const context = useContext(C);
  if (!context) throw new Error('usePrefs fora do PrefsProvider');
  return context;
}
