import type { Data } from '../data/schema';
import { TEMPORARY_ID } from '../data/schema';
import { compareEmployees } from './order';
import { brokenRules, type ReasonCode } from './rules';
import { compareShifts, shiftKey, type Shift } from './shift';

/** An assignment that breaks a hard rule: vacation, outside the employee's window, excluded, max in a row, mixing. */
export interface Conflict {
  shift: Shift;
  employeeId: string;
  reasons: ReasonCode[];
  /** Locked by hand: the generator never changes it. Automatic ones are fixed by regenerating. */
  source: 'manual' | 'auto';
}

/** Every assignment of the schedule that breaks a rule, in date order (day before night, then by employee name). */
export function findConflicts(data: Data): Conflict[] {
  const employees = new Map(data.employees.map((e) => [e.id, e]));
  const result: Conflict[] = [];
  for (const [key, list] of Object.entries(data.assignments)) {
    const [date, part] = key.split(':') as [string, Shift['part']];
    const shift = { date, part };
    for (const a of list) {
      if (a.employeeId === TEMPORARY_ID || !employees.has(a.employeeId)) continue; // not an employee: no rules
      const reasons = brokenRules(data, shift, a.employeeId);
      if (reasons.length > 0) result.push({ shift, employeeId: a.employeeId, reasons, source: a.source });
    }
  }
  return result.sort(
    (a, b) =>
      compareShifts(a.shift, b.shift) ||
      compareEmployees(employees.get(a.employeeId)!, employees.get(b.employeeId)!),
  );
}

/** Conflicts keyed like the calendar looks them up: "<shift key>|<employee id>". */
export function conflictIndex(conflicts: Conflict[]): Map<string, ReasonCode[]> {
  return new Map(conflicts.map((c) => [`${shiftKey(c.shift)}|${c.employeeId}`, c.reasons]));
}
