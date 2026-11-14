import { useEffect, useMemo, useRef, useState } from 'react';
import { calendarMonths, calendarRange, tomorrowDay } from '../calendar/range';
import { isSameDay, monthGrid } from '../calendar/dates';
import { PreviewBar, type ShiftCounts } from '../components/calendar/PreviewBar';
import { RegenerateDialog } from '../components/calendar/RegenerateDialog';
import { ShiftDialog } from '../components/calendar/ShiftDialog';
import { ShiftTile } from '../components/calendar/ShiftTile';
import { useData } from '../data/DataProvider';
import type { Assignment, Data, Employee } from '../data/schema';
import { useLocale, useT } from '../i18n/I18nProvider';
import { usePermissions } from '../permissions/PermissionsProvider';
import { compareEmployees, generate, type GenerateResult } from '../schedule/generator';
import { brokenRules, companyClosedReason, type ReasonCode } from '../schedule/rules';
import { compareShifts, shiftKey, toIsoDate, type DayPart, type Shift } from '../schedule/shift';

// 2024-01-01 is a Monday: used only to ask Intl for localized weekday names.
const mondayReference = (offset: number) => new Date(2024, 0, 1 + offset);

interface Preview {
  result: GenerateResult;
  changed: Set<string>;
}

export function CalendarPage() {
  const t = useT();
  const { state, save } = useData();
  if (state.status === 'loading') return <p>{t.common.loading}</p>;
  if (state.status === 'error') {
    return (
      <p role="alert" className="error">
        {t.employees.loadError}
      </p>
    );
  }
  return <CalendarView data={state.data} save={save} />;
}

