import { describe, expect, it } from 'vitest';
import { dataSchema, emptyData } from '../src/data/schema';

describe('data schema', () => {
  it('accepts valid data and an empty file', () => {
    expect(dataSchema.safeParse({ employees: [{ id: '1', firstName: 'A', lastName: 'B' }] }).success).toBe(true);
    expect(dataSchema.safeParse(emptyData).success).toBe(true);
  });

  it('rejects an employee without a last name', () => {
    expect(dataSchema.safeParse({ employees: [{ id: '1', firstName: 'A', lastName: ' ' }] }).success).toBe(false);
  });
});
