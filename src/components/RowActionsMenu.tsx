import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useT } from '../i18n/I18nProvider';
import { useDismiss } from './useDismiss';

export interface RowAction {
  key: string;
  label: string;
  icon?: 'edit' | 'delete';
  danger?: boolean;
  onSelect(): void;
}

const iconPaths: Record<NonNullable<RowAction['icon']>, ReactNode> = {
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  delete: <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />,
};

function ActionIcon({ name }: { name: NonNullable<RowAction['icon']> }) {
  return (
    <svg className="menu__icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {iconPaths[name]}
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/** Row action dropdown (icon-only trigger, menu aligned to the right edge of the trigger). */
export function RowActionsMenu({ actions }: { actions: RowAction[] }) {
  const t = useT();
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const open = pos !== null;
  const close = useCallback(() => setPos(null), []);
  useDismiss(open, close, rootRef);

  // The menu is fixed-positioned so the scrolling table wrapper cannot clip it.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open, close]);

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    if (open) return close();
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
  }

  return (
    <div className="row-menu" ref={rootRef}>
      <button
        type="button"
        className="button button--icon"
        aria-label={t.common.actions}
        title={t.common.actions}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={toggle}
      >
        <ChevronDownIcon />
      </button>
      {open && (
        <ul className="menu menu--fixed" id={menuId} style={{ top: pos.top, right: pos.right }}>
          {actions.map((action) => (
            <li key={action.key}>
              <button
                type="button"
                className={action.danger ? 'menu__item menu__item--danger' : 'menu__item'}
                onClick={() => {
                  close();
                  action.onSelect();
                }}
              >
                {action.icon && <ActionIcon name={action.icon} />}
                {action.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
