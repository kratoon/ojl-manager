import { useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { compareShifts, type Shift } from '../../schedule/shift';
import { Modal } from '../Modal';
import { ShiftField } from '../ShiftField';

interface RegenerateDialogProps {
  /** Earliest allowed start, also the default: tomorrow's day shift. */
  minStart: Shift;
  onPreview(startAt: Shift): void;
  onClose(): void;
}

export function RegenerateDialog({ minStart, onPreview, onClose }: RegenerateDialogProps) {
  const t = useT();
  const [start, setStart] = useState<Shift | undefined>(minStart);
  const valid = start !== undefined && compareShifts(start, minStart) >= 0;
  return (
    <Modal title={t.calendar.regenerateTitle} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (start && valid) onPreview(start);
        }}
      >
        <ShiftField label={t.calendar.regenerateStart} value={start} onChange={setStart} minDate={minStart.date} />
        <p className="hint">{t.calendar.regenerateHint}</p>
        {start && !valid && (
          <p role="alert" className="error">
            {t.calendar.regenerateTooEarly}
          </p>
        )}
        <div className="form__actions">
          <button type="button" className="button" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={!valid}>
            {t.calendar.preview}
          </button>
        </div>
      </form>
    </Modal>
  );
}
