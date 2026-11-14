import { useMemo, useState } from 'react';
import type { Data } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import { compareEmployees } from '../../schedule/generator';
import { brokenRules } from '../../schedule/rules';
import { shiftKey, type Shift } from '../../schedule/shift';
import { Modal } from '../Modal';

interface ShiftDialogProps {
  shift: Shift;
  data: Data;
  onSave(next: Data): Promise<void>;
  onClose(): void;
}

function formatDate(date: string, locale: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Intl.DateTimeFormat(locale, { dateStyle: 'full' }).format(new Date(y, m - 1, d));
}

/** Assign an employee to a shift by hand (locks it) and manage who must not work it. */
export function ShiftDialog({ shift, data, onSave, onClose }: ShiftDialogProps) {
  const t = useT();
  const locale = useLocale();
  const key = shiftKey(shift);
  const current = data.assignments[key];
  const employees = useMemo(() => [...data.employees].sort(compareEmployees), [data.employees]);

  const [selected, setSelected] = useState(current?.employeeId ?? '');
  const [forbidden, setForbidden] = useState<string[]>(
    data.forbiddenShifts.filter((f) => shiftKey(f.shift) === key).map((f) => f.employeeId),
  );
  const [toForbid, setToForbid] = useState('');
  const [error, setError] = useState(false);

  const warnings = selected ? brokenRules({ ...data, forbiddenShifts: draftForbidden() }, shift, selected) : [];
  const nameOf = (id: string) => {
    const e = data.employees.find((x) => x.id === id);
    return e ? `${e.firstName} ${e.lastName}` : id;
  };

  function draftForbidden() {
    const others = data.forbiddenShifts.filter((f) => shiftKey(f.shift) !== key);
    const kept = data.forbiddenShifts.filter((f) => shiftKey(f.shift) === key && forbidden.includes(f.employeeId));
    const added = forbidden
      .filter((id) => !kept.some((f) => f.employeeId === id))
      .map((employeeId) => ({ id: crypto.randomUUID(), shift, employeeId }));
    return [...others, ...kept, ...added];
  }

  async function persist(assignmentId: string) {
    const assignments = { ...data.assignments };
    if (assignmentId) assignments[key] = { employeeId: assignmentId, source: 'manual' };
    else delete assignments[key];
    try {
      await onSave({ ...data, assignments, forbiddenShifts: draftForbidden() });
    } catch {
      setError(true);
    }
  }

  const partLabel = shift.part === 'day' ? t.calendar.day : t.calendar.night;
  const available = employees.filter((e) => !forbidden.includes(e.id) || e.id === selected);

  return (
    <Modal title={`${formatDate(shift.date, locale)} · ${partLabel}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void persist(selected);
        }}
      >
        <label className="field">
          <span>{t.calendar.assignEmployee}</span>
          <select value={selected} onChange={(e) => setSelected(e.target.value)} autoFocus>
            <option value="">{t.calendar.noEmployee}</option>
            {available.map((e) => (
              <option key={e.id} value={e.id}>
                {`${e.firstName} ${e.lastName}`}
              </option>
            ))}
          </select>
        </label>

        <p className="hint">{t.calendar.lockHint}</p>

        {warnings.length > 0 && (
          <p role="status" className="warning">
            {`${t.calendar.warning}: ${warnings.map((w) => t.reasons[w]).join(', ')}`}
          </p>
        )}

        <fieldset className="vacations">
          <legend>{t.calendar.forbiddenTitle}</legend>
          {forbidden.map((id) => (
            <div key={id} className="forbidden-row">
              <span>{nameOf(id)}</span>
              <button type="button" className="button" onClick={() => setForbidden((l) => l.filter((x) => x !== id))}>
                {t.common.remove}
              </button>
            </div>
          ))}
          <div className="forbidden-row">
            <select aria-label={t.calendar.forbiddenTitle} value={toForbid} onChange={(e) => setToForbid(e.target.value)}>
              <option value="">{t.calendar.selectEmployee}</option>
              {employees
                .filter((e) => !forbidden.includes(e.id) && e.id !== selected)
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {`${e.firstName} ${e.lastName}`}
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="button"
              disabled={!toForbid}
              onClick={() => {
                setForbidden((l) => [...l, toForbid]);
                setToForbid('');
              }}
            >
              {t.calendar.forbidAdd}
            </button>
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="error">
            {t.employees.saveError}
          </p>
        )}
        <div className="form__actions">
          {current?.source === 'manual' && (
            <button type="button" className="button button--danger" onClick={() => void persist('')}>
              {t.calendar.clearManual}
            </button>
          )}
          <button type="button" className="button" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="button button--primary">
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
