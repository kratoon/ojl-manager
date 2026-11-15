import { useMemo, useState } from 'react';
import { TEMPORARY_ID, type Data } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import { compareEmployees } from '../../schedule/generator';
import { clearShift } from '../../schedule/locks';
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
  // Per seat: locked (manual, the generator keeps it) or open (auto, the generator may replace it).
  const [locked, setLocked] = useState<boolean[]>(() =>
    Array.from({ length: seats }, (_, i) => (current[i] ? current[i]?.source === 'manual' : true)),
  );
  const [forbidden, setForbidden] = useState<string[]>(
    data.forbiddenShifts.filter((f) => shiftKey(f.shift) === key).map((f) => f.employeeId),
  );
  const [toForbid, setToForbid] = useState('');
  const [error, setError] = useState(false);

  // Employees only: a temporary worker may take any number of seats.
  const chosen = selected.filter((id) => id && id !== TEMPORARY_ID);
  const warningsFor = (id: string) => (id ? brokenRules({ ...data, forbiddenShifts: draftForbidden() }, shift, id) : []);
  const nameOf = (id: string) => {
    if (id === TEMPORARY_ID) return t.calendar.temporary;
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

  /** Picks an employee for a seat: the one already there keeps its lock, a new one starts locked. */
  function choose(seat: number, id: string) {
    setSelected((list) => list.map((v, i) => (i === seat ? id : v)));
    const original = current[seat];
    setLocked((list) => list.map((v, i) => (i === seat ? (original && original.employeeId === id ? original.source === 'manual' : true) : v)));
  }

  async function commit(assignments: Data['assignments']) {
    try {
      await onSave({ ...data, assignments, forbiddenShifts: draftForbidden() });
    } catch {
      setError(true);
    }
  }

  /** Saves the seats: a locked seat becomes manual, an open one stays (or becomes) automatic. */
  async function persist() {
    const assignments = { ...data.assignments };
    const entries = selected.flatMap((employeeId, seat) =>
      employeeId ? [{ employeeId, source: locked[seat] || employeeId === TEMPORARY_ID ? ('manual' as const) : ('auto' as const) }] : [],
    );
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
          void persist();
        }}
      >
        {selected.map((value, seat) => {
          const warnings = warningsFor(value);
          return (
            <div key={seat} className="seat-field">
              <div className="seat-row">
                <label className="field">
                  <span>{`${t.calendar.assignEmployee} ${seat + 1}`}</span>
                  <select
                    value={value}
                    autoFocus={seat === 0}
                    onChange={(e) => choose(seat, e.target.value)}
                  >
                    <option value="">{t.calendar.noEmployee}</option>
                    <option value={TEMPORARY_ID}>{t.calendar.temporaryOption}</option>
                    {employees
                      .filter((e) => !forbidden.includes(e.id) && (!chosen.includes(e.id) || e.id === value))
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </select>
                </label>
                {value === TEMPORARY_ID && (
                  <button type="button" className="button button--glyph" disabled title={t.calendar.locked} aria-label={t.calendar.locked}>
                    <LockIcon size={18} />
                  </button>
                )}
                {value !== '' && value !== TEMPORARY_ID && (
                  <button
                    type="button"
                    className="button button--glyph"
                    title={locked[seat] ? t.calendar.unlockShift : t.calendar.lockAction}
                    aria-label={locked[seat] ? t.calendar.unlockShift : t.calendar.lockAction}
                    aria-pressed={locked[seat]}
                    onClick={() => setLocked((list) => list.map((v, i) => (i === seat ? !v : v)))}
                  >
                    {locked[seat] ? <LockIcon size={18} /> : <UnlockIcon size={18} />}
                  </button>
                )}
              </div>
              {pairSuggestion(seat) && (
                <button
                  type="button"
                  className="link-button"
                  onClick={() => choose(seat, pairSuggestion(seat))}
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
        {selected.includes(TEMPORARY_ID) && <p className="hint">{t.calendar.temporaryHint}</p>}

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
          {current.length > 0 && (
            <button type="button" className="button button--danger" onClick={() => void commit(clearShift(data.assignments, key))}>
              {t.calendar.clearShift}
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
