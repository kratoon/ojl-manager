// Permission model (ADR-e8f59ca). Every feature declares `<feature>:view` / `<feature>:edit`.

export type Mode = 'view' | 'edit';

export const features = ['home', 'employees', 'calendar', 'rules', 'file'] as const;
export type Feature = (typeof features)[number];
export type Permission = `${Feature}:view` | `${Feature}:edit`;

/**
 * Every host runs in edit mode: data is a local file the user opens and saves (ADR-112163d),
 * so there is nothing to protect on the host. View mode stays supported for a future
 * database backend (ADR-e8f59ca).
 */
export function defaultMode(): Mode {
  return 'edit';
}

export function can(mode: Mode, permission: Permission): boolean {
  return permission.endsWith(':view') || mode === 'edit';
}
