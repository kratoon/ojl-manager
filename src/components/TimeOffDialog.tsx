import { useState, type FormEvent } from 'react';
import { vacationSchema, type Employee, type Vacation } from '../data/schema';
import { useT } from '../i18n/I18nProvider';
import type { Shift } from '../schedule/shift';
import type { TimeOffRow } from '../schedule/timeOff';
import { Modal } from './Modal';
import { ShiftField } from './ShiftField';

interface TimeOffDialogProps {
  /** Row being edited, or undefined to add a new one. */
  row?: TimeOffRow;
  /** Pick the employee from this list. Without it the time off belongs to `employeeId`. */
  employees?: Employee[];
  /** Fixed employee (the employee page). */
  employeeId?: string;
  onSave(employeeId: string, vacation: Vacation, previousEmployeeId?: string): Promise<void>;
  onClose(): void;
}

/** Add or edit one time off: from, to and whether the missed shifts are compensated. */
export function TimeOffDialog({ row, employees, employeeId: fixedEmployeeId, onSave, onClose }: TimeOffDialogProps) {
  const t = useT();
  const [employeeId, setEmployeeId] = useState(row?.employee.id ?? fixedEmployeeId ?? '');
  const [from, setFrom] = useState<Shift | undefined>(row?.vacation.from);
  const [to, setTo] = useState<Shift | undefined>(row?.vacation.to);
  const [compensate, setCompensate] = useState(row?.vacation.compensate ?? true);
  const [error, setError] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const parsed = vacationSchema.safeParse({ id: row?.vacation.id ?? crypto.randomUUID(), from, to, compensate });
    if (!parsed.success || !employeeId) return setError(true);
    try {
      await onSave(employeeId, parsed.data, row?.employee.id);
    } catch {
      setError(true);
    }
  }

  return (
    <Modal title={row ? t.timeOff.editTitle : t.timeOff.addTitle} onClose={onClose}>
      <form className="form" onSubmit={(e) => void submit(e)}>
        {employees && (
          <label className="field">
            <span>{t.timeOff.employee}</span>
            <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              <option value="">{t.timeOff.selectEmployee}</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <ShiftField label={t.timeOff.from} value={from} onChange={setFrom} />
        <ShiftField label={t.timeOff.to} value={to} onChange={setTo} />
        <label className="check">
          <input type="checkbox" checked={compensate} onChange={(e) => setCompensate(e.target.checked)} />
          <span>{t.employees.compensate}</span>
        </label>
        <p className="hint">{t.timeOff.hint}</p>
        {error && (
          <p role="alert" className="error">
            {t.timeOff.saveError}
          </p>
        )}
        <div className="form__actions">
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
