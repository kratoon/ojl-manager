import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { LocalApiDataStore, MemoryDataStore, type DataStore } from './DataStore';
import { dataFileName, fileWarnings, parseDataFile, serializeData, type FileWarning } from './dataFile';
import { APP_VERSION } from '../version';
import type { Data } from './schema';

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: Data };

interface DataContextValue {
  state: State;
  save(next: Data): Promise<void>;
  /** True when there are changes that exist only in memory (not downloaded yet). */
  dirty: boolean;
  /**
   * Replaces the data with the content of a file picked from the user's PC. Throws on an invalid file.
   * Resolves with warnings (newer app version, older than the loaded data); the file is opened anyway.
   */
  openFile(file: File): Promise<FileWarning[]>;
  /** Downloads the current data as `rozvrh-smen-<date>.json`. */
  downloadFile(): void;
}

/** `npm run dev` keeps using data/local.json; everywhere else data lives in memory only (ADR-112163d). */
function defaultStore(): DataStore {
  return import.meta.env.DEV ? new LocalApiDataStore() : new MemoryDataStore();
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ store, children }: { store?: DataStore; children: ReactNode }) {
  const activeStore = useMemo(() => store ?? defaultStore(), [store]);
  const [state, setState] = useState<State>({ status: 'loading' });
  const [dirty, setDirty] = useState(false);
  // `updatedAt` of the file the current data came from or was last saved to.
  const [fileUpdatedAt, setFileUpdatedAt] = useState<string>();

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
      if (!activeStore.persistent) setDirty(true);
    },
    [activeStore],
  );

  const openFile = useCallback(
    async (file: File) => {
      const { data, meta } = parseDataFile(await file.text());
      const warnings = fileWarnings(meta, APP_VERSION, fileUpdatedAt);
      await activeStore.save(data);
      setState({ status: 'ready', data });
      setFileUpdatedAt(meta.updatedAt);
      setDirty(false);
      return warnings;
    },
    [activeStore, fileUpdatedAt],
  );

  const downloadFile = useCallback(() => {
    if (state.status !== 'ready') return;
    const now = new Date();
    const updatedAt = now.toISOString();
    const url = URL.createObjectURL(
      new Blob([serializeData(state.data, { updatedAt, version: APP_VERSION })], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = dataFileName(now);
    link.click();
    URL.revokeObjectURL(url);
    setFileUpdatedAt(updatedAt);
    setDirty(false);
  }, [state]);

  // Unsaved in-memory changes are lost on reload or close: ask the browser to confirm.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const value = useMemo(
    () => ({ state, save, dirty, openFile, downloadFile }),
    [state, save, dirty, openFile, downloadFile],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
