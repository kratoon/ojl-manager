import { describe, expect, it } from 'vitest';
import { dataSchema, emptyData } from '../src/data/schema';

const employee = { id: '1', name: 'A B' };

describe('data schema', () => {
  it('loads an old file (only employees) and fills defaults', () => {
    const data = dataSchema.parse({ employees: [employee] });
    expect(data.employees[0]).toMatchObject({ vacations: [], allowMixedPair: false });
    expect(data.assignments).toEqual({});
    expect(data.company).toMatchObject({ maxInRow: 3, fairnessWeight: 20, fairnessCap: 2 });
    expect(data.company.workingDays).toHaveLength(7);
  });

  it('accepts an empty file', () => {
    expect(dataSchema.safeParse(emptyData).success).toBe(true);
    expect(dataSchema.safeParse({}).success).toBe(true);
  });

  it('rejects an employee without a name', () => {
    expect(dataSchema.safeParse({ employees: [{ ...employee, name: ' ' }] }).success).toBe(false);
  });

  it('migrates first and last name from older files into one name', () => {
    const data = dataSchema.parse({ employees: [{ id: '1', firstName: 'Jana', lastName: 'Nováková' }, { id: '2', firstName: 'Petr', lastName: '' }] });
    expect(data.employees.map((e) => e.name)).toEqual(['Jana Nováková', 'Petr']);
    expect(data.employees[0]).not.toHaveProperty('firstName');
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

describe('weights scale migration', () => {
  it('multiplies weights of a company without a version by 10, once', () => {
    const old = dataSchema.parse({ company: { fairnessWeight: 2, kindBalanceWeight: 1, pattern: { weight: 4 } } });
    expect(old.company.fairnessWeight).toBe(20);
    expect(old.company.kindBalanceWeight).toBe(10);
    expect(old.company.pattern.weight).toBe(40);
    expect(old.company.weightsVersion).toBe(2);
    // Saved and loaded again: not scaled a second time.
    expect(dataSchema.parse(JSON.parse(JSON.stringify(old))).company.pattern.weight).toBe(40);
  });

  it('keeps the ratios of an old file, and leaves missing weights at the new defaults', () => {
    const partial = dataSchema.parse({ company: { fairnessWeight: 3 } });
    expect(partial.company.fairnessWeight).toBe(30);
    expect(partial.company.pattern.weight).toBe(40);
  });

  it('gives a fresh file the new defaults without scaling them', () => {
    const fresh = dataSchema.parse({});
    expect(fresh.company).toMatchObject({ fairnessWeight: 20, kindBalanceWeight: 10, weightsVersion: 2 });
    expect(fresh.company.pattern.weight).toBe(40);
  });
});
