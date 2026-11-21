import { z } from 'zod';
import { dataSchema, type Data } from './schema';

const pad = (n: number) => String(n).padStart(2, '0');

/** `rozvrh-smen-DD-MM-YYYY-HHmmss.json` in local time (ADR-112163d). */
export function dataFileName(date: Date): string {
  const day = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `rozvrh-smen-${day}-${time}.json`;
}

/** Who wrote the file and when. Files from before this header existed have neither. */
export interface FileMeta {
  /** ISO timestamp of the save. */
  updatedAt?: string;
  /** App version (package.json) that wrote the file. */
  version?: string;
}

const metaSchema = z.object({
  updatedAt: z.string().optional().catch(undefined),
  version: z.string().optional().catch(undefined),
});

/** Serializes the data with `updatedAt` and `version` as the first two keys. */
export function serializeData(data: Data, meta: Required<FileMeta>): string {
  const body = { updatedAt: meta.updatedAt, version: meta.version, ...dataSchema.parse(data) };
  return `${JSON.stringify(body, null, 2)}\n`;
}

/** Parses the text of a data file. Throws when it is not valid JSON or does not match the schema. */
export function parseDataFile(text: string): { data: Data; meta: FileMeta } {
  const json: unknown = JSON.parse(text);
  return { data: dataSchema.parse(json), meta: metaSchema.parse(json) };
}

/** Compares `major.minor.patch` versions (a pre-release suffix is ignored). Negative when a < b. */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split('-')[0]!.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export type FileWarning = { kind: 'newerVersion'; version: string } | { kind: 'olderFile' };

/**
 * Warnings (never errors) for a file that is about to replace the loaded data:
 * written by a newer app version, or saved earlier than the data currently loaded.
 */
export function fileWarnings(meta: FileMeta, appVersion: string, loadedUpdatedAt?: string): FileWarning[] {
  const warnings: FileWarning[] = [];
  if (meta.version && compareVersions(meta.version, appVersion) > 0) {
    warnings.push({ kind: 'newerVersion', version: meta.version });
  }
  if (meta.updatedAt && loadedUpdatedAt && meta.updatedAt < loadedUpdatedAt) {
    warnings.push({ kind: 'olderFile' });
  }
  return warnings;
}
