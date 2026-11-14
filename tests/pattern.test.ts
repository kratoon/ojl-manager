import { describe, expect, it } from 'vitest';
import { dataSchema, type Data, type Employee } from '../src/data/schema';
import { generate } from '../src/schedule/generator';
import { blockNumber, buildPattern, pairingProblems, patternWorks, setPartner } from '../src/schedule/pattern';
import { shiftKey, shiftsBetween, type Shift } from '../src/schedule/shift';

const anchor = '2026-11-02'; // a Monday: block 0 starts here
const sh = (date: string, part: 'day' | 'night' = 'day'): Shift => ({ date, part });

describe('blockNumber', () => {
  it('counts MON+TUE, WED+THU and FRI+SAT+SUN as consecutive blocks', () => {
    const blocks = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08', '2026-11-09'];
    expect(blocks.map((d) => blockNumber(d, anchor))).toEqual([0, 0, 1, 1, 2, 2, 2, 3]);
  });

  it('continues backwards before the anchor', () => {
    expect(blockNumber('2026-11-01', anchor)).toBe(-1); // Sunday of the previous week
    expect(blockNumber('2026-10-30', anchor)).toBe(-1); // its Friday
    expect(blockNumber('2026-10-29', anchor)).toBe(-2); // WED+THU of the previous week
  });
});

describe('patternWorks', () => {
  // Day and night worker of each block, positions 0 to 3 = pairs A to D (ADR-a1cb97d table).
  const table: [string, number, number][] = [
    ['2026-11-02', 0, 2], ['2026-11-03', 0, 2], // block 0: A day, C night
    ['2026-11-04', 1, 3], ['2026-11-05', 1, 3], // block 1: B day, D night
    ['2026-11-06', 2, 0], ['2026-11-08', 2, 0], // block 2: C day, A night
    ['2026-11-09', 3, 1], ['2026-11-10', 3, 1], // block 3: D day, B night
    ['2026-11-11', 0, 2], // block 4: A day, C night
    ['2026-11-13', 1, 3], // block 5: B day, D night
  ];

  it.each(table)('%s: day pair %i, night pair %i', (date, dayPair, nightPair) => {
    for (let p = 0; p < 4; p++) {
      expect(patternWorks(p, sh(date, 'day'), anchor), `pair ${p} day`).toBe(p === dayPair);
      expect(patternWorks(p, sh(date, 'night'), anchor), `pair ${p} night`).toBe(p === nightPair);
    }
  });

  const fortnight = shiftsBetween(sh('2026-11-02'), sh('2026-12-13', 'night')); // 6 weeks

  it('puts exactly one pair on every shift', () => {
    for (const shift of fortnight) {
      const on = [0, 1, 2, 3].filter((p) => patternWorks(p, shift, anchor));
      expect(on, shiftKey(shift)).toHaveLength(1);
    }
  });

  it('gives each pair 7 shifts per 14 days, never two shifts back to back', () => {
    for (let p = 0; p < 4; p++) {
      const worked = fortnight.filter((s) => patternWorks(p, s, anchor));
      expect(worked.length).toBe(21); // 3 fortnights * 7
      const indexes = worked.map((s) => fortnight.findIndex((f) => shiftKey(f) === shiftKey(s)));
      for (let i = 1; i < indexes.length; i++) expect(indexes[i]! - indexes[i - 1]!).toBeGreaterThan(1);
    }
  });

  it('alternates day and night on the blocks a pair works', () => {
    const kinds: string[] = [];
    let lastBlock = -999;
    for (const s of fortnight) {
      if (!patternWorks(0, s, anchor)) continue;
      const block = blockNumber(s.date, anchor);
      if (block !== lastBlock) kinds.push(s.part);
      lastBlock = block;
    }
    expect(kinds.slice(0, 6)).toEqual(['day', 'night', 'day', 'night', 'day', 'night']);
  });
});

function team(n: number, paired = true): Employee[] {
  const employees = Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, name: `Employee ${i + 1}` })) as unknown as Employee[];
  if (!paired) return employees;
  let list = employees;
  for (let i = 0; i + 1 < n; i += 2) list = setPartner(list, `e${i + 1}`, `e${i + 2}`);
  return list;
}

describe('pairing', () => {
  it('keeps pairs mutual and releases old partners', () => {
    let list = team(4, false);
    list = setPartner(list, 'e1', 'e2');
    expect(list.map((e) => e.partnerId)).toEqual(['e2', 'e1', undefined, undefined]);
    list = setPartner(list, 'e1', 'e3'); // e1 moves to e3: e2 becomes free
    expect(list.map((e) => e.partnerId)).toEqual(['e3', undefined, 'e1', undefined]);
    list = setPartner(list, 'e1', undefined);
    expect(list.map((e) => e.partnerId)).toEqual([undefined, undefined, undefined, undefined]);
  });

  it('allows generating when everybody is paired, or one is left over with an odd headcount', () => {
    expect(pairingProblems(team(8)).ok).toBe(true);
    expect(pairingProblems(team(7)).ok).toBe(true);
    expect(pairingProblems(team(7)).unpaired.map((e) => e.id)).toEqual(['e7']);
    expect(pairingProblems(team(6, false)).ok).toBe(false);
    const eightWithTwoFree = team(8);
    const broken = setPartner(setPartner(eightWithTwoFree, 'e1', undefined), 'e3', undefined);
    expect(pairingProblems(broken).ok).toBe(false);
  });

  it('ignores a one-sided partner reference', () => {
    const list = team(4, false).map((e) => (e.id === 'e1' ? { ...e, partnerId: 'e2' } : e));
    expect(pairingProblems(list).unpaired).toHaveLength(4);
  });

  it('orders pairs by name, independent of input order', () => {
    const a = buildPattern(team(8), anchor);
    const b = buildPattern([...team(8)].reverse(), anchor);
    expect([...a.positions.entries()].sort()).toEqual([...b.positions.entries()].sort());
    expect(a.positions.get('e1')).toBe(0);
    expect(a.positions.get('e2')).toBe(0);
    expect(a.positions.get('e7')).toBe(3);
  });
});

