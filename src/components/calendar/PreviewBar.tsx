import type { Employee } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import type { Unfilled } from '../../schedule/generator';

export interface ShiftCounts {
  day: number;
  night: number;
}

interface PreviewBarProps {
  employees: Employee[];
  /** Calendar months in order, with their label and day/night shifts per employee. */
  months: { key: string; label: string; counts: Record<string, ShiftCounts> }[];
  changed: number;
  unfilled: Unfilled[];
  onApply(): void;
  onDiscard(): void;
}

/** Sticky bar shown while a regenerate preview is displayed. Nothing is saved until Apply. */
export function PreviewBar({ employees, months, changed, unfilled, onApply, onDiscard }: PreviewBarProps) {
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
                  <th scope="col" rowSpan={2} className="preview__month">
                    {t.calendar.previewMonth}
                  </th>
                  {employees.map((e) => (
                    <th key={e.id} scope="colgroup" colSpan={3} className="group" title={`${e.firstName} ${e.lastName}`}>
                      {e.lastName}
                    </th>
                  ))}
                </tr>
                <tr>
                  {employees.map((e) => (
                    <SubHeaders key={e.id} />
                  ))}
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.key}>
                    <th scope="row" className="preview__month">
                      {m.label}
                    </th>
                    {employees.map((e) => {
                      const c = m.counts[e.id] ?? { day: 0, night: 0 };
                      return (
                        <EmployeeCells key={e.id} day={c.day} night={c.night} />
                      );
                    })}
                  </tr>
                ))}
              </tbody>
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

function SubHeaders() {
  const t = useT();
  return (
    <>
      <th scope="col" className="num sub">
        {t.calendar.day}
      </th>
      <th scope="col" className="num sub">
        {t.calendar.night}
      </th>
      <th scope="col" className="num sub sub--total">
        {t.calendar.previewTotal}
      </th>
    </>
  );
}

function EmployeeCells({ day, night }: ShiftCounts) {
  return (
    <>
      <td className="num">{day}</td>
      <td className="num">{night}</td>
      <td className="num num--total">{day + night}</td>
    </>
  );
}
