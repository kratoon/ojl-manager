import { useEffect, useMemo, useRef, useState } from 'react';
import { calendarMonths, calendarRange, tomorrowDay } from '../calendar/range';
import { isSameDay, monthGrid } from '../calendar/dates';
import { PdfDialog } from '../components/calendar/PdfDialog';
import { PreviewBar, type ShiftCounts } from '../components/calendar/PreviewBar';
import { ShiftCountsLegend } from '../components/calendar/ShiftCountsLegend';
import { ConflictsDialog } from '../components/calendar/ConflictsDialog';
import { RegenerateDialog } from '../components/calendar/RegenerateDialog';
import { SettingsDialog } from '../components/calendar/SettingsDialog';
import { ShiftDialog } from '../components/calendar/ShiftDialog';
import { LockIcon, UnlockIcon } from '../components/calendar/icons';
import { ShiftTile, type TileEntry } from '../components/calendar/ShiftTile';
import { useData } from '../data/DataProvider';
import { TEMPORARY_ID, type Assignment, type Data, type Employee } from '../data/schema';
import { useLocale, useT } from '../i18n/I18nProvider';
import { usePermissions } from '../permissions/PermissionsProvider';
import { compareEmployees, generate, type GenerateResult } from '../schedule/generator';
import { conflictIndex, findConflicts } from '../schedule/conflicts';
import { isMonthLocked, setMonthLock } from '../schedule/locks';
import { pairingProblems } from '../schedule/pattern';
import { companyClosedReason } from '../schedule/rules';
import { compareShifts, shiftKey, toIsoDate, type Shift } from '../schedule/shift';

const monthKey = (year: number, month: number) => `${year}-${String(month + 1).padStart(2, '0')}`;

// 2024-01-01 is a Monday: used only to ask Intl for localized weekday names.
const mondayReference = (offset: number) => new Date(2024, 0, 1 + offset);

