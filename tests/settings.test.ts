import { describe, expect, it } from 'vitest';
import { companySchema } from '../src/data/schema';
import { patternDominates, settingRanges, validateNumber } from '../src/schedule/settings';

describe('validateNumber', () => {
  const r = settingRanges.fairnessWeight; // 1 to 100

  it('accepts values inside the range, including the ends', () => {
    expect(validateNumber('20', r)).toBeNull();
    expect(validateNumber('1', r)).toBeNull();
    expect(validateNumber('100', r)).toBeNull();
  });

  it('rejects values outside the range', () => {
    expect(validateNumber('0.5', r)).toBe('range');
    expect(validateNumber('101', r)).toBe('range');
    expect(validateNumber('-1', r)).toBe('range');
  });

  it('rejects empty and non-numeric input', () => {
    expect(validateNumber('', r)).toBe('required');
    expect(validateNumber('  ', r)).toBe('required');
    expect(validateNumber('abc', r)).toBe('required');
  });

  it('allows 0 for the fairness cap only', () => {
    expect(validateNumber('0', settingRanges.fairnessCap)).toBeNull();
    expect(validateNumber('0', settingRanges.fairnessWeight)).toBe('range');
  });

  it('has defaults that are inside their own range and match the schema', () => {
    const company = companySchema.parse({});
    expect(company.pattern.weight).toBe(settingRanges.patternWeight.fallback);
    expect(company.fairnessWeight).toBe(settingRanges.fairnessWeight.fallback);
    expect(company.kindBalanceWeight).toBe(settingRanges.kindBalanceWeight.fallback);
    expect(company.fairnessCap).toBe(settingRanges.fairnessCap.fallback);
    expect(company.pattern.compensationGap).toBe(settingRanges.compensationGap.fallback);
    for (const range of Object.values(settingRanges)) {
      expect(range.fallback).toBeGreaterThanOrEqual(range.min);
      expect(range.fallback).toBeLessThanOrEqual(range.max);
    }
  });
});

describe('patternDominates', () => {
  it('holds for the defaults and leaves room for more rules', () => {
    const { patternWeight, fairnessWeight, kindBalanceWeight } = settingRanges;
    expect(patternDominates(patternWeight.fallback, [fairnessWeight.fallback, kindBalanceWeight.fallback])).toBe(true);
    expect(patternWeight.fallback - fairnessWeight.fallback - kindBalanceWeight.fallback).toBeGreaterThanOrEqual(10);
  });

  it('fails when the others together are as strong as the pattern', () => {
    expect(patternDominates(30, [20, 10])).toBe(false);
    expect(patternDominates(31, [20, 10])).toBe(true);
  });
});
