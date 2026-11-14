import { useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import type { Shift } from '../../schedule/shift';
import { Modal } from '../Modal';
import { ShiftField } from '../ShiftField';

interface RegenerateDialogProps {
  defaultStart: Shift;
  onPreview(startAt: Shift): void;
  onClose(): void;
}

export function RegenerateDialog({ defaultStart, onPreview, onClose }: RegenerateDialogProps) {
  const t = useT();
  const [start, setStart] = useState<Shift | undefined>(defaultStart);
  return (
    <Modal title={t.calendar.regenerateTitle} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          if (start) onPreview(start);
        }}
      >
        <ShiftField label={t.calendar.regenerateStart} value={start} onChange={setStart} />
        <p className="hint">{t.calendar.regenerateHint}</p>
        <div className="form__actions">
          <button type="button" className="button" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={!start}>
            {t.calendar.preview}
          </button>
        </div>
      </form>
    </Modal>
  );
}
