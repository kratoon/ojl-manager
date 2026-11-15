import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PreviewBar } from '../src/components/calendar/PreviewBar';
import { dataSchema } from '../src/data/schema';
import { I18nProvider } from '../src/i18n/I18nProvider';
import type { Conflict } from '../src/schedule/conflicts';

const employees = dataSchema.parse({ employees: [{ id: 'a', name: 'Anna' }, { id: 'b', name: 'Bára' }] }).employees;
const saved: Conflict[] = [
  { shift: { date: '2099-12-07', part: 'day' }, employeeId: 'a', reasons: ['vacation'], source: 'manual' },
  { shift: { date: '2099-12-08', part: 'night' }, employeeId: 'b', reasons: ['vacation'], source: 'auto' },
];

const render = (conflicts: Conflict[]) =>
  renderToString(
    <I18nProvider>
      <PreviewBar
        employees={employees}
        months={[]}
        changed={1}
        unfilled={[]}
        conflicts={conflicts}
        savedConflicts={saved}
        options={{ startAt: { date: '2026-11-16', part: 'day' }, replaceConflicting: true }}
        minStart={{ date: '2026-11-16', part: 'day' }}
        canRegenerate
        today="2026-11-15"
        onRegenerate={() => {}}
        onApply={() => {}}
        onDiscard={() => {}}
      />
    </I18nProvider>,
  );

describe('preview bar', () => {
  it('shows the conflicts left in the preview, and the regenerate options', () => {
    const html = render(saved);
    expect(html).toContain('Konflikty: 2');
    expect(html).toContain('Konflikty v náhledu');
    expect(html).toContain('Přegenerovat náhled');
    expect(html).toContain('Anna');
    expect(html).toContain('Bára');
    // One locked conflict from the start on: that is the number next to the option.
    expect(html).toContain('Nahradit i zamčené směny, které porušují pravidla (1)');
  });

  it('says so when nothing is left', () => {
    const html = render([]);
    expect(html).toContain('Konflikty: 0');
    expect(html).toContain('V kalendáři nejsou žádné konflikty.');
  });
});
