import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { dataSchema } from '../src/data/schema';
import { buildCalendarPdf, type FontBytes } from '../src/export/calendarPdf';
import { labels } from '../src/i18n/labels';

const file = (name: string) => new Uint8Array(readFileSync(`node_modules/@fontsource/open-sans/files/open-sans-${name}-normal.woff`));
const fonts: FontBytes = {
  latinRegular: file('latin-400'),
  latinExtRegular: file('latin-ext-400'),
  latinBold: file('latin-700'),
  latinExtBold: file('latin-ext-700'),
};

describe('calendar PDF', () => {
  const data = dataSchema.parse({
    employees: [
      { id: 'a', name: 'Černá Řehoř', partnerId: 'b' },
      { id: 'b', name: 'Máca H.', partnerId: 'a' },
    ],
    assignments: {
      '2026-11-16:day': [{ employeeId: 'a', source: 'manual' }, { employeeId: 'b', source: 'auto' }],
      '2026-12-03:night': [{ employeeId: 'a', source: 'auto' }],
    },
    company: { closedPeriods: [{ id: 'c', from: { date: '2026-12-24', part: 'day' }, to: { date: '2026-12-26', part: 'night' } }] },
  });

  it('makes one landscape A4 page per month', async () => {
    const bytes = await buildCalendarPdf(
      { months: [{ year: 2026, month: 10 }, { year: 2026, month: 11 }, { year: 2027, month: 0 }], data, locale: 'cs', labels: labels.cs, today: new Date(2026, 10, 14) },
      fonts,
    );
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
    for (const page of doc.getPages()) {
      const { width, height } = page.getSize();
      expect(width).toBeGreaterThan(height); // landscape
      expect(width).toBeCloseTo(841.89, 1); // A4
      expect(height).toBeCloseTo(595.28, 1);
    }
  });

  it('works in English and with no assignments', async () => {
    const empty = dataSchema.parse({ employees: [{ id: 'a', name: 'A' }] });
    const bytes = await buildCalendarPdf({ months: [{ year: 2026, month: 10 }], data: empty, locale: 'en', labels: labels.en, today: new Date(2026, 10, 14) }, fonts);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});
