import { describe, expect, it } from 'vitest';
import { dataSchema, type Employee } from '../src/data/schema';
import { href, parseHash, routePermissions } from '../src/router';
import { collectTimeOff, isPastTimeOff, removeTimeOff, upsertTimeOff } from '../src/schedule/timeOff';
import type { Shift } from '../src/schedule/shift';

const sh = (date: string, part: 'day' | 'night' = 'day'): Shift => ({ date, part });
const vac = (id: string, from: Shift, to: Shift, compensate = true) => ({ id, from, to, compensate });

function employees(): Employee[] {
  return dataSchema.parse({
    employees: [
      { id: 'a', name: 'Anna', vacations: [vac('v1', sh('2026-12-10'), sh('2026-12-12', 'night')), vac('v2', sh('2026-11-01'), sh('2026-11-05', 'night'))] },
      { id: 'b', name: 'Bára', vacations: [vac('v3', sh('2026-11-01'), sh('2026-11-03', 'night')), vac('v4', sh('2026-11-01'), sh('2026-11-05', 'night'))] },
      { id: 'c', name: 'Cyril' },
    ],
  }).employees;
}

describe('collectTimeOff', () => {
  it('lists all time off of all employees ordered by start, end, then employee', () => {
    const rows = collectTimeOff(employees());
    expect(rows.map((r) => `${r.employee.name}:${r.vacation.id}`)).toEqual(['Bára:v3', 'Anna:v2', 'Bára:v4', 'Anna:v1']);
  });

  it('orders the day shift of a date before its night shift', () => {
    const list = dataSchema.parse({
      employees: [{ id: 'a', name: 'A', vacations: [vac('n', sh('2026-12-01', 'night'), sh('2026-12-02')), vac('d', sh('2026-12-01'), sh('2026-12-02'))] }],
    }).employees;
    expect(collectTimeOff(list).map((r) => r.vacation.id)).toEqual(['d', 'n']);
  });
});

describe('isPastTimeOff', () => {
  const v = vac('v', sh('2026-11-01'), sh('2026-11-05', 'night'));
  it('is past only after the last day', () => {
    expect(isPastTimeOff(v, '2026-11-05')).toBe(false); // still its last day
    expect(isPastTimeOff(v, '2026-11-06')).toBe(true);
    expect(isPastTimeOff(v, '2026-10-30')).toBe(false);
  });
});

describe('changing time off', () => {
  it('adds a new one and replaces one with the same id', () => {
    const added = upsertTimeOff(employees(), 'c', vac('new', sh('2027-01-01'), sh('2027-01-02')));
    expect(added.find((e) => e.id === 'c')?.vacations.map((v) => v.id)).toEqual(['new']);
    const edited = upsertTimeOff(added, 'c', vac('new', sh('2027-01-01'), sh('2027-01-09'), false));
    expect(edited.find((e) => e.id === 'c')?.vacations).toEqual([vac('new', sh('2027-01-01'), sh('2027-01-09'), false)]);
  });

  it('moves it to another employee when the employee changes', () => {
    const moved = upsertTimeOff(employees(), 'c', vac('v1', sh('2026-12-10'), sh('2026-12-12', 'night')), 'a');
    expect(moved.find((e) => e.id === 'a')?.vacations.map((v) => v.id)).toEqual(['v2']);
    expect(moved.find((e) => e.id === 'c')?.vacations.map((v) => v.id)).toEqual(['v1']);
  });

  it('removes one and leaves the rest', () => {
    const next = removeTimeOff(employees(), 'a', 'v1');
    expect(next.find((e) => e.id === 'a')?.vacations.map((v) => v.id)).toEqual(['v2']);
    expect(next.find((e) => e.id === 'b')?.vacations).toHaveLength(2);
  });
});

describe('time off route', () => {
  it('has its own page, viewable like the employee list', () => {
    expect(parseHash('#/time-off')).toEqual({ name: 'timeOff' });
    expect(href({ name: 'timeOff' })).toBe('#/time-off');
    expect(routePermissions.timeOff).toBe('employees:view');
  });
});
