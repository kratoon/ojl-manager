import { describe, expect, it } from 'vitest';
import { dataSchema, type Data, type Employee } from '../src/data/schema';
import { generate } from '../src/schedule/generator';
import { brokenRules, defaultRules, evaluate, NEUTRAL_SCORE, weekdayOf, type Rule } from '../src/schedule/rules';
import { shiftKey, shiftsBetween, type Shift } from '../src/schedule/shift';

const sh = (date: string, part: 'day' | 'night' = 'day'): Shift => ({ date, part });

function makeData(n: number, patch: (employees: Employee[], data: Record<string, unknown>) => void = () => {}): Data {
  const employees = Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    firstName: `First${i + 1}`,
    lastName: `Last${i + 1}`,
  })) as unknown as Employee[];
  const raw: Record<string, unknown> = {};
  patch(employees, raw);
  return dataSchema.parse({ employees, ...raw });
}

const range = { from: sh('2026-12-01'), to: sh('2026-12-28', 'night') }; // 4 full weeks
const countsOf = (a: Record<string, { employeeId: string }>) => {
  const counts: Record<string, number> = {};
  for (const v of Object.values(a)) counts[v.employeeId] = (counts[v.employeeId] ?? 0) + 1;
  return counts;
};

describe('weekdayOf', () => {
  it('maps dates to weekdays', () => {
    expect(weekdayOf('2026-11-14')).toBe('SAT');
    expect(weekdayOf('2026-11-16')).toBe('MON');
  });
});

