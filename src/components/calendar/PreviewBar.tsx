import type { Employee } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import type { Unfilled } from '../../schedule/generator';
import { ShiftField } from '../ShiftField';
import { ConflictsTable } from './ConflictsTable';
import { ShiftCountsLegend } from './ShiftCountsLegend';
import { useState } from 'react';
import { compareShifts, type Shift } from '../../schedule/shift';
import type { Conflict } from '../../schedule/conflicts';

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
  /** Conflicts left in the previewed schedule. */
  conflicts: Conflict[];
  /** What the preview was made with, to tweak and run again. */
  startAt: Shift;
  /** Earliest allowed start (tomorrow) and whether the pairing allows generating. */
  minStart: Shift;
  canRegenerate: boolean;
  today: string;
  /** Runs the preview again from the saved schedule with other options. */
  onRegenerate(startAt: Shift): void;
  onApply(): void;
  onDiscard(): void;
}

/** Sticky bar shown while a regenerate preview is displayed. Nothing is saved until Apply. */
export function PreviewBar({ employees, months, changed, unfilled, conflicts, startAt, minStart, canRegenerate, today, onRegenerate, onApply, onDiscard }: PreviewBarProps) {
  const t = useT();
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const [start, setStart] = useState<Shift | undefined>(startAt);
  const validStart = start !== undefined && compareShifts(start, minStart) >= 0;
  const employeesById = new Map(employees.map((e) => [e.id, e]));
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
        <span>{`${t.conflicts.button}: ${conflicts.length}`}</span>
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
          <h3>{t.calendar.previewOptions}</h3>
          <form
            className="form preview__options"
            onSubmit={(e) => {
              e.preventDefault();
              if (start && validStart && canRegenerate) onRegenerate(start);
            }}
          >
            <ShiftField label={t.calendar.regenerateStart} value={start} onChange={setStart} minDate={minStart.date} />
            <div className="form__actions">
              <button type="submit" className="button button--primary" disabled={!validStart || !canRegenerate}>
                {t.calendar.previewRegenerate}
              </button>
            </div>
          </form>
          <h3>{t.calendar.previewConflicts}</h3>
          <ConflictsTable conflicts={conflicts} employees={employeesById} today={today} />
          <h3>{t.calendar.previewTotals}</h3>
          <p className="preview__legend-line">
            <ShiftCountsLegend />
          </p>
          <div className="preview__table-wrap">
            <table className="table preview__table">
              <thead>
                <tr>
                  <th scope="col" className="preview__month">
                    {t.calendar.previewMonth}
                  </th>
                  {employees.map((e) => (
                    <th key={e.id} scope="col" className="num">
                      {e.name}
                    </th>
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
                        <td key={e.id} className="num" title={`${t.calendar.previewTotal} (${t.calendar.day}/${t.calendar.night})`}>
                          <strong>{c.day + c.night}</strong>
                          {` (${c.day}/${c.night})`}
                        </td>
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
                    {`${dateOf(u.shift.date)} ${u.shift.part === 'day' ? t.calendar.day : t.calendar.night}: ${u.reasons.map((r) => t.reasons[r]).join(', ')} (${u.missing})`}
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
