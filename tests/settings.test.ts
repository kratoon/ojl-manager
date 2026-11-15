import { describe, expect, it } from 'vitest';
import { companySchema } from '../src/data/schema';
import { settingRanges, validateMonday, validateNumber } from '../src/schedule/settings';

describe('validateNumber', () => {
  const r = settingRanges.fairnessWeight; // 0.5 to 10

  it('accepts values inside the range, including the ends', () => {
    expect(validateNumber('2', r)).toBeNull();
    expect(validateNumber('0.5', r)).toBeNull();
    expect(validateNumber('10', r)).toBeNull();
  });

  it('rejects values outside the range', () => {
    expect(validateNumber('0.4', r)).toBe('range');
    expect(validateNumber('10.5', r)).toBe('range');
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

describe('validateMonday', () => {
  it('accepts a Monday', () => expect(validateMonday('2026-11-02')).toBeNull());
  it('rejects other weekdays', () => expect(validateMonday('2026-11-03')).toBe('monday'));
  it('rejects empty or impossible dates', () => {
    expect(validateMonday('')).toBe('required');
    expect(validateMonday('2026-02-31')).toBe('required');
  });
});