describe('rules', () => {
  const ctx = (data: Data, employeeId: string, shift: Shift, assigned: Record<string, string> = {}) => ({
    data,
    employee: data.employees.find((e) => e.id === employeeId)!,
    shift,
    assignedTo: (s: Shift) => assigned[shiftKey(s)],
    gap: 0,
  });
  const blockedBy = (data: Data, id: string, shift: Shift, assigned: Record<string, string> = {}) =>
    evaluate(defaultRules, ctx(data, id, shift, assigned)).blockedBy;

  it('blocks everyone on a non-working weekday', () => {
    const data = makeData(1, (_, d) => (d.company = { workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }));
    expect(blockedBy(data, 'e1', sh('2026-11-14'))).toEqual(['closed-weekday']); // Saturday
    expect(blockedBy(data, 'e1', sh('2026-11-16'))).toEqual([]);
  });

  it('blocks a closed period with half-day precision', () => {
    const data = makeData(1, (_, d) => (d.company = { closedPeriods: [{ id: 'c', from: sh('2026-12-24', 'night'), to: sh('2026-12-26', 'day') }] }));
    expect(blockedBy(data, 'e1', sh('2026-12-24', 'day'))).toEqual([]);
    expect(blockedBy(data, 'e1', sh('2026-12-24', 'night'))).toEqual(['closed-period']);
    expect(blockedBy(data, 'e1', sh('2026-12-26', 'day'))).toEqual(['closed-period']);
    expect(blockedBy(data, 'e1', sh('2026-12-26', 'night'))).toEqual([]);
  });

  it('blocks vacations, first and last shift', () => {
    const data = makeData(1, (e) => {
      Object.assign(e[0]!, {
        firstShift: sh('2026-12-02', 'night'),
        lastShift: sh('2026-12-20', 'day'),
        vacations: [{ id: 'v', from: sh('2026-12-10'), to: sh('2026-12-12', 'day'), compensate: true }],
      });
    });
    expect(blockedBy(data, 'e1', sh('2026-12-02', 'day'))).toEqual(['before-first-shift']);
    expect(blockedBy(data, 'e1', sh('2026-12-02', 'night'))).toEqual([]);
    expect(blockedBy(data, 'e1', sh('2026-12-11'))).toEqual(['vacation']);
    expect(blockedBy(data, 'e1', sh('2026-12-12', 'night'))).toEqual([]);
    expect(blockedBy(data, 'e1', sh('2026-12-20', 'night'))).toEqual(['after-last-shift']);
  });

  it('blocks a forbidden employee for one shift only', () => {
    const data = makeData(2, (_, d) => (d.forbiddenShifts = [{ id: 'f', shift: sh('2026-12-05'), employeeId: 'e1' }]));
    expect(blockedBy(data, 'e1', sh('2026-12-05'))).toEqual(['forbidden']);
    expect(blockedBy(data, 'e1', sh('2026-12-05', 'night'))).toEqual([]);
    expect(blockedBy(data, 'e2', sh('2026-12-05'))).toEqual([]);
  });

  it('allows 3 same-kind shifts in a row and blocks the 4th', () => {
    const data = makeData(1);
    const days = { '2026-12-01:day': 'e1', '2026-12-02:day': 'e1', '2026-12-03:day': 'e1' };
    expect(blockedBy(data, 'e1', sh('2026-12-04'), days)).toEqual(['max-in-row']);
    expect(blockedBy(data, 'e1', sh('2026-12-05'), days)).toEqual([]);
    expect(blockedBy(data, 'e1', sh('2026-12-04', 'night'), days)).toEqual([]); // other lane
    // Filling the gap between two runs would create a run of 5.
    const gap = { '2026-12-01:day': 'e1', '2026-12-02:day': 'e1', '2026-12-04:day': 'e1', '2026-12-05:day': 'e1' };
    expect(blockedBy(data, 'e1', sh('2026-12-03'), gap)).toEqual(['max-in-row']);
  });

  it('uses the per-employee override for max in a row', () => {
    const data = makeData(1, (e) => Object.assign(e[0]!, { maxInRow: 5 }));
    const days = { '2026-12-01:day': 'e1', '2026-12-02:day': 'e1', '2026-12-03:day': 'e1' };
    expect(blockedBy(data, 'e1', sh('2026-12-04'), days)).toEqual([]);
  });

  it('blocks day/night mixing back to back', () => {
    const data = makeData(1);
    expect(blockedBy(data, 'e1', sh('2026-12-01', 'night'), { '2026-12-01:day': 'e1' })).toEqual(['day-night-mix']);
    expect(blockedBy(data, 'e1', sh('2026-12-02', 'day'), { '2026-12-01:night': 'e1' })).toEqual(['day-night-mix']);
    // Day, rest night, day again is fine.
    expect(blockedBy(data, 'e1', sh('2026-12-02', 'day'), { '2026-12-01:day': 'e1' })).toEqual([]);
  });

  it('allows exactly one mixed pair with the override, never three', () => {
    const data = makeData(1, (e) => Object.assign(e[0]!, { allowMixedPair: true }));
    expect(blockedBy(data, 'e1', sh('2026-12-01', 'night'), { '2026-12-01:day': 'e1' })).toEqual([]);
    expect(blockedBy(data, 'e1', sh('2026-12-02', 'day'), { '2026-12-01:night': 'e1' })).toEqual([]);
    expect(blockedBy(data, 'e1', sh('2026-12-02', 'day'), { '2026-12-01:day': 'e1', '2026-12-01:night': 'e1' })).toEqual(['pair-limit']); // day+night+day
    expect(blockedBy(data, 'e1', sh('2026-12-02', 'night'), { '2026-12-01:night': 'e1', '2026-12-02:day': 'e1' })).toEqual(['pair-limit']); // night+day+night
  });

  it('combines: any 0 wins, otherwise weighted average, neutral without opinions', () => {
    const data = makeData(1);
    const rule = (id: string, score: number | null, weight = 1): Rule => ({
      id,
      weight: () => weight,
      evaluate: () => (score === null ? null : { score, reason: 'fairness' }),
    });
    const base = ctx(data, 'e1', sh('2026-12-01'));
    expect(evaluate([rule('a', null)], base).score).toBe(NEUTRAL_SCORE);
    expect(evaluate([rule('a', 9), rule('b', 1)], base).score).toBe(5);
    expect(evaluate([rule('a', 9), rule('b', 3, 2)], base).score).toBe(5); // (9 + 6) / 3
    expect(evaluate([rule('a', 10), rule('b', 0)], base).score).toBe(0);
    // A satisfied hard rule (no opinion) does not dilute a preference.
    expect(evaluate([rule('a', 5), rule('b', null), rule('c', null)], base).score).toBe(5);
  });

  it('reports which rules a manual assignment breaks', () => {
    const data = makeData(1, (e, d) => {
      Object.assign(e[0]!, { vacations: [{ id: 'v', from: sh('2026-12-10'), to: sh('2026-12-10', 'night'), compensate: true }] });
      d.assignments = { '2026-12-10:day': { employeeId: 'e1', source: 'manual' } };
    });
    expect(brokenRules(data, sh('2026-12-10'), 'e1')).toEqual(['vacation']);
    expect(brokenRules(data, sh('2026-12-11'), 'e1')).toEqual([]);
  });
});

