import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { can, defaultMode, type Mode, type Permission } from './permissions';

interface PermissionsValue {
  mode: Mode;
  can(permission: Permission): boolean;
}

const PermissionsContext = createContext<PermissionsValue>({ mode: 'view', can: (p) => can('view', p) });

export function PermissionsProvider({ mode, children }: { mode?: Mode; children: ReactNode }) {
  const resolved = mode ?? defaultMode();
  const value = useMemo(() => ({ mode: resolved, can: (p: Permission) => can(resolved, p) }), [resolved]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

export function usePermissions(): PermissionsValue {
  return useContext(PermissionsContext);
}
