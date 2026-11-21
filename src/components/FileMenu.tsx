import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useData } from '../data/DataProvider';
import type { FileWarning } from '../data/dataFile';
import { useT } from '../i18n/I18nProvider';
import { usePermissions } from '../permissions/PermissionsProvider';
import { useDismiss } from './useDismiss';

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}

/** Open a data file from the PC, or save the current data as a download (ADR-112163d). */
export function FileMenu() {
  const t = useT();
  const { can } = usePermissions();
  const { state, dirty, openFile, downloadFile } = useData();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [warnings, setWarnings] = useState<FileWarning[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef);

  const canOpen = can('file:edit');
  const canSave = can('file:view') && state.status === 'ready';

  const load = useCallback(
    async (file: File) => {
      if (dirty && !window.confirm(t.file.confirmReplace)) return;
      try {
        setWarnings(await openFile(file));
        setFailed(false);
      } catch {
        setFailed(true);
        setWarnings([]);
      }
    },
    [dirty, openFile, t],
  );

  // Drag a data file anywhere onto the page to open it.
  useEffect(() => {
    if (!canOpen) return;
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes('Files')) e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      const file = e.dataTransfer?.files[0];
      if (!file) return;
      e.preventDefault();
      void load(file);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, [canOpen, load]);

  if (!canOpen && !canSave) return null;

  return (
    <div className="file-menu" ref={rootRef}>
      <button
        type="button"
        className="icon-button"
        aria-label={t.file.menu}
        title={t.file.menu}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        <FileIcon />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void load(file);
        }}
      />
      {open && (
        <ul className="menu" id={menuId}>
          {canOpen && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  inputRef.current?.click();
                }}
              >
                {t.file.open}
              </button>
            </li>
          )}
          {canSave && (
            <li>
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  downloadFile();
                }}
              >
                {t.file.save}
              </button>
            </li>
          )}
        </ul>
      )}
      {warnings.length > 0 && (
        <div role="status" className="file-menu__error file-menu__warning">
          {warnings.map((w) => (
            <p key={w.kind}>{w.kind === 'newerVersion' ? t.file.newerVersion.replace('{version}', w.version) : t.file.olderFile}</p>
          ))}
          <button type="button" className="button" onClick={() => setWarnings([])}>
            {t.common.close}
          </button>
        </div>
      )}
      {failed && (
        <p role="alert" className="file-menu__error error">
          {t.file.openError}
        </p>
      )}
    </div>
  );
}
