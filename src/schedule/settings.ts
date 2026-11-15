import { isoDatePattern } from './shift';

// Generator settings that tune the schedule rather than describe the company (ADR-aaa3ccd, ADR-a1cb97d,
// ADR-c2f8933). One place for the allowed range of every number, used by the settings dialog.

export interface NumberRange {
  min: number;
  max: number;
  step: number;
  /** Value of a fresh data file, shown in the help text. */
  fallback: number;
}

export const settingRanges = {
  patternWeight: { min: 0.5, max: 10, step: 0.5, fallback: 4 },
  fairnessWeight: { min: 0.5, max: 10, step: 0.5, fallback: 2 },
  fairnessCap: { min: 0, max: 10, step: 0.5, fallback: 2 },
  compensationGap: { min: 1, max: 10, step: 0.5, fallback: 4 },
} as const satisfies Record<string, NumberRange>;

export type NumberSetting = keyof typeof settingRanges;

export type SettingError = 'required' | 'range' | 'monday';

/** Checks the text of a number field: filled, a number, and inside the allowed range. */
export function validateNumber(raw: string, range: NumberRange): SettingError | null {
  if (raw.trim() === '') return 'required';
  const value = Number(raw);
  if (!Number.isFinite(value)) return 'required';
  return value < range.min || value > range.max ? 'range' : null;
}

/** The start of the rotation must be a real date and a Monday. */
export function validateMonday(date: string): SettingError | null {
  if (!isoDatePattern.test(date)) return 'required';
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const day = new Date(y, m - 1, d);
  if (Number.isNaN(day.getTime()) || day.getMonth() !== m - 1) return 'required';
  return day.getDay() === 1 ? null : 'monday';
}