describe('generate', () => {
  const startAt = range.from;

  it('fills every shift when rules allow, with similar totals', () => {
    const data = makeData(4);
    const { assignments, unfilled } = generate({ data, range, startAt });
    expect(unfilled).toEqual([]);
    expect(Object.keys(assignments)).toHaveLength(shiftsBetween(range.from, range.to).length);
    const counts = Object.values(countsOf(assignments));
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('follows the rules: no mixing, max in a row', () => {
    const data = makeData(5);
    const { assignments } = generate({ data, range, startAt });
    for (const [key, a] of Object.entries(assignments)) {
      const [date, part] = key.split(':') as [string, 'day' | 'night'];
      const problems = brokenRules({ ...data, assignments }, sh(date, part), a.employeeId);
      expect(problems, key).toEqual([]);
    }
  });

  it('never touches manual assignments, and counts them', () => {
    const data = makeData(3, (_, d) => {
      d.assignments = { '2026-12-03:day': { employeeId: 'e2', source: 'manual' }, '2026-11-20:night': { employeeId: 'e1', source: 'manual' } };
    });
    const { assignments } = generate({ data, range, startAt });
    expect(assignments['2026-12-03:day']).toEqual({ employeeId: 'e2', source: 'manual' });
    expect(assignments['2026-11-20:night']).toEqual({ employeeId: 'e1', source: 'manual' }); // outside range, kept
  });

  it('keeps everything before the start shift and recomputes auto assignments from it', () => {
    const data = makeData(3, (_, d) => {
      d.assignments = {
        '2026-12-01:day': { employeeId: 'e1', source: 'auto' },
        '2026-12-10:day': { employeeId: 'e1', source: 'auto' },
      };
    });
    const { assignments } = generate({ data, range, startAt: sh('2026-12-05') });
    expect(assignments['2026-12-01:day']).toEqual({ employeeId: 'e1', source: 'auto' });
    expect(assignments['2026-12-04:night']).toBeUndefined(); // before start and not assigned: stays empty
    expect(assignments['2026-12-05:day']).toBeDefined();
    expect(assignments['2026-12-10:day']?.source).toBe('auto');
  });

  it('leaves a shift empty with reasons when nobody can work it', () => {
    const data = makeData(2, (_, d) => (d.forbiddenShifts = [
      { id: 'f1', shift: sh('2026-12-02'), employeeId: 'e1' },
      { id: 'f2', shift: sh('2026-12-02'), employeeId: 'e2' },
    ]));
    const { assignments, unfilled } = generate({ data, range, startAt });
    expect(assignments['2026-12-02:day']).toBeUndefined();
    // (Two people cannot cover every shift under the sequence rules, so other shifts may be empty too.)
    expect(unfilled.find((u) => shiftKey(u.shift) === '2026-12-02:day')?.reasons).toContain('forbidden');
  });

  it('skips closed shifts without reporting them as unfilled', () => {
    const data = makeData(6, (_, d) => (d.company = { workingDays: ['MON', 'TUE', 'WED', 'THU', 'FRI'] }));
    const { assignments, unfilled } = generate({ data, range, startAt });
    expect(unfilled).toEqual([]);
    expect(assignments['2026-12-05:day']).toBeUndefined(); // Saturday
    expect(assignments['2026-12-07:day']).toBeDefined();
  });

  it('is deterministic: same input gives the same output', () => {
    const data = makeData(6);
    expect(generate({ data, range, startAt })).toEqual(generate({ data, range, startAt }));
  });

  it('is deterministic regardless of the order of the input', () => {
    const data = makeData(6, (_, d) => {
      d.forbiddenShifts = [{ id: 'f', shift: sh('2026-12-03'), employeeId: 'e2' }];
      d.assignments = { '2026-12-09:day': { employeeId: 'e4', source: 'manual' }, '2026-12-10:night': { employeeId: 'e1', source: 'manual' } };
    });
    const shuffled: Data = {
      ...data,
      employees: [...data.employees].reverse(),
      forbiddenShifts: [...data.forbiddenShifts].reverse(),
      assignments: Object.fromEntries(Object.entries(data.assignments).reverse()),
    };
    expect(generate({ data: shuffled, range, startAt })).toEqual(generate({ data, range, startAt }));
  });

  it('changes only when the constraints change (manual assignment)', () => {
    const data = makeData(4);
    const before = generate({ data, range, startAt }).assignments;
    const target = '2026-12-10:day';
    const other = before[target]?.employeeId === 'e1' ? 'e2' : 'e1';
    const locked: Data = { ...data, assignments: { [target]: { employeeId: other, source: 'manual' } } };
    expect(generate({ data: locked, range, startAt }).assignments[target]).toEqual({ employeeId: other, source: 'manual' });
  });

  it('gives a vacationing employee proportionally more shifts around compensated PTO', () => {
    const vacation = (compensate: boolean) => ({ id: 'v', from: sh('2026-12-08'), to: sh('2026-12-14', 'night'), compensate });
    const withFlag = (compensate: boolean) =>
      makeData(4, (e) => Object.assign(e[0]!, { vacations: [vacation(compensate)] }));
    const on = countsOf(generate({ data: withFlag(true), range, startAt }).assignments);
    const off = countsOf(generate({ data: withFlag(false), range, startAt }).assignments);
    // Compensate on: e1 makes up the missed shifts; off: e1 accepts fewer.
    expect(on.e1!).toBeGreaterThan(off.e1!);
    expect(off.e1!).toBeLessThan(off.e2!);
    expect(on.e1!).toBeGreaterThanOrEqual(on.e2! - 2);
  });

  it('shortens the target of an employee who starts later', () => {
    const data = makeData(3, (e) => Object.assign(e[0]!, { firstShift: sh('2026-12-15') }));
    const counts = countsOf(generate({ data, range, startAt }).assignments);
    expect(counts.e1!).toBeLessThan(counts.e2!);
  });

  it('bounds the spread of shift counts even with strong preferences', () => {
    const favourite: Rule = {
      id: 'pref-e1',
      evaluate: ({ employee }) => (employee.id === 'e1' ? { score: 10, reason: 'fairness' } : { score: 1, reason: 'fairness' }),
    };
    const data = makeData(5);
    const { assignments } = generate({ data, range, startAt, rules: [...defaultRules, favourite] });
    const counts = Object.values(countsOf(assignments));
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(4);
    // And without the cap it would be much worse, so preference does have an effect inside the bound.
    const e1 = countsOf(assignments).e1!;
    const others = Object.entries(countsOf(assignments)).filter(([id]) => id !== 'e1').map(([, n]) => n);
    expect(e1).toBeGreaterThanOrEqual(Math.max(...others));
  });

  it('prefers the higher preference when fairness is equal', () => {
    const pick: Rule = {
      id: 'pref',
      evaluate: ({ employee }) => (employee.id === 'e2' ? { score: 10, reason: 'fairness' } : { score: 2, reason: 'fairness' }),
    };
    const data = makeData(3);
    const { assignments } = generate({ data, range: { from: sh('2026-12-01'), to: sh('2026-12-01') }, startAt, rules: [...defaultRules, pick] });
    expect(assignments['2026-12-01:day']?.employeeId).toBe('e2');
  });
});