interface Preview {
  result: GenerateResult;
  changed: Set<string>;
  /** The start the preview was made with, so it can be tweaked and run again. */
  startAt: Shift;
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
      <ShiftCountsLegend />
      <ul>
        {employees.map((e) => {
          const day = counts[e.id]?.day ?? 0;
          const night = counts[e.id]?.night ?? 0;
          return (
            <li key={e.id}>
              <span>{e.name}</span>
              <strong>{day + night}</strong>
              <span>{`(${day}/${night})`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Icon button: shows whether the month is locked, the label tells what a click does. */
function MonthLockButton({ locked, empty, onToggle }: { locked: boolean; empty: boolean; onToggle(lock: boolean): void }) {
  const t = useT();
  const label = locked ? t.calendar.unlockMonth : t.calendar.lockMonth;
  return (
    <button type="button" className="button button--glyph" title={label} aria-label={label} disabled={empty} onClick={() => onToggle(!locked)}>
      {locked ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
    </button>
  );
}

function CalendarView({ data, save }: { data: Data; save(next: Data): Promise<void> }) {
  const t = useT();
  const locale = useLocale();
  const { can } = usePermissions();
  const canEdit = can('calendar:edit');
  const canEditSettings = can('rules:edit');
  const today = useMemo(() => new Date(), []);
  const currentRef = useRef<HTMLElement>(null);

  const [selected, setSelected] = useState<Shift | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [conflictsOpen, setConflictsOpen] = useState(false);

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
  const assignments: Record<string, Assignment[]> = preview ? preview.result.assignments : data.assignments;
  const seats = data.company.seatsPerShift;
  const pairing = useMemo(() => pairingProblems(data.employees), [data.employees]);

  // Everything that breaks a rule, locked or not (a locked one is allowed but flagged; an automatic one is
  // stale, for example after a vacation was added, and regenerating fixes it).
  const conflicts = useMemo(() => findConflicts({ ...data, assignments }), [data, assignments]);
  const warnings = useMemo(() => conflictIndex(conflicts), [conflicts]);

  // Day and night shifts per employee for each month (from the saved or the previewed schedule).
  const monthlyCounts = useMemo(() => {
    const result = new Map<string, Record<string, ShiftCounts>>();
    for (const [key, list] of Object.entries(assignments)) {
      const month = key.slice(0, 7);
      const counts = result.get(month) ?? {};
      for (const a of list) {
        if (a.employeeId === TEMPORARY_ID) continue; // not an employee: no totals
        const entry = counts[a.employeeId] ?? { day: 0, night: 0 };
        if (key.endsWith(':night')) entry.night++;
        else entry.day++;
        counts[a.employeeId] = entry;
      }
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

  async function exportPdf(keys: string[]) {
    const chosen = months.filter((m) => keys.includes(monthKey(m.year, m.month)));
    if (chosen.length === 0) return;
    // Loaded on demand: the PDF library and fonts are not part of the initial bundle.
    const [{ buildCalendarPdf }, { loadPdfFonts }] = await Promise.all([import('../export/calendarPdf'), import('../export/fonts')]);
    const bytes = await buildCalendarPdf({ months: chosen, data, locale, labels: t, today }, await loadPdfFonts());
    const first = chosen[0];
    const last = chosen[chosen.length - 1];
    const stamp = (m: { year: number; month: number } | undefined) => (m ? monthKey(m.year, m.month) : '');
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${t.calendar.pdfFileName}_${stamp(first)}_${stamp(last)}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
    setPdfOpen(false);
  }

  function showPreview(startAt: Shift) {
    // Never regenerate before tomorrow: today and the past are only changed by hand.
    if (compareShifts(startAt, tomorrowDay(today)) < 0) return;
    const result = generate({ data, range, startAt });
    const before: Record<string, Assignment[]> = data.assignments;
    const after: Record<string, Assignment[]> = result.assignments;
    const people = (list: Assignment[] | undefined) => (list ?? []).map((a) => a.employeeId).sort().join(',');
    const changed = new Set<string>();
    for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
      if (people(before[key]) !== people(after[key])) changed.add(key);
    }
    setPreview({ result, changed, startAt });
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
          conflicts={conflicts}
          startAt={preview.startAt}
          minStart={tomorrowDay(today)}
          canRegenerate={pairing.ok}
          today={toIsoDate(today)}
          onRegenerate={showPreview}
          onApply={() => void applyPreview()}
          onDiscard={() => setPreview(null)}
        />
      )}

      {months.map(({ year, month }) => {
        const isFocus = year === focus?.year && month === focus.month;
        const grid = monthGrid(year, month);
        return (
          <section key={`${year}-${month}`} className="month" ref={isFocus ? currentRef : undefined}>
            <div className="month__header">
              <h2 className="month__title">{monthName.format(new Date(year, month, 1))}</h2>
              {canEdit && !preview && (
                <MonthLockButton
                  locked={isMonthLocked(data.assignments, monthKey(year, month))}
                  empty={!Object.keys(data.assignments).some((k) => k.startsWith(monthKey(year, month)))}
                  onToggle={(lock) => void save({ ...data, assignments: setMonthLock(data.assignments, monthKey(year, month), lock) })}
                />
              )}
            </div>
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
                    const date = toIsoDate(cell.date);
                    const dayClass = cell.outside ? 'day day--outside' : isSameDay(cell.date, today) ? 'day day--today' : 'day';
                    return (
                      <div key={d} className={dayClass} role="gridcell" aria-disabled={cell.outside || undefined}>
                        <span className="day__number">{cell.day}</span>
                        {(['day', 'night'] as const).map((part) => {
                          const shift: Shift = { date, part };
                          const key = shiftKey(shift);
                          const entries: TileEntry[] = (assignments[key] ?? []).map((assignment) => ({
                            assignment,
                            employee: employeesById.get(assignment.employeeId),
                            warnings: cell.outside ? [] : (warnings.get(`${key}|${assignment.employeeId}`) ?? []),
                          }));
                          return (
                            <ShiftTile
                              key={part}
                              part={part}
                              entries={entries}
                              seats={seats}
                              outside={cell.outside}
                              closed={companyClosedReason(data, shift) !== null}
                              changed={!cell.outside && (preview?.changed.has(key) ?? false)}
                              previous={
                                !cell.outside && preview?.changed.has(key)
                                  ? (data.assignments[key] ?? []).flatMap((a) => employeesById.get(a.employeeId) ?? [])
                                  : undefined
                              }
                              onSelect={canEdit && !preview && !cell.outside ? () => setSelected(shift) : undefined}
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

      <div className="fab-bar">
        {canEdit && (
          <button type="button" className="button" disabled={preview !== null} onClick={() => setRegenerating(true)}>
            {t.calendar.regenerate}
          </button>
        )}
        <button type="button" className="button" disabled={preview !== null} onClick={() => setConflictsOpen(true)}>
          {`${t.conflicts.button} (${conflicts.length})`}
        </button>
        {canEditSettings && (
          <button type="button" className="button" disabled={preview !== null} onClick={() => setSettingsOpen(true)}>
            {t.settings.button}
          </button>
        )}
        <button type="button" className="button" disabled={preview !== null} onClick={() => setPdfOpen(true)}>
          {t.calendar.pdfButton}
        </button>
        <button type="button" className="button button--primary" onClick={() => focusMonth(true)}>
          {t.calendar.currentMonth}
        </button>
      </div>

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
      {canEditSettings && settingsOpen && (
        <SettingsDialog
          company={data.company}
          onSave={async (company) => {
            await save({ ...data, company });
            setSettingsOpen(false);
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {conflictsOpen && (
        <ConflictsDialog
          conflicts={conflicts}
          employees={employeesById}
          today={toIsoDate(today)}
          onOpenShift={
            canEdit
              ? (shift) => {
                  setConflictsOpen(false);
                  setSelected(shift);
                }
              : undefined
          }
          onClose={() => setConflictsOpen(false)}
        />
      )}
      {pdfOpen && (
        <PdfDialog
          months={months.map(({ year, month }) => ({ key: monthKey(year, month), label: monthName.format(new Date(year, month, 1)) }))}
          defaultSelected={months
            .filter((m) => m.year > (focus?.year ?? 0) || (m.year === focus?.year && m.month >= (focus?.month ?? 0)))
            .map((m) => monthKey(m.year, m.month))}
          onDownload={exportPdf}
          onClose={() => setPdfOpen(false)}
        />
      )}
      {canEdit && regenerating && (
        <RegenerateDialog minStart={tomorrowDay(today)} pairing={pairing} onPreview={showPreview} onClose={() => setRegenerating(false)} />
      )}
    </section>
  );
}
