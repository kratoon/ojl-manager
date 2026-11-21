import { dataSchema, type Data } from './schema';

const pad = (n: number) => String(n).padStart(2, '0');

/** `rozvrh-smen-DD-MM-YYYY-HHmmss.json` in local time (ADR-112163d). */
export function dataFileName(date: Date): string {
  const day = `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
  const time = `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  return `rozvrh-smen-${day}-${time}.json`;
}

export function serializeData(data: Data): string {
  return `${JSON.stringify(dataSchema.parse(data), null, 2)}\n`;
}

/** Parses the text of a data file. Throws when it is not valid JSON or does not match the schema. */
export function parseDataFile(text: string): Data {
  return dataSchema.parse(JSON.parse(text));
}
