// Permission model (ADR-e8f59ca). Every feature declares `<feature>:view` / `<feature>:edit`.

export type Mode = 'view' | 'edit';

export const features = ['home', 'employees'] as const;
export type Feature = (typeof features)[number];
export type Permission = `${Feature}:view` | `${Feature}:edit`;

const localHosts = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

export function isLocalHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return localHosts.has(h) || h.endsWith('.localhost');
}

/** Localhost is always edit. Any other host is view (hosted unlock is undecided, ADR-112163d). */
export function modeFor(hostname: string): Mode {
  return isLocalHost(hostname) ? 'edit' : 'view';
}

export function can(mode: Mode, permission: Permission): boolean {
  return permission.endsWith(':view') || mode === 'edit';
}
