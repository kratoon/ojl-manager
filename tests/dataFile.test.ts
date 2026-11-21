import { describe, expect, it } from 'vitest';
import { MemoryDataStore } from '../src/data/DataStore';
import { compareVersions, dataFileName, fileWarnings, parseDataFile, serializeData } from '../src/data/dataFile';
import { emptyData } from '../src/data/schema';

describe('dataFileName', () => {
  it('uses DD-MM-YYYY-HHmmss in local time, zero-padded', () => {
    expect(dataFileName(new Date(2026, 10, 21, 13, 45, 30))).toBe('rozvrh-smen-21-11-2026-134530.json');
    expect(dataFileName(new Date(2026, 0, 5, 3, 4, 5))).toBe('rozvrh-smen-05-01-2026-030405.json');
  });
});

const meta = { updatedAt: '2026-11-21T13:45:30.000Z', version: '0.2.0' };

describe('data file', () => {
  it('round-trips data and header through serialize and parse', () => {
    const parsed = parseDataFile(serializeData(emptyData, meta));
    expect(parsed.data).toEqual(emptyData);
    expect(parsed.meta).toEqual(meta);
  });

  it('writes updatedAt and version as the first two keys', () => {
    expect(Object.keys(JSON.parse(serializeData(emptyData, meta))).slice(0, 2)).toEqual(['updatedAt', 'version']);
  });

  it('accepts older files without a header', () => {
    expect(parseDataFile('{"employees":[]}').meta).toEqual({});
  });

  it('rejects invalid JSON and wrong shapes', () => {
    expect(() => parseDataFile('not json')).toThrow();
    expect(() => parseDataFile('{"employees": "nope"}')).toThrow();
  });
});

describe('compareVersions', () => {
  it('compares numerically, not as text', () => {
    expect(compareVersions('0.10.0', '0.9.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
    expect(compareVersions('0.1.0', '0.1.1')).toBeLessThan(0);
  });
});

describe('fileWarnings', () => {
  it('warns about a file from a newer app version', () => {
    expect(fileWarnings({ version: '0.3.0' }, '0.2.0')).toEqual([{ kind: 'newerVersion', version: '0.3.0' }]);
    expect(fileWarnings({ version: '0.2.0' }, '0.2.0')).toEqual([]);
  });

  it('warns about a file older than the loaded data', () => {
    expect(fileWarnings({ updatedAt: '2026-01-01T00:00:00.000Z' }, '1.0.0', '2026-02-01T00:00:00.000Z')).toEqual([
      { kind: 'olderFile' },
    ]);
    expect(fileWarnings({}, '1.0.0', '2026-02-01T00:00:00.000Z')).toEqual([]);
  });
});

describe('MemoryDataStore', () => {
  it('starts empty, is not persistent and returns what was saved', async () => {
    const store = new MemoryDataStore();
    expect(store.persistent).toBe(false);
    expect(await store.load()).toEqual(emptyData);
    const next = parseDataFile('{"employees":[{"id":"a","name":"Anna"}]}').data;
    await store.save(next);
    expect((await store.load()).employees).toHaveLength(1);
  });
});
