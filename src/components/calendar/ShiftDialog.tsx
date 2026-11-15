import { useMemo, useState } from 'react';
import type { Data } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import { compareEmployees } from '../../schedule/generator';
import { clearShift, unlockShift } from '../../schedule/locks';
import { brokenRules } from '../../schedule/rules';
import { shiftKey, type Shift } from '../../schedule/shift';
import { Modal } from '../Modal';
import { LockIcon, UnlockIcon } from './icons';

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
  const current = data.assignments[key] ?? [];
  const seats = data.company.seatsPerShift;
  const employees = useMemo(() => [...data.employees].sort(compareEmployees), [data.employees]);

  // One selection per seat; '' = nobody.
  const [selected, setSelected] = useState<string[]>(() => Array.from({ length: seats }, (_, i) => current[i]?.employeeId ?? ''));
  const [forbidden, setForbidden] = useState<string[]>(
    data.forbiddenShifts.filter((f) => shiftKey(f.shift) === key).map((f) => f.employeeId),
  );
  const [toForbid, setToForbid] = useState('');
  const [error, setError] = useState(false);

  const chosen = selected.filter(Boolean);
  const warningsFor = (id: string) => (id ? brokenRules({ ...data, forbiddenShifts: draftForbidden() }, shift, id) : []);
  const nameOf = (id: string) => {
    const e = data.employees.find((x) => x.id === id);
    return e ? e.name : id;
  };

  function draftForbidden() {
    const others = data.forbiddenShifts.filter((f) => shiftKey(f.shift) !== key);
    const kept = data.forbiddenShifts.filter((f) => shiftKey(f.shift) === key && forbidden.includes(f.employeeId));
    const added = forbidden
      .filter((id) => !kept.some((f) => f.employeeId === id))
      .map((employeeId) => ({ id: crypto.randomUUID(), shift, employeeId }));
    return [...others, ...kept, ...added];
  }

  const partnerOf = (id: string) => data.employees.find((e) => e.id === id)?.partnerId ?? '';

  /**
   * The pair of an employee chosen in another seat, offered for this seat (never applied automatically).
   * It is offered for an empty seat, and also for a filled one when the two chosen employees are not a pair.
   */
  function pairSuggestion(seat: number): string {
    for (let i = 0; i < selected.length; i++) {
      const partner = i === seat ? '' : partnerOf(selected[i] ?? '');
      if (partner && partner !== selected[seat] && !chosen.includes(partner) && !forbidden.includes(partner)) return partner;
    }
    return '';
  }

  async function commit(assignments: Data['assignments']) {
    try {
      await onSave({ ...data, assignments, forbiddenShifts: draftForbidden() });
    } catch {
      setError(true);
    }
  }

  /** Locks the chosen employees on this shift (every filled seat becomes manual). */
  async function persist(ids: string[]) {
    const assignments = { ...data.assignments };
    const entries = ids.filter(Boolean).map((employeeId) => ({ employeeId, source: 'manual' as const }));
    if (entries.length > 0) assignments[key] = entries;
    else delete assignments[key];
    await commit(assignments);
  }

  const partLabel = shift.part === 'day' ? t.calendar.day : t.calendar.night;

  return (
    <Modal title={`${formatDate(shift.date, locale)} · ${partLabel}`} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void persist(selected);
        }}
      >
        {selected.map((value, seat) => {
          const warnings = warningsFor(value);
          return (
            <div key={seat} className="seat-field">
              <label className="field">
                <span>{`${t.calendar.assignEmployee} ${seat + 1}`}</span>
                <select
                  value={value}
                  autoFocus={seat === 0}
                  onChange={(e) => setSelected((list) => list.map((v, i) => (i === seat ? e.target.value : v)))}
                >
                  <option value="">{t.calendar.noEmployee}</option>
                  {employees
                    .filter((e) => !forbidden.includes(e.id) && (!chosen.includes(e.id) || e.id === value))
                    .map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                </select>
              </label>
              {pairSuggestion(seat) && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => setSelected((list) => list.map((v, i) => (i === seat ? pairSuggestion(seat) : v)))}
                >
                  {`${value === '' ? t.calendar.fillPair : t.calendar.usePair}: ${nameOf(pairSuggestion(seat))}`}
                </button>
              )}
              {warnings.length > 0 && (
                <p role="status" className="warning">
                  {`${t.calendar.warning}: ${warnings.map((w) => t.reasons[w]).join(', ')}`}
                </p>
              )}
            </div>
          );
        })}
        <p className="hint">{t.calendar.lockHint}</p>

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
                .filter((e) => !forbidden.includes(e.id) && !chosen.includes(e.id))
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
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
          {current.some((a) => a.source === 'manual') && (
            <button
              type="button"
              className="button button--glyph"
              title={t.calendar.unlockShift}
              aria-label={t.calendar.unlockShift}
              onClick={() => void commit(unlockShift(data.assignments, key))}
            >
              <UnlockIcon size={18} />
            </button>
          )}
          {current.length > 0 && (
            <button type="button" className="button button--danger" onClick={() => void commit(clearShift(data.assignments, key))}>
              {t.calendar.clearShift}
            </button>
          )}
          <button type="button" className="button" onClick={onClose}>
            {t.common.cancel}
          </button>
          {chosen.length > 0 ? (
            <button type="submit" className="button button--primary button--glyph" title={t.calendar.lockAction} aria-label={t.calendar.lockAction}>
              <LockIcon size={18} />
            </button>
          ) : (
            <button type="submit" className="button button--primary">
              {t.common.save}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
