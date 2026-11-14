import { dataSchema, type Data } from './schema';

/** Storage backend for app data (ADR-514da88). Swappable once hosting is decided. */
export interface DataStore {
  load(): Promise<Data>;
  save(data: Data): Promise<void>;
}

/** Talks to the dev-server-only local data API. Available on localhost only. */
export class LocalApiDataStore implements DataStore {
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
