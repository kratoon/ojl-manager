import { useMemo, useState } from 'react';
import type { Employee } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import type { Conflict } from '../../schedule/conflicts';
import type { Shift } from '../../schedule/shift';
import { LockIcon } from './icons';

interface ConflictsTableProps {
  /** In date order (see findConflicts). */
  conflicts: Conflict[];
  employees: Map<string, Employee>;
  /** ISO date of today: conflicts before it are hidden unless asked for. */
  today: string;
  /** Opens the shift to fix it. Missing when it cannot be edited (no permission, or a preview). */
  onOpenShift?(shift: Shift): void;
}

/** The conflicts as a table with a switch for past ones: used by the conflicts dialog and the preview. */
export function ConflictsTable({ conflicts, employees, today, onOpenShift }: ConflictsTableProps) {
  const t = useT();
  const locale = useLocale();
  const [showPast, setShowPast] = useState(false);
  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'full' }), [locale]);
  const visible = showPast ? conflicts : conflicts.filter((c) => c.shift.date >= today);
  const dateOf = (date: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    return fmt.format(new Date(y, m - 1, d));
  };

  return (
    <div className="conflicts">
      <label className="check">
        <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
        <span>{t.conflicts.showPast}</span>
      </label>
      {visible.length === 0 ? (
        <p role="status">{conflicts.length === 0 ? t.conflicts.none : t.conflicts.allPast}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t.conflicts.date}</th>
                <th scope="col">{t.conflicts.shift}</th>
                <th scope="col">{t.conflicts.employee}</th>
                <th scope="col">{t.conflicts.reason}</th>
                <th scope="col">{t.conflicts.state}</th>
                {onOpenShift && (
                  <th scope="col" className="table__actions">
                    <span className="sr-only">{t.common.actions}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={`${c.shift.date}:${c.shift.part}|${c.employeeId}`}>
                  <td>{dateOf(c.shift.date)}</td>
                  <td>{c.shift.part === 'day' ? t.calendar.day : t.calendar.night}</td>
                  <td>{employees.get(c.employeeId)?.name ?? c.employeeId}</td>
                  <td>{c.reasons.map((r) => t.reasons[r]).join(', ')}</td>
                  <td>
                    {c.source === 'manual' ? (
                      <span className="conflict__locked" title={t.calendar.locked}>
                        <LockIcon size={14} /> {t.conflicts.locked}
                      </span>
                    ) : (
                      t.conflicts.auto
                    )}
                  </td>
                  {onOpenShift && (
                    <td className="table__actions">
                      <button type="button" className="button" onClick={() => onOpenShift(c.shift)}>
                        {t.conflicts.open}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
