import { describe, expect, it } from 'vitest';
import { MemoryDataStore } from '../src/data/DataStore';
import { dataFileName, parseDataFile, serializeData } from '../src/data/dataFile';
import { emptyData } from '../src/data/schema';

describe('dataFileName', () => {
  it('uses DD-MM-YYYY-HHmmss in local time, zero-padded', () => {
    expect(dataFileName(new Date(2026, 10, 21, 13, 45, 30))).toBe('rozvrh-smen-21-11-2026-134530.json');
    expect(dataFileName(new Date(2026, 0, 5, 3, 4, 5))).toBe('rozvrh-smen-05-01-2026-030405.json');
  });
});

describe('data file', () => {
  it('round-trips through serialize and parse', () => {
    expect(parseDataFile(serializeData(emptyData))).toEqual(emptyData);
  });

  it('rejects invalid JSON and wrong shapes', () => {
    expect(() => parseDataFile('not json')).toThrow();
    expect(() => parseDataFile('{"employees": "nope"}')).toThrow();
  });
});

describe('MemoryDataStore', () => {
  it('starts empty, is not persistent and returns what was saved', async () => {
    const store = new MemoryDataStore();
    expect(store.persistent).toBe(false);
    expect(await store.load()).toEqual(emptyData);
    const next = parseDataFile('{"employees":[{"id":"a","name":"Anna"}]}');
    await store.save(next);
    expect((await store.load()).employees).toHaveLength(1);
  });
});
