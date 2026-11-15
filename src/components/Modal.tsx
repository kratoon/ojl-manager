import { useEffect, useId, useRef, type ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';

interface ModalProps {
  title: string;
  /** A wider dialog for forms with side notes. */
  wide?: boolean;
  onClose(): void;
  children: ReactNode;
}

/** Modal dialog on top of the native <dialog> element (focus trap, Escape and inert page for free). */
export function Modal({ title, wide, onClose, children }: ModalProps) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={wide ? 'modal modal--wide' : 'modal'}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal__header">
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        <button type="button" className="button button--icon" aria-label={t.common.close} title={t.common.close} onClick={onClose}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <div className="modal__body">{children}</div>
    </dialog>
  );
}