function MonthTotals({ counts, employees }: { counts: Record<string, ShiftCounts>; employees: Employee[] }) {
  const t = useT();
  return (
    <div className="month__totals">
      <span className="month__totals-title">{t.calendar.monthTotals}</span>
      <ul>
        {employees.map((e) => (
          <li key={e.id} title={`${e.firstName} ${e.lastName}`}>
            <span>{e.lastName}</span>
            <strong>{(counts[e.id]?.day ?? 0) + (counts[e.id]?.night ?? 0)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CalendarView({ data, save }: { data: Data; save(next: Data): Promise<void> }) {
  const t = useT();
  const locale = useLocale();
  const { can } = usePermissions();
  const canEdit = can('calendar:edit');
  const today = useMemo(() => new Date(), []);
  const currentRef = useRef<HTMLElement>(null);

  const [selected, setSelected] = useState<Shift | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);

  const months = useMemo(() => calendarMonths(today), [today]);
  const range = useMemo(() => calendarRange(today), [today]);
  // The current month, or the first one if today is before the calendar start.
  const focus = useMemo(
    () => months.find((m) => m.year === today.getFullYear() && m.month === today.getMonth()) ?? months[0],
    [months, today],
  );
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(mondayReference(i)));
  }, [locale]);
  const employeesById = useMemo(() => new Map(data.employees.map((e) => [e.id, e])), [data.employees]);

  // While previewing, show the proposed schedule instead of the saved one.
  const assignments: Record<string, Assignment> = preview ? preview.result.assignments : data.assignments;

  // Rule warnings for manual assignments (allowed, but flagged).
  const warnings = useMemo(() => {
    const view: Data = { ...data, assignments };
    const result = new Map<string, ReasonCode[]>();
    for (const [key, a] of Object.entries(assignments)) {
      if (a.source !== 'manual') continue;
      const [date, part] = key.split(':') as [string, DayPart];
      const broken = brokenRules(view, { date, part }, a.employeeId);
      if (broken.length > 0) result.set(key, broken);
    }
    return result;
  }, [data, assignments]);

  // Day and night shifts per employee for each month (from the saved or the previewed schedule).
  const monthlyCounts = useMemo(() => {
    const result = new Map<string, Record<string, ShiftCounts>>();
    for (const [key, a] of Object.entries(assignments)) {
      const month = key.slice(0, 7);
      const counts = result.get(month) ?? {};
      const entry = counts[a.employeeId] ?? { day: 0, night: 0 };
      if (key.endsWith(':night')) entry.night++;
      else entry.day++;
      counts[a.employeeId] = entry;
      result.set(month, counts);
    }
    return result;
  }, [assignments]);
  const sortedEmployees = useMemo(() => [...data.employees].sort(compareEmployees), [data.employees]);

  const focusMonth = (smooth: boolean) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    currentRef.current?.scrollIntoView({ block: 'start', behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    focusMonth(false);
  }, []);

  function showPreview(startAt: Shift) {
    // Never regenerate before tomorrow: today and the past are only changed by hand.
    if (compareShifts(startAt, tomorrowDay(today)) < 0) return;
    const result = generate({ data, range, startAt });
    const before: Record<string, Assignment> = data.assignments;
    const after: Record<string, Assignment> = result.assignments;
    const changed = new Set<string>();
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (before[key]?.employeeId !== after[key]?.employeeId) changed.add(key);
    }
    setPreview({ result, changed });
    setRegenerating(false);
  }

  async function applyPreview() {
    if (!preview) return;
    await save({ ...data, assignments: preview.result.assignments });
    setPreview(null);
  }

  return (
    <section>
      <div className="page-header">
        <h1>{t.calendar.title}</h1>
        {canEdit && (
          <button type="button" className="button button--primary" disabled={preview !== null} onClick={() => setRegenerating(true)}>
            {t.calendar.regenerate}
          </button>
        )}
      </div>

      {preview && (
        <PreviewBar
          employees={sortedEmployees}
          months={months.map(({ year, month }) => {
            const key = `${year}-${String(month + 1).padStart(2, '0')}`;
            return { key, label: monthName.format(new Date(year, month, 1)), counts: monthlyCounts.get(key) ?? {} };
          })}
          changed={preview.changed.size}
          unfilled={preview.result.unfilled}
          onApply={() => void applyPreview()}
          onDiscard={() => setPreview(null)}
        />
      )}

      {months.map(({ year, month }) => {
        const isFocus = year === focus?.year && month === focus.month;
        const grid = monthGrid(year, month);
        return (
          <section key={`${year}-${month}`} className="month" ref={isFocus ? currentRef : undefined}>
            <h2 className="month__title">{monthName.format(new Date(year, month, 1))}</h2>
            <div className="month__grid" role="grid">
              <div className="week week--head" role="row">
                {weekdays.map((name) => (
                  <div key={name} className="weekday" role="columnheader">
                    {name}
                  </div>
                ))}
              </div>
              {grid.weeks.map((week, w) => (
                <div key={w} className="week" role="row">
                  {week.map((cell, d) => {
                    if (!cell) return <div key={d} className="day day--empty" role="gridcell" />;
                    const date = toIsoDate(cell.date);
                    return (
                      <div key={d} className={isSameDay(cell.date, today) ? 'day day--today' : 'day'} role="gridcell">
                        <span className="day__number">{cell.day}</span>
                        {(['day', 'night'] as const).map((part) => {
                          const shift: Shift = { date, part };
                          const key = shiftKey(shift);
                          const assignment = assignments[key];
                          return (
                            <ShiftTile
                              key={part}
                              part={part}
                              assignment={assignment}
                              employee={assignment ? employeesById.get(assignment.employeeId) : undefined}
                              closed={companyClosedReason(data, shift) !== null}
                              warnings={warnings.get(key) ?? []}
                              changed={preview?.changed.has(key) ?? false}
                              onSelect={canEdit && !preview ? () => setSelected(shift) : undefined}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <MonthTotals counts={monthlyCounts.get(`${year}-${String(month + 1).padStart(2, '0')}`) ?? {}} employees={sortedEmployees} />
          </section>
        );
      })}

      <button type="button" className="button button--primary fab" onClick={() => focusMonth(true)}>
        {t.calendar.currentMonth}
      </button>

      {canEdit && selected && (
        <ShiftDialog
          shift={selected}
          data={data}
          onSave={async (next) => {
            await save(next);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}
      {canEdit && regenerating && (
        <RegenerateDialog minStart={tomorrowDay(today)} onPreview={showPreview} onClose={() => setRegenerating(false)} />
      )}
    </section>
  );
}
