import type { Employee } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import type { Unfilled } from '../../schedule/generator';

interface PreviewBarProps {
  employees: Employee[];
  /** Calendar months in order, with their label and shifts per employee. */
  months: { key: string; label: string; counts: Record<string, number> }[];
  changed: number;
  unfilled: Unfilled[];
  totals: Record<string, number>;
  onApply(): void;
  onDiscard(): void;
}

/** Sticky bar shown while a regenerate preview is displayed. Nothing is saved until Apply. */
export function PreviewBar({ employees, months, changed, unfilled, totals, onApply, onDiscard }: PreviewBarProps) {
  const t = useT();
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const dateOf = (date: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    return fmt.format(new Date(y, m - 1, d));
  };

  return (
    <aside className="preview" aria-label={t.calendar.previewTitle}>
      <div className="preview__summary">
        <strong>{t.calendar.previewTitle}</strong>
        <span>{`${t.calendar.previewChanged}: ${changed}`}</span>
        <span>{`${t.calendar.previewUnfilled}: ${unfilled.length}`}</span>
        <span className="preview__actions">
          <button type="button" className="button" onClick={onDiscard}>
            {t.calendar.previewDiscard}
          </button>
          <button type="button" className="button button--primary" onClick={onApply}>
            {t.calendar.previewApply}
          </button>
        </span>
      </div>
      <details>
        <summary>{t.calendar.previewDetails}</summary>
        <div className="preview__details">
          <h3>{t.calendar.previewTotals}</h3>
          <div className="preview__table-wrap">
            <table className="table preview__table">
              <thead>
                <tr>
                  <th scope="col">{t.calendar.previewMonth}</th>
                  {employees.map((e) => (
                    <th key={e.id} scope="col" className="num" title={`${e.firstName} ${e.lastName}`}>
                      {e.lastName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <th scope="row">{m.label}</th>
                    {employees.map((e) => (
                      <td key={e.id} className="num">
                        {m.counts[e.id] ?? 0}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{t.calendar.previewTotal}</th>
                  {employees.map((e) => (
                    <td key={e.id} className="num">
                      {totals[e.id] ?? 0}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          {unfilled.length > 0 && (
            <>
              <h3>{t.calendar.previewUnfilledList}</h3>
              <ul>
                {unfilled.slice(0, 50).map((u) => (
                  <li key={`${u.shift.date}:${u.shift.part}`}>
                    {`${dateOf(u.shift.date)} ${u.shift.part === 'day' ? t.calendar.day : t.calendar.night}: ${u.reasons.map((r) => t.reasons[r]).join(', ')}`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>
    </aside>
  );
}
