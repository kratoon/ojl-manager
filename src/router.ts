import { useEffect, useState } from 'react';
import type { Permission } from './permissions/permissions';

// Hash routing works on GitHub Pages without server-side fallbacks.
export type Route = { name: 'home' } | { name: 'employees' } | { name: 'employee'; id: string };
export type RouteName = Route['name'];

/** Every route must declare the permission required to open it (ADR-e8f59ca). */
export const routePermissions: Record<RouteName, Permission> = {
  home: 'home:view',
  employees: 'employees:view',
  employee: 'employees:edit',
};

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  if (path === '/employees') return { name: 'employees' };
  const match = /^\/employees\/([^/]+)$/.exec(path);
  if (match?.[1]) return { name: 'employee', id: decodeURIComponent(match[1]) };
  return { name: 'home' };
}

export function href(route: Route): string {
  switch (route.name) {
    case 'home':
      return '#/';
    case 'employees':
      return '#/employees';
    case 'employee':
      return `#/employees/${encodeURIComponent(route.id)}`;
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(globalThis.location?.hash ?? ''));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}
