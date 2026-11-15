import { describe, expect, it } from 'vitest';
import { dataSchema, type Data } from '../src/data/schema';
import { generate } from '../src/schedule/generator';
import { patternWorks } from '../src/schedule/pattern';
import { shiftKey, shiftsBetween, type Shift } from '../src/schedule/shift';

const sh = (date: string, part: 'day' | 'night' = 'day'): Shift => ({ date, part });

function team(n: number, paired: boolean, patch: (e: Record<string, unknown>, i: number) => Record<string, unknown> = (e) => e) {
  return Array.from({ length: n }, (_, i) => {
    const e: Record<string, unknown> = { id: `e${i + 1}`, name: `Employee ${i + 1}` };
    if (paired) e.partnerId = `e${i % 2 === 0 ? i + 2 : i}`;
    return patch(e, i);
  });
}

/** Day and night shifts per employee. */
function kinds(assignments: Record<string, { employeeId: string }[]>, from = '0000', to = '9999') {
  const result: Record<string, { day: number; night: number }> = {};
  for (const [key, list] of Object.entries(assignments)) {
    const date = key.slice(0, 10);
    if (date < from || date > to) continue;
    for (const a of list) {
      const c = (result[a.employeeId] ??= { day: 0, night: 0 });
      if (key.endsWith(':night')) c.night++;
      else c.day++;
    }
  }
  return result;
}

describe('day and night balance', () => {
  it('without a rotation nobody gets only nights or only days', () => {
    const data: Data = dataSchema.parse({ employees: team(6, false), company: {} });
    const range = { from: sh('2026-12-01'), to: sh('2027-02-28', 'night') };
    const { assignments } = generate({ data, range, startAt: range.from });
    for (const [id, c] of Object.entries(kinds(assignments))) {
      expect(Math.abs(c.day - c.night), `${id} ${JSON.stringify(c)}`).toBeLessThanOrEqual(2);
    }
  });

  it('compensation after PTO does not skew the returning employee to one kind', () => {
    const employees = team(8, true, (e) => (e.id === 'e1' ? { ...e, vacations: [{ id: 'v', from: sh('2026-11-02'), to: sh('2026-11-22', 'night'), compensate: true }] } : e));
    const data = dataSchema.parse({ employees, company: {} });
    const range = { from: sh('2026-11-02'), to: sh('2027-03-31', 'night') };
    const { assignments } = generate({ data, range, startAt: range.from });
    const k = kinds(assignments);
    for (const [id, c] of Object.entries(k)) {
      expect(Math.abs(c.day - c.night), `${id} ${JSON.stringify(c)}`).toBeLessThanOrEqual(3);
    }
  });

  it('makes up a missing kind first: an employee behind on nights gets nights', () => {
    // e1 has worked only days so far (locked), everybody else is even: the next free seats go to nights.
    const assignments: Record<string, unknown> = {};
    for (const d of shiftsBetween(sh('2026-12-01'), sh('2026-12-14', 'night')))
      if (d.part === 'day' && Number(d.date.slice(8)) % 2 === 0) assignments[shiftKey(d)] = [{ employeeId: 'e1', source: 'manual' }];
    const data = dataSchema.parse({ employees: team(6, false), assignments, company: {} });
    const range = { from: sh('2026-12-01'), to: sh('2027-01-31', 'night') };
    const { assignments: out } = generate({ data, range, startAt: sh('2026-12-15') });
    const after = kinds(out, '2026-12-15');
    expect(after.e1?.night ?? 0).toBeGreaterThan(after.e1?.day ?? 0);
  });

  it('keeps the rotation exactly when nobody needs compensation', () => {
    const data = dataSchema.parse({ employees: team(8, true), company: {} });
    const range = { from: sh('2026-11-02'), to: sh('2026-11-29', 'night') };
    const { assignments } = generate({ data, range, startAt: range.from });
    for (const shift of shiftsBetween(range.from, range.to)) {
      const p = [0, 1, 2, 3].find((x) => patternWorks(x, shift, '2026-11-02')) as number;
      const ids = (assignments[shiftKey(shift)] ?? []).map((a) => a.employeeId).sort();
      expect(ids).toEqual([`e${2 * p + 1}`, `e${2 * p + 2}`]);
    }
  });
});
