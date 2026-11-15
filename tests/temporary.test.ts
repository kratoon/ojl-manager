import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { dataSchema, TEMPORARY_ID } from '../src/data/schema';
import { buildCalendarPdf } from '../src/export/calendarPdf';
import { labels } from '../src/i18n/labels';
import { generate } from '../src/schedule/generator';
import { clearShift, isMonthLocked, setMonthLock, type Assignments } from '../src/schedule/locks';
import { shiftKey, shiftsBetween, type Shift } from '../src/schedule/shift';

const sh = (date: string, part: 'day' | 'night' = 'day'): Shift => ({ date, part });
const temp = { employeeId: TEMPORARY_ID, source: 'manual' as const };

const team = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ id: `e${i + 1}`, name: `Employee ${i + 1}`, partnerId: `e${i % 2 === 0 ? i + 2 : i}` }));

describe('temporary worker in the data', () => {
  it('may take several seats of one shift, unlike an employee', () => {
    expect(dataSchema.safeParse({ assignments: { '2026-12-01:day': [temp, temp] } }).success).toBe(true);
    const twice = [{ employeeId: 'a', source: 'manual' }, { employeeId: 'a', source: 'manual' }];
    expect(dataSchema.safeParse({ assignments: { '2026-12-01:day': twice } }).success).toBe(false);
  });

  it('is always locked and cannot be an employee id', () => {
    expect(dataSchema.safeParse({ assignments: { '2026-12-01:day': [{ employeeId: TEMPORARY_ID, source: 'auto' }] } }).success).toBe(false);
    expect(dataSchema.safeParse({ employees: [{ id: TEMPORARY_ID, name: 'X' }] }).success).toBe(false);
  });
});

describe('temporary worker and the generator', () => {
  const range = { from: sh('2026-11-02'), to: sh('2026-12-27', 'night') };
  const withTemp = (assignments: Assignments) => dataSchema.parse({ employees: team(8), assignments, company: {} });

  it('keeps it on regenerate, counts the seat as taken and fills only the other seat', () => {
    const data = withTemp({ '2026-11-10:day': [temp], '2026-11-10:night': [temp, temp] });
    const { assignments, unfilled } = generate({ data, range, startAt: range.from });
    expect(unfilled).toEqual([]);
    const day = assignments['2026-11-10:day'] ?? [];
    expect(day).toHaveLength(2);
    expect(day.filter((a) => a.employeeId === TEMPORARY_ID)).toEqual([temp]);
    expect(day.find((a) => a.employeeId !== TEMPORARY_ID)?.source).toBe('auto');
    // Two temporary workers fill the whole shift: nobody else is added.
    expect(assignments['2026-11-10:night']).toEqual([temp, temp]);
  });

  it('is not an employee: nobody is blamed or credited, and the rest of the rotation is unchanged', () => {
    const plain = generate({ data: withTemp({}), range, startAt: range.from }).assignments;
    const data = withTemp({ '2026-11-10:day': [temp] });
    const { assignments } = generate({ data, range, startAt: range.from });
    for (const s of shiftsBetween(sh('2026-11-12'), sh('2026-11-20', 'night'))) {
      expect(assignments[shiftKey(s)], shiftKey(s)).toEqual(plain[shiftKey(s)]);
    }
  });

  it('never appears as an automatic assignment', () => {
    const { assignments } = generate({ data: withTemp({}), range, startAt: range.from });
    expect(Object.values(assignments).flat().some((a) => a.employeeId === TEMPORARY_ID)).toBe(false);
  });
});

describe('temporary worker and locks', () => {
  const base = (): Assignments => ({
    '2026-12-01:day': [temp, { employeeId: 'a', source: 'manual' }],
    '2026-12-02:day': [{ employeeId: 'b', source: 'auto' }],
  });

  it('stays locked when the month is unlocked', () => {
    const next = setMonthLock(base(), '2026-12', false);
    expect(next['2026-12-01:day']).toEqual([temp, { employeeId: 'a', source: 'auto' }]);
  });

  it('counts as locked and is removed by clearing the shift', () => {
    expect(isMonthLocked({ '2026-12-01:day': [temp] }, '2026-12')).toBe(true);
    expect('2026-12-01:day' in clearShift(base(), '2026-12-01:day')).toBe(false);
  });
});

describe('temporary worker in the PDF', () => {
  it('renders without totals for it', async () => {
    const file = (n: string) => new Uint8Array(readFileSync(`node_modules/@fontsource/open-sans/files/open-sans-${n}-normal.woff`));
    const data = dataSchema.parse({ employees: [{ id: 'a', name: 'A' }], assignments: { '2026-12-01:day': [temp, { employeeId: 'a', source: 'manual' }] } });
    const bytes = await buildCalendarPdf(
      { months: [{ year: 2026, month: 11 }], data, locale: 'cs', labels: labels.cs, today: new Date(2026, 10, 14) },
      { latinRegular: file('latin-400'), latinExtRegular: file('latin-ext-400'), latinBold: file('latin-700'), latinExtBold: file('latin-ext-700') },
    );
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
