import { useMemo, useState } from 'react';
import { useLocale, useT } from '../i18n/I18nProvider';
import { isPastTimeOff, type TimeOffRow } from '../schedule/timeOff';
import type { Shift } from '../schedule/shift';
import { RowActionsMenu } from './RowActionsMenu';

interface TimeOffTableProps {
  /** Already ordered by date (see collectTimeOff). */
  rows: TimeOffRow[];
  /** Adds the "Employee" column (the table of all time off). */
  showEmployee: boolean;
  /** ISO date of today: time off that ended before it is hidden unless asked for. */
  today: string;
  canEdit: boolean;
  onAdd(): void;
  onEdit(row: TimeOffRow): void;
  onDelete(row: TimeOffRow): void;
}

/** Time off in a table with row actions and an add button. Past time off is hidden by default. */
export function TimeOffTable({ rows, showEmployee, today, canEdit, onAdd, onEdit, onDelete }: TimeOffTableProps) {
  const t = useT();
  const locale = useLocale();
  const [showPast, setShowPast] = useState(false);
  const fmt = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }), [locale]);

  const formatShift = (shift: Shift) => {
    const [y, m, d] = shift.date.split('-').map(Number) as [number, number, number];
    return `${fmt.format(new Date(y, m - 1, d))} · ${shift.part === 'day' ? t.calendar.day : t.calendar.night}`;
  };
  const visible = showPast ? rows : rows.filter((r) => !isPastTimeOff(r.vacation, today));

  return (
    <div className="time-off">
      <div className="time-off__toolbar">
        <label className="check">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} />
          <span>{t.timeOff.showPast}</span>
        </label>
        {canEdit && (
          <button type="button" className="button button--primary" onClick={onAdd}>
            {t.timeOff.add}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <p>{rows.length === 0 ? t.timeOff.empty : t.timeOff.allPast}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                {showEmployee && <th scope="col">{t.timeOff.employee}</th>}
                <th scope="col">{t.timeOff.from}</th>
                <th scope="col">{t.timeOff.to}</th>
                <th scope="col">{t.timeOff.compensate}</th>
                {canEdit && (
                  <th scope="col" className="table__actions">
                    <span className="sr-only">{t.common.actions}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={`${row.employee.id}:${row.vacation.id}`}>
                  {showEmployee && <td>{row.employee.name}</td>}
                  <td>{formatShift(row.vacation.from)}</td>
                  <td>{formatShift(row.vacation.to)}</td>
                  <td>{row.vacation.compensate ? t.timeOff.compensateYes : t.timeOff.compensateNo}</td>
                  {canEdit && (
                    <td className="table__actions">
                      <RowActionsMenu
                        actions={[
                          { key: 'edit', icon: 'edit', label: t.common.edit, onSelect: () => onEdit(row) },
                          { key: 'delete', icon: 'delete', label: t.common.delete, danger: true, onSelect: () => onDelete(row) },
                        ]}
                      />
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
