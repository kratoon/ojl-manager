import type { Employee } from '../../data/schema';
import { useT } from '../../i18n/I18nProvider';
import type { Conflict } from '../../schedule/conflicts';
import type { Shift } from '../../schedule/shift';
import { Modal } from '../Modal';
import { ConflictsTable } from './ConflictsTable';

interface ConflictsDialogProps {
  conflicts: Conflict[];
  employees: Map<string, Employee>;
  today: string;
  /** Opens the shift to fix it. Missing when the user may not edit. */
  onOpenShift?(shift: Shift): void;
  onClose(): void;
}

/** All assignments that break a rule in one list, so nobody has to search the calendar for them. */
export function ConflictsDialog({ conflicts, employees, today, onOpenShift, onClose }: ConflictsDialogProps) {
  const t = useT();
  return (
    <Modal title={t.conflicts.title} wide onClose={onClose}>
      <div className="form">
        <p className="hint">{t.conflicts.hint}</p>
        <ConflictsTable conflicts={conflicts} employees={employees} today={today} onOpenShift={onOpenShift} />
        <div className="form__actions">
          <button type="button" className="button" onClick={onClose}>
            {t.common.close}
          </button>
        </div>
      </div>
    </Modal>
  );
}
