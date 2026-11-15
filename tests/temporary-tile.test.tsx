import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ShiftTile } from '../src/components/calendar/ShiftTile';
import { TEMPORARY_ID } from '../src/data/schema';
import { I18nProvider } from '../src/i18n/I18nProvider';

describe('temporary worker on a calendar tile', () => {
  const html = renderToString(
    <I18nProvider>
      <ShiftTile
        part="day"
        seats={2}
        closed={false}
        changed={false}
        entries={[
          { assignment: { employeeId: TEMPORARY_ID, source: 'manual' }, employee: undefined, warnings: [] },
          { assignment: { employeeId: 'a', source: 'manual' }, employee: { id: 'a', name: 'Hanka', vacations: [], allowMixedPair: false }, warnings: [] },
        ]}
      />
    </I18nProvider>,
  );

  it('shows the label in italics, and only for the temporary worker', () => {
    expect(html).toContain('slot__name slot__name--temporary');
    expect(html).toContain('Záskok');
    expect(html.match(/slot__name--temporary/g)).toHaveLength(1);
  });
});
