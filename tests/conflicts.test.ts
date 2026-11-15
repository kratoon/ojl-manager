import { describe, expect, it } from 'vitest';
import { dataSchema, TEMPORARY_ID } from '../src/data/schema';
import { conflictIndex, findConflicts } from '../src/schedule/conflicts';
import { generate } from '../src/schedule/generator';
import type { Shift } from '../src/schedule/shift';

const sh = (date: string, part: 'day' | 'night' = 'day'): Shift => ({ date, part });

const team = (vacationOf?: { id: string; from: Shift; to: Shift }) =>
  Array.from({ length: 8 }, (_, i) => ({
    id: `e${i + 1}`,
    name: `Employee ${i + 1}`,
    partnerId: `e${i % 2 === 0 ? i + 2 : i}`,
    ...(vacationOf && i === 0 ? { vacations: [{ ...vacationOf, compensate: true }] } : {}),
  }));

const vacation = { id: 'v', from: sh('2026-12-07'), to: sh('2026-12-08', 'night') };

describe('findConflicts', () => {
  it('lists locked and automatic assignments on a vacation, in date order', () => {
    const data = dataSchema.parse({
      employees: team(vacation),
      assignments: {
        '2026-12-08:night': [{ employeeId: 'e1', source: 'auto' }],
        '2026-12-07:day': [{ employeeId: 'e1', source: 'manual' }, { employeeId: 'e2', source: 'manual' }],
        '2026-12-10:day': [{ employeeId: 'e1', source: 'manual' }],
      },
    });
    const found = findConflicts(data);
    expect(found.map((c) => `${c.shift.date}:${c.shift.part}|${c.employeeId}|${c.source}`)).toEqual([
      '2026-12-07:day|e1|manual',
      '2026-12-08:night|e1|auto',
    ]);
    expect(found[0]?.reasons).toEqual(['vacation']);
    expect(conflictIndex(found).get('2026-12-07:day|e1')).toEqual(['vacation']);
  });

  it('has no conflicts in a schedule that follows the rules, and ignores a temporary worker', () => {
    const data = dataSchema.parse({
      employees: team(vacation),
      assignments: { '2026-12-07:day': [{ employeeId: TEMPORARY_ID, source: 'manual' }, { employeeId: 'e2', source: 'manual' }] },
    });
    expect(findConflicts(data)).toEqual([]);
    const range = { from: sh('2026-11-02'), to: sh('2027-01-31', 'night') };
    const generated = generate({ data: dataSchema.parse({ employees: team(vacation) }), range, startAt: range.from });
    expect(findConflicts(dataSchema.parse({ employees: team(vacation), assignments: generated.assignments }))).toEqual([]);
  });
});

describe('regenerating and locked conflicts', () => {
  const range = { from: sh('2026-12-01'), to: sh('2026-12-27', 'night') };
  const conflicting = (source: 'manual' | 'auto') =>
    dataSchema.parse({
      employees: team(vacation),
      assignments: {
        '2026-12-07:day': [{ employeeId: 'e1', source }, { employeeId: 'e2', source: 'manual' }],
        '2026-12-09:day': [{ employeeId: 'e3', source: 'manual' }],
      },
    });

  it('never touches a locked conflict: the user unlocks it first', () => {
    const { assignments } = generate({ data: conflicting('manual'), range, startAt: range.from });
    expect(assignments['2026-12-07:day']?.map((a) => a.employeeId)).toEqual(['e1', 'e2']);
  });

  it('fixes the conflict once it is unlocked, keeping the other lock', () => {
    const data = conflicting('auto');
    const { assignments } = generate({ data, range, startAt: range.from });
    const day = assignments['2026-12-07:day'] ?? [];
    expect(day).toHaveLength(2);
    expect(day.map((a) => a.employeeId)).not.toContain('e1');
    expect(day.find((a) => a.employeeId === 'e2')).toEqual({ employeeId: 'e2', source: 'manual' });
    expect(assignments['2026-12-09:day']?.find((a) => a.employeeId === 'e3')?.source).toBe('manual');
    expect(findConflicts({ ...data, assignments })).toEqual([]);
  });
});

describe('seat order when regenerating', () => {
  const range = { from: sh('2026-12-01'), to: sh('2026-12-27', 'night') };
  const ids = (a: Record<string, { employeeId: string }[]>, key: string) => (a[key] ?? []).map((x) => x.employeeId);

  it('puts the replacement in the freed seat, whichever seat that is', () => {
    const run = (list: { employeeId: string; source: 'auto' | 'manual' }[]) =>
      ids(generate({ data: dataSchema.parse({ employees: team(vacation), assignments: { '2026-12-07:day': list } }), range, startAt: range.from }).assignments, '2026-12-07:day');
    const a = run([{ employeeId: 'e1', source: 'auto' }, { employeeId: 'e2', source: 'manual' }]);
    expect(a[1]).toBe('e2'); // the other employee stays second
    expect(a[0]).not.toBe('e1');
    const b = run([{ employeeId: 'e2', source: 'manual' }, { employeeId: 'e1', source: 'auto' }]);
    expect(b[0]).toBe('e2'); // and stays first
    expect(b[1]).not.toBe('e1');
  });

  it('does not reorder employees that stay, even when their name order differs from the seat order', () => {
    const plain = generate({ data: dataSchema.parse({ employees: team() }), range, startAt: range.from }).assignments;
    const flipped = Object.fromEntries(Object.entries(plain).map(([k, l]) => [k, [...l].reverse()]));
    const again = generate({ data: dataSchema.parse({ employees: team(), assignments: flipped }), range, startAt: range.from }).assignments;
    expect(again).toEqual(flipped);
  });

  it('lists a shift that was empty in the fixed employee order', () => {
    const { assignments } = generate({ data: dataSchema.parse({ employees: team() }), range, startAt: range.from });
    const two = ids(assignments, '2026-12-01:day');
    expect([...two].sort()).toEqual(two);
  });
});
