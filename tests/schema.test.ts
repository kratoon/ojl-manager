import { describe, expect, it } from 'vitest';
import { dataSchema, emptyData } from '../src/data/schema';

const employee = { id: '1', firstName: 'A', lastName: 'B' };

describe('data schema', () => {
  it('loads an old file (only employees) and fills defaults', () => {
    const data = dataSchema.parse({ employees: [employee] });
    expect(data.employees[0]).toMatchObject({ vacations: [], allowMixedPair: false });
    expect(data.assignments).toEqual({});
    expect(data.company).toMatchObject({ maxInRow: 3, fairnessWeight: 2, fairnessCap: 2 });
    expect(data.company.workingDays).toHaveLength(7);
  });

  it('accepts an empty file', () => {
    expect(dataSchema.safeParse(emptyData).success).toBe(true);
    expect(dataSchema.safeParse({}).success).toBe(true);
  });

  it('rejects an employee without a last name', () => {
    expect(dataSchema.safeParse({ employees: [{ ...employee, lastName: ' ' }] }).success).toBe(false);
  });

  it('defaults compensate to on', () => {
    const vacation = { id: 'v', from: { date: '2026-12-01', part: 'day' }, to: { date: '2026-12-05', part: 'night' } };
    const data = dataSchema.parse({ employees: [{ ...employee, vacations: [vacation] }] });
    expect(data.employees[0]?.vacations[0]?.compensate).toBe(true);
  });

  it('rejects a vacation that ends before it starts', () => {
    const vacation = { id: 'v', from: { date: '2026-12-05', part: 'day' }, to: { date: '2026-12-01', part: 'day' } };
    expect(dataSchema.safeParse({ employees: [{ ...employee, vacations: [vacation] }] }).success).toBe(false);
  });

  it('rejects first shift after last shift', () => {
    const e = { ...employee, firstShift: { date: '2027-01-01', part: 'day' }, lastShift: { date: '2026-01-01', part: 'day' } };
    expect(dataSchema.safeParse({ employees: [e] }).success).toBe(false);
  });

  it('validates assignment keys and sources', () => {
    const ok = { assignments: { '2026-11-14:day': { employeeId: '1', source: 'manual' } } };
    expect(dataSchema.safeParse(ok).success).toBe(true);
    expect(dataSchema.safeParse({ assignments: { '2026-11-14': { employeeId: '1', source: 'manual' } } }).success).toBe(false);
    expect(dataSchema.safeParse({ assignments: { '2026-11-14:day': { employeeId: '1', source: 'robot' } } }).success).toBe(false);
  });

  it('rejects impossible dates', () => {
    const vacation = { id: 'v', from: { date: '2026-13-45', part: 'day' }, to: { date: '2026-13-46', part: 'day' } };
    expect(dataSchema.safeParse({ employees: [{ ...employee, vacations: [vacation] }] }).success).toBe(false);
  });
});
