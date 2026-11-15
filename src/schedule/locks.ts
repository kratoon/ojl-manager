import { TEMPORARY_ID, type Assignment } from '../data/schema';
import type { ShiftKey } from './shift';

// Locking is the assignment source: manual = locked (ADR-fec8e13). These helpers only change the source
// or remove entries, so the employees on a shift stay unless a function says otherwise.

export type Assignments = Record<string, Assignment[]>;

/** Lock (every entry manual; a temporary worker stays locked) or unlock (every entry auto) all shifts whose date starts with `monthPrefix` ("YYYY-MM"). */
export function setMonthLock(assignments: Assignments, monthPrefix: string, locked: boolean): Assignments {
  const source: Assignment['source'] = locked ? 'manual' : 'auto';
  // A temporary worker is always locked, whatever the month does.
  const retag = (a: Assignment) => (a.source === source || a.employeeId === TEMPORARY_ID ? a : { ...a, source });
  return Object.fromEntries(
    Object.entries(assignments).map(([key, list]) => [key, key.startsWith(monthPrefix) ? list.map(retag) : list]),
  );
}

/** Are all entries of the month locked? False when the month has no assignments or any unlocked one. */
export function isMonthLocked(assignments: Assignments, monthPrefix: string): boolean {
  const entries = Object.entries(assignments).filter(([key]) => key.startsWith(monthPrefix)).flatMap(([, list]) => list);
  return entries.length > 0 && entries.every((a) => a.source === 'manual');
}

/** Remove everybody from one shift, locked or not. */
export function clearShift(assignments: Assignments, key: ShiftKey): Assignments {
  return Object.fromEntries(Object.entries(assignments).filter(([k]) => k !== key));
}
