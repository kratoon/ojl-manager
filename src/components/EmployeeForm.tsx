import { useState, type FormEvent } from 'react';
import { employeeSchema, type Employee } from '../data/schema';
import { useT } from '../i18n/I18nProvider';
import type { Shift } from '../schedule/shift';
import { ShiftField } from './ShiftField';

interface EmployeeFormProps {
  employee?: Employee;
  /** Show scheduling fields (first/last shift, vacations, overrides). Names only otherwise. */
  extended?: boolean;
  /** Everybody else, to pick a pair from (extended form only). */
  others?: Employee[];
  onSubmit(employee: Employee): Promise<void>;
  onCancel(): void;
}

/** Vacation being edited: a date may be missing until the user fills it in. */
interface VacationDraft {
  id: string;
  from?: Shift;
  to?: Shift;
  compensate: boolean;
}

/** Shared by the create modal and the edit page. */
export function EmployeeForm({ employee, extended = false, others = [], onSubmit, onCancel }: EmployeeFormProps) {
  const t = useT();
  const [name, setName] = useState(employee?.name ?? '');
  const [firstShift, setFirstShift] = useState<Shift | undefined>(employee?.firstShift);
  const [lastShift, setLastShift] = useState<Shift | undefined>(employee?.lastShift);
  const [partnerId, setPartnerId] = useState(employee?.partnerId ?? '');
  const [maxInRow, setMaxInRow] = useState(employee?.maxInRow?.toString() ?? '');
  const [allowMixedPair, setAllowMixedPair] = useState(employee?.allowMixedPair ?? false);
  const [vacations, setVacations] = useState<VacationDraft[]>(employee?.vacations ?? []);
  const [error, setError] = useState(false);

  const updateVacation = (id: string, patch: Partial<VacationDraft>) =>
    setVacations((list) => list.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  async function handle(e: FormEvent) {
    e.preventDefault();
    // Spread the existing employee so nothing this form does not edit is lost.
    const candidate = {
      ...employee,
      id: employee?.id ?? crypto.randomUUID(),
      name,
      ...(extended && {
        partnerId: partnerId || undefined,
        firstShift,
        lastShift,
        maxInRow: maxInRow === '' ? undefined : Number(maxInRow),
        allowMixedPair,
        vacations,
      }),
    };
    const parsed = employeeSchema.safeParse(candidate);
    if (!parsed.success) return setError(true);
    try {
      await onSubmit(parsed.data);
    } catch {
      setError(true);
    }
  }

  return (
    <form className="form" onSubmit={handle}>
      <label className="field">
        <span>{t.employees.name}</span>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      {extended && (
        <>
          <label className="field">
            <span>{t.employees.partner}</span>
            <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">{t.employees.noPartner}</option>
              {others.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
            <span className="hint">{t.employees.partnerHint}</span>
          </label>
          <ShiftField label={t.employees.firstShift} value={firstShift} onChange={setFirstShift} />
          <ShiftField label={t.employees.lastShift} value={lastShift} onChange={setLastShift} />

          <label className="field">
            <span>{t.employees.maxInRow}</span>
            <input type="number" min={1} step={1} value={maxInRow} onChange={(e) => setMaxInRow(e.target.value)} />
          </label>
          <label className="check">
            <input type="checkbox" checked={allowMixedPair} onChange={(e) => setAllowMixedPair(e.target.checked)} />
            <span>{t.employees.allowMixedPair}</span>
          </label>

          <fieldset className="vacations">
            <legend>{t.employees.vacations}</legend>
            {vacations.map((v) => (
              <div key={v.id} className="vacation">
                <ShiftField label={t.employees.vacationFrom} value={v.from} onChange={(from) => updateVacation(v.id, { from })} />
                <ShiftField label={t.employees.vacationTo} value={v.to} onChange={(to) => updateVacation(v.id, { to })} />
                <label className="check">
                  <input type="checkbox" checked={v.compensate} onChange={(e) => updateVacation(v.id, { compensate: e.target.checked })} />
                  <span>{t.employees.compensate}</span>
                </label>
                <button type="button" className="button button--danger" onClick={() => setVacations((l) => l.filter((x) => x.id !== v.id))}>
                  {t.common.remove}
                </button>
              </div>
            ))}
            <button
              type="button"
              className="button"
              onClick={() => setVacations((l) => [...l, { id: crypto.randomUUID(), compensate: true } satisfies VacationDraft])}
            >
              {t.employees.addVacation}
            </button>
          </fieldset>
        </>
      )}

      {error && (
        <p role="alert" className="error">
          {t.employees.saveError}
        </p>
      )}
      <div className="form__actions">
        <button type="button" className="button" onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" className="button button--primary">
          {t.common.save}
        </button>
      </div>
    </form>
  );
}

