import { useMemo, useState, type FormEvent } from 'react';
import { ShiftField } from '../components/ShiftField';
import { useData } from '../data/DataProvider';
import { allWeekdays, companySchema, type Weekday } from '../data/schema';
import { useLocale, useT } from '../i18n/I18nProvider';
import type { Shift } from '../schedule/shift';

interface ClosedDraft {
  id: string;
  from?: Shift;
  to?: Shift;
}

/** Company-wide rules and scheduling settings (route #/rules, requires rules:edit). */
export function CompanyRulesPage() {
  const t = useT();
  const { state } = useData();
  if (state.status === 'loading') return <p>{t.common.loading}</p>;
  if (state.status === 'error') {
    return (
      <p role="alert" className="error">
        {t.employees.loadError}
      </p>
    );
  }
  return <CompanyRulesForm />;
}

function CompanyRulesForm() {
  const t = useT();
  const locale = useLocale();
  const { state, save } = useData();
  const data = state.status === 'ready' ? state.data : null;
  const company = data?.company;

  const [workingDays, setWorkingDays] = useState<Weekday[]>(company?.workingDays ?? allWeekdays);
  const [closed, setClosed] = useState<ClosedDraft[]>(company?.closedPeriods ?? []);
  const [maxInRow, setMaxInRow] = useState(String(company?.maxInRow ?? 3));
  const [seatsPerShift, setSeatsPerShift] = useState(String(company?.seatsPerShift ?? 2));
  const [status, setStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // Localized weekday names. 2024-01-01 is a Monday.
  const weekdayNames = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'long' });
    return allWeekdays.map((id, i) => ({ id, name: fmt.format(new Date(2024, 0, 1 + i)) }));
  }, [locale]);

  if (!data) return null;

  const toggleDay = (day: Weekday) =>
    setWorkingDays((days) => (days.includes(day) ? days.filter((d) => d !== day) : [...days, day]));
  const updateClosed = (id: string, patch: Partial<ClosedDraft>) =>
    setClosed((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  async function handle(e: FormEvent) {
    e.preventDefault();
    // Fairness and pattern settings live in the scheduling settings dialog of the calendar: keep them.
    const parsed = companySchema.safeParse({
      ...company,
      workingDays: allWeekdays.filter((d) => workingDays.includes(d)),
      closedPeriods: closed,
      maxInRow: Number(maxInRow),
      seatsPerShift: Number(seatsPerShift),
    });
    if (!parsed.success) return setStatus('error');
    try {
      await save({ ...(data as NonNullable<typeof data>), company: parsed.data });
      setStatus('saved');
    } catch {
      setStatus('error');
    }
  }

  return (
    <section>
      <h1>{t.rules.title}</h1>
      <div className="card card--wide">
        <form className="form" onSubmit={handle} onChange={() => setStatus('idle')}>
          <fieldset className="vacations">
            <legend>{t.rules.workingDays}</legend>
            <div className="weekdays">
              {weekdayNames.map(({ id, name }) => (
                <label key={id} className="check">
                  <input type="checkbox" checked={workingDays.includes(id)} onChange={() => toggleDay(id)} />
                  <span>{name}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="vacations">
            <legend>{t.rules.closedPeriods}</legend>
            {closed.map((c) => (
              <div key={c.id} className="vacation">
                <ShiftField label={t.employees.vacationFrom} value={c.from} onChange={(from) => updateClosed(c.id, { from })} />
                <ShiftField label={t.employees.vacationTo} value={c.to} onChange={(to) => updateClosed(c.id, { to })} />
                <button type="button" className="button button--danger" onClick={() => setClosed((l) => l.filter((x) => x.id !== c.id))}>
                  {t.common.remove}
                </button>
              </div>
            ))}
            <button type="button" className="button" onClick={() => setClosed((l) => [...l, { id: crypto.randomUUID() }])}>
              {t.rules.addClosed}
            </button>
          </fieldset>

          <label className="field">
            <span>{t.rules.maxInRow}</span>
            <input type="number" min={1} step={1} value={maxInRow} onChange={(e) => setMaxInRow(e.target.value)} />
          </label>
          <p className="hint">{t.rules.dayNightNote}</p>

          <label className="field">
            <span>{t.rules.seatsPerShift}</span>
            <input type="number" min={1} max={4} step={1} value={seatsPerShift} onChange={(e) => setSeatsPerShift(e.target.value)} />
          </label>

          {status === 'error' && (
            <p role="alert" className="error">
              {t.employees.saveError}
            </p>
          )}
          {status === 'saved' && <p role="status">{t.common.saved}</p>}
          <div className="form__actions">
            <button type="submit" className="button button--primary">
              {t.common.save}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
