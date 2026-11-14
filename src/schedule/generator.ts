import type { Assignment, Data, Employee, Vacation } from '../data/schema';
import { companyClosedReason, defaultRules, evaluate, type ReasonCode, type Rule } from './rules';
import { compareShifts, shiftKey, shiftsBetween, type Shift, type ShiftKey } from './shift';

// Schedule generator (ADR-4a9d8da). Pure and deterministic: no randomness, no clock, no dependence on
// the order of employees or assignments in the input.

export interface GenerateInput {
  data: Data;
  /** The whole calendar range. Fairness is balanced over this range. */
  range: { from: Shift; to: Shift };
  /** First shift to (re)generate. Earlier shifts and all manual assignments are kept. */
  startAt: Shift;
  rules?: Rule[];
}

export interface Unfilled {
  shift: Shift;
  reasons: ReasonCode[];
}

export interface GenerateResult {
  assignments: Record<ShiftKey, Assignment>;
  unfilled: Unfilled[];
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Total order used for every tie: last name, first name, id. */
export const compareEmployees = (a: Employee, b: Employee) =>
  byString(a.lastName, b.lastName) || byString(a.firstName, b.firstName) || byString(a.id, b.id);

const inVacation = (v: Vacation, shift: Shift) => compareShifts(v.from, shift) <= 0 && compareShifts(shift, v.to) <= 0;

/**
 * Does this workable shift count towards the employee's entitlement? It does inside the employee's
 * window (first to last shift), except vacation shifts with compensate off (ADR-aaa3ccd).
 */
export function countsFor(employee: Employee, shift: Shift): boolean {
  if (employee.firstShift && compareShifts(shift, employee.firstShift) < 0) return false;
  if (employee.lastShift && compareShifts(shift, employee.lastShift) > 0) return false;
  return !employee.vacations.some((v) => !v.compensate && inVacation(v, shift));
}

export function generate({ data, range, startAt, rules = defaultRules }: GenerateInput): GenerateResult {
  const orderedRules = [...rules].sort((a, b) => byString(a.id, b.id));
  const employees = [...data.employees].sort(compareEmployees);
  const shifts = shiftsBetween(range.from, range.to);
  const workable = shifts.filter((s) => companyClosedReason(data, s) === null);

  // Scale factor k: shifts to cover divided by all counting shifts (ADR-aaa3ccd).
  const totalCounting = employees.reduce((sum, e) => sum + workable.filter((s) => countsFor(e, s)).length, 0);
  const k = totalCounting === 0 ? 0 : workable.length / totalCounting;

  // Assignments that stay: everything except auto assignments from startAt on, inside the range.
  const kept = new Map<ShiftKey, Assignment>();
  for (const [key, a] of Object.entries(data.assignments) as [ShiftKey, Assignment][]) {
    const [date, part] = key.split(':') as [string, Shift['part']];
    const inRegeneratedPart =
      a.source === 'auto' &&
      compareShifts({ date, part }, startAt) >= 0 &&
      compareShifts({ date, part }, range.from) >= 0 &&
      compareShifts({ date, part }, range.to) <= 0;
    if (!inRegeneratedPart) kept.set(key, a);
  }

  const worked = new Map(employees.map((e) => [e.id, 0]));
  const counting = new Map(employees.map((e) => [e.id, 0]));
  const unfilled: Unfilled[] = [];
  const assignedTo = (s: Shift) => kept.get(shiftKey(s))?.employeeId;

  for (const shift of shifts) {
    const key = shiftKey(shift);
    const closed = companyClosedReason(data, shift) !== null;
    const existing = kept.get(key);

    if (!existing && !closed && compareShifts(shift, startAt) >= 0) {
      // Evaluate every employee for this shift.
      const evaluated = employees.map((employee) => {
        const gap = k * (counting.get(employee.id) ?? 0) - (worked.get(employee.id) ?? 0);
        const result = evaluate(orderedRules, { data, employee, shift, assignedTo, gap });
        return { employee, gap, ...result };
      });
      let candidates = evaluated.filter((c) => c.score > 0);
      // Fairness cap: skip employees too far above expected, unless that would leave nobody.
      const underCap = candidates.filter((c) => c.gap >= -data.company.fairnessCap);
      if (underCap.length > 0) candidates = underCap;

      const best = candidates.reduce<(typeof candidates)[number] | undefined>(
        (top, c) => (top === undefined || c.score > top.score ? c : top),
        undefined,
      );
      if (best) {
        kept.set(key, { employeeId: best.employee.id, source: 'auto' });
      } else {
        const reasons = [...new Set(evaluated.flatMap((c) => c.blockedBy))].sort();
        unfilled.push({ shift, reasons });
      }
    }

    // Tally this shift for the fairness model (after deciding, so "before this shift" holds).
    const assigned = kept.get(key);
    if (assigned) worked.set(assigned.employeeId, (worked.get(assigned.employeeId) ?? 0) + 1);
    if (!closed) for (const e of employees) if (countsFor(e, shift)) counting.set(e.id, (counting.get(e.id) ?? 0) + 1);
  }

  const assignments = Object.fromEntries(
    [...kept.entries()].sort(([a], [b]) => byString(a, b)),
  ) as Record<ShiftKey, Assignment>;
  return { assignments, unfilled };
}
