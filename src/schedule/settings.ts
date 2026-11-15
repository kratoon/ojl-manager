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
  patternWeight: { min: 1, max: 100, step: 1, fallback: 40 },
  fairnessWeight: { min: 1, max: 100, step: 1, fallback: 20 },
  kindBalanceWeight: { min: 1, max: 100, step: 1, fallback: 10 },
  fairnessCap: { min: 0, max: 10, step: 0.5, fallback: 2 },
  compensationGap: { min: 1, max: 10, step: 0.5, fallback: 4 },
} as const satisfies Record<string, NumberRange>;

export type NumberSetting = keyof typeof settingRanges;

export type SettingError = 'required' | 'range';

/** Checks the text of a number field: filled, a number, and inside the allowed range. */
export function validateNumber(raw: string, range: NumberRange): SettingError | null {
  if (raw.trim() === '') return 'required';
  const value = Number(raw);
  if (!Number.isFinite(value)) return 'required';
  return value < range.min || value > range.max ? 'range' : null;
}

/**
 * The rotation only always wins while its weight is greater than the sum of all other weights: every rule
 * scores 1 to 10, so the others together can move the average as far as the pattern can. True when it holds.
 */
export function patternDominates(patternWeight: number, otherWeights: number[]): boolean {
  return patternWeight > otherWeights.reduce((sum, w) => sum + w, 0);
}
