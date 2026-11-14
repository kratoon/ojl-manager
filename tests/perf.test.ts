import { describe, expect, it } from 'vitest';
import { dataSchema } from '../src/data/schema';
import { generate } from '../src/schedule/generator';

describe('generate (full calendar)', () => {
  it('handles 8 employees over ~25 months quickly', () => {
    const employees = Array.from({ length: 8 }, (_, i) => ({ id: `e${i}`, name: `Employee ${i}` }));
    const data = dataSchema.parse({ employees });
    const t = performance.now();
    const { assignments, unfilled } = generate({
      data,
      range: { from: { date: '2026-11-01', part: 'day' }, to: { date: '2028-11-30', part: 'night' } },
      startAt: { date: '2026-11-15', part: 'day' },
    });
    expect(performance.now() - t).toBeLessThan(3000);
    expect(unfilled).toEqual([]);
    expect(Object.keys(assignments).length).toBeGreaterThan(1400);
  });
});
