import { describe, expect, it } from 'vitest';
import { dataSchema } from '../src/data/schema';
import sample from '../data/sample.json';

describe('data schema', () => {
  it('accepts the sample file', () => {
    expect(dataSchema.safeParse(sample).success).toBe(true);
  });

  it('rejects an employee without a last name', () => {
    expect(dataSchema.safeParse({ employees: [{ id: '1', firstName: 'A', lastName: ' ' }] }).success).toBe(false);
  });
});
