import { useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import type { PairingProblems } from '../../schedule/pattern';
import { compareShifts, type Shift } from '../../schedule/shift';
import { Modal } from '../Modal';
import { ShiftField } from '../ShiftField';

interface RegenerateDialogProps {
  /** Earliest allowed start, also the default: tomorrow's day shift. */
  minStart: Shift;
  /** Every employee needs a pair before generating (ADR-a1cb97d). */
  pairing: PairingProblems;
  onPreview(startAt: Shift): void;
  onClose(): void;
}

export function RegenerateDialog({ minStart, pairing, onPreview, onClose }: RegenerateDialogProps) {
  const t = useT();
  const [start, setStart] = useState<Shift | undefined>(minStart);
  const valid = start !== undefined && compareShifts(start, minStart) >= 0 && pairing.ok;
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
        {!pairing.ok && (
          <p role="alert" className="error">
            {`${t.calendar.pairingRequired} ${pairing.unpaired.map((e) => e.name).join(', ')}`}
          </p>
        )}
        {start && compareShifts(start, minStart) < 0 && (
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
