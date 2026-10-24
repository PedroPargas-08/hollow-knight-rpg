import { useCallback, useEffect, useRef, useState } from 'react';
import { friendlyError } from './sheet';

/** Carrega dados assíncronos com estados de carregamento/erro e recarga manual. Ignora respostas obsoletas. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, set] = useState<{ data?: T; error: string | null; loading: boolean }>({ error: null, loading: true });
  const [n, setN] = useState(0);
  const fnRef = useRef(fn); fnRef.current = fn;
  useEffect(() => {
    let alive = true; set((s) => ({ ...s, loading: true, error: null }));
    fnRef.current().then((data) => alive && set({ data, error: null, loading: false }), (e) => alive && set((s) => ({ data: s.data, error: friendlyError(e), loading: false })));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);
  return { ...state, reload: useCallback(() => setN((x) => x + 1), []) };
}
