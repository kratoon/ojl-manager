import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocalApiDataStore, type DataStore } from './DataStore';
import type { Data } from './schema';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Data };

interface DataContextValue {
  state: State;
  save(next: Data): Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ store, children }: { store?: DataStore; children: ReactNode }) {
  const activeStore = useMemo(() => store ?? new LocalApiDataStore(), [store]);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    activeStore.load().then(
      (data) => !cancelled && setState({ status: 'ready', data }),
      () => !cancelled && setState({ status: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [activeStore]);

  const save = useCallback(
    async (next: Data) => {
      await activeStore.save(next);
      setState({ status: 'ready', data: next });
    },
    [activeStore],
  );

  const value = useMemo(() => ({ state, save }), [state, save]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
