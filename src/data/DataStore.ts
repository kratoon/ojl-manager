import { dataSchema, emptyData, type Data } from './schema';

/** Storage backend for app data (ADR-514da88, ADR-112163d). */
export interface DataStore {
  /** True when saved data survives a page reload. In-memory data is lost, so the user must download it. */
  readonly persistent: boolean;
  load(): Promise<Data>;
  save(data: Data): Promise<void>;
}

/** Talks to the dev-server-only local data API (data/local.json). Used by `npm run dev` only. */
export class LocalApiDataStore implements DataStore {
  readonly persistent = true;

  constructor(private readonly url = `${import.meta.env.BASE_URL}api/data`) {}

  async load(): Promise<Data> {
    const res = await fetch(this.url);
    if (!res.ok) throw new Error(`load failed: ${res.status}`);
    return dataSchema.parse(await res.json());
  }

  async save(data: Data): Promise<void> {
    const res = await fetch(this.url, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(dataSchema.parse(data)),
    });
    if (!res.ok) throw new Error(`save failed: ${res.status}`);
  }
}

/**
 * Keeps data in memory only (ADR-112163d). Nothing is persisted: the user opens a data file
 * from their PC and downloads it again to keep changes.
 */
export class MemoryDataStore implements DataStore {
  readonly persistent = false;

  constructor(private data: Data = emptyData) {}

  async load(): Promise<Data> {
    return this.data;
  }

  async save(data: Data): Promise<void> {
    this.data = dataSchema.parse(data);
  }
}
