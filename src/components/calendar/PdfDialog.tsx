import { useState } from 'react';
import { useT } from '../../i18n/I18nProvider';
import { Modal } from '../Modal';

export interface MonthOption {
  key: string;
  label: string;
}

interface PdfDialogProps {
  months: MonthOption[];
  /** Months ticked when the dialog opens: this month and all following ones. */
  defaultSelected: string[];
  onDownload(selected: string[]): Promise<void>;
  onClose(): void;
}

export function PdfDialog({ months, defaultSelected, onDownload, onClose }: PdfDialogProps) {
  const t = useT();
  const [selected, setSelected] = useState(() => new Set(defaultSelected));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  async function download() {
    setBusy(true);
    setError(false);
    try {
      // Keep calendar order, whatever order the boxes were ticked in.
      await onDownload(months.filter((m) => selected.has(m.key)).map((m) => m.key));
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <Modal title={t.calendar.pdfTitle} onClose={onClose}>
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault();
          void download();
        }}
      >
        <p className="hint">{t.calendar.pdfHint}</p>
        <div className="pdf-actions">
          <button type="button" className="button" onClick={() => setSelected(new Set(months.map((m) => m.key)))}>
            {t.calendar.pdfSelectAll}
          </button>
          <button type="button" className="button" onClick={() => setSelected(new Set())}>
            {t.calendar.pdfSelectNone}
          </button>
        </div>
        <div className="pdf-months" role="group" aria-label={t.calendar.pdfTitle}>
          {months.map((m) => (
            <label key={m.key} className="check">
              <input type="checkbox" checked={selected.has(m.key)} onChange={() => toggle(m.key)} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="error">
            {t.calendar.pdfError}
          </p>
        )}
        <div className="form__actions">
          <button type="button" className="button" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={busy || selected.size === 0}>
            {busy ? t.calendar.pdfBusy : t.calendar.pdfDownload}
          </button>
        </div>
      </form>
    </Modal>
  );
}
