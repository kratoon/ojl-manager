import { useCallback, useId, useRef, useState } from 'react';
import { useT } from '../i18n/I18nProvider';
import { usePermissions } from '../permissions/PermissionsProvider';
import { href, routePermissions, useRoute, type Route } from '../router';
import { useDismiss } from './useDismiss';

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/** Main navigation: inline links on wide screens, a menu button on narrow screens. */
export function Nav() {
  const t = useT();
  const { can } = usePermissions();
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  const listId = useId();
  const close = useCallback(() => setOpen(false), []);
  useDismiss(open, close, rootRef);

  const entries: { route: Route; label: string }[] = [{ route: { name: 'calendar' }, label: t.nav.calendar }];
  const items = entries.filter((e) => can(routePermissions[e.route.name]));
  if (items.length === 0) return null;

  return (
    <nav className="nav" ref={rootRef} aria-label={t.nav.main}>
      <button
        type="button"
        className="icon-button nav__toggle"
        aria-label={t.nav.menu}
        title={t.nav.menu}
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
      >
        <MenuIcon />
      </button>
      <ul className={open ? 'nav__list nav__list--open' : 'nav__list'} id={listId}>
        {items.map((item) => (
          <li key={item.route.name}>
            <a
              href={href(item.route)}
              className={route.name === item.route.name ? 'nav__link nav__link--active' : 'nav__link'}
              aria-current={route.name === item.route.name ? 'page' : undefined}
              onClick={close}
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