function dataFor(employees: Employee[], patch: (d: Record<string, unknown>) => void = () => {}): Data {
  const raw: Record<string, unknown> = { employees, company: {} };
  patch(raw);
  return dataSchema.parse(raw);
}

const range = { from: sh('2026-11-02'), to: sh('2026-11-29', 'night') }; // 4 weeks from the anchor

describe('generate with two seats and the pattern', () => {
  it('reproduces the pattern exactly for 8 paired employees', () => {
    const data = dataFor(team(8));
    const { assignments, unfilled } = generate({ data, range, startAt: range.from });
    expect(unfilled).toEqual([]);
    const pairOf = (p: number) => [`e${2 * p + 1}`, `e${2 * p + 2}`];
    for (const shift of shiftsBetween(range.from, range.to)) {
      const position = [0, 1, 2, 3].find((p) => patternWorks(p, shift, anchor)) as number;
      const ids = (assignments[shiftKey(shift)] ?? []).map((a) => a.employeeId).sort();
      expect(ids, shiftKey(shift)).toEqual(pairOf(position));
    }
  });

  it('gives every employee the same number of shifts', () => {
    const data = dataFor(team(8));
    const { assignments } = generate({ data, range, startAt: range.from });
    const counts: Record<string, number> = {};
    for (const a of Object.values(assignments).flat()) counts[a.employeeId] = (counts[a.employeeId] ?? 0) + 1;
    expect(new Set(Object.values(counts)).size).toBe(1);
    expect(Object.values(counts)[0]).toBe(14); // 7 per fortnight
  });

  it('breaks the pattern for a vacation and fills the free seat', () => {
    const employees = team(8).map((e) =>
      e.id === 'e1' ? { ...e, vacations: [{ id: 'v', from: sh('2026-11-02'), to: sh('2026-11-03', 'night'), compensate: true }] } : e,
    );
    const { assignments, unfilled } = generate({ data: dataFor(employees), range, startAt: range.from });
    expect(unfilled).toEqual([]);
    const ids = (assignments['2026-11-02:day'] ?? []).map((a) => a.employeeId);
    expect(ids).toHaveLength(2);
    expect(ids).toContain('e2'); // the partner still works
    expect(ids).not.toContain('e1');
    // The pair is back on pattern afterwards.
    expect((assignments['2026-11-06:night'] ?? []).map((a) => a.employeeId).sort()).toEqual(['e1', 'e2']);
  });

  it('works with 7 employees, one without a pair', () => {
    const { assignments, unfilled } = generate({ data: dataFor(team(7)), range, startAt: range.from });
    expect(unfilled).toEqual([]);
    for (const shift of shiftsBetween(range.from, range.to)) {
      const list = assignments[shiftKey(shift)] ?? [];
      expect(list, shiftKey(shift)).toHaveLength(2);
      expect(new Set(list.map((a) => a.employeeId)).size).toBe(2);
    }
  });

  it('keeps a locked seat and fills only the other one', () => {
    const data = dataFor(team(8), (d) => (d.assignments = { '2026-11-02:day': [{ employeeId: 'e8', source: 'manual' }] }));
    const { assignments } = generate({ data, range, startAt: range.from });
    const list = assignments['2026-11-02:day'] ?? [];
    expect(list).toHaveLength(2);
    expect(list.find((a) => a.employeeId === 'e8')).toEqual({ employeeId: 'e8', source: 'manual' });
  });

  it('is deterministic regardless of the order of the employees', () => {
    const employees = team(8);
    const a = generate({ data: dataFor(employees), range, startAt: range.from });
    const b = generate({ data: dataFor([...employees].reverse()), range, startAt: range.from });
    expect(b).toEqual(a);
  });

  it('migrates a single assignment from an older file to a list', () => {
    const data = dataSchema.parse({ employees: [], assignments: { '2026-11-02:day': { employeeId: 'e1', source: 'manual' } } });
    expect(data.assignments['2026-11-02:day']).toEqual([{ employeeId: 'e1', source: 'manual' }]);
    expect(data.company.seatsPerShift).toBe(2);
  });

  it('rejects the same employee on both seats of a shift', () => {
    const two = [{ employeeId: 'e1', source: 'manual' }, { employeeId: 'e1', source: 'auto' }];
    expect(dataSchema.safeParse({ assignments: { '2026-11-02:day': two } }).success).toBe(false);
  });

  it('only accepts a Monday as the anchor', () => {
    expect(dataSchema.safeParse({ company: { pattern: { anchor: '2026-11-03' } } }).success).toBe(false);
    expect(dataSchema.safeParse({ company: { pattern: { anchor: '2026-11-02' } } }).success).toBe(true);
  });
});
