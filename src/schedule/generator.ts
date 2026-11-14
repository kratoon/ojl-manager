import type { Assignment, Data, Employee, Vacation } from '../data/schema';
import { buildPattern } from './pattern';
import { byString, compareEmployees } from './order';
import { companyClosedReason, defaultRules, evaluate, type ReasonCode, type Rule } from './rules';
import { compareShifts, shiftKey, shiftsBetween, type Shift, type ShiftKey } from './shift';

export { compareEmployees };

// Schedule generator (ADR-4a9d8da, ADR-a1cb97d). Pure and deterministic: no randomness, no clock, no
// dependence on the order of employees or assignments in the input.

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
  /** How many seats of the shift stay empty. */
  missing: number;
  reasons: ReasonCode[];
}

export interface GenerateResult {
  assignments: Record<ShiftKey, Assignment[]>;
  unfilled: Unfilled[];
}

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
  const seats = data.company.seatsPerShift;
  const orderedRules = [...rules].sort((a, b) => byString(a.id, b.id));
  const employees = [...data.employees].sort(compareEmployees);
  const employeeRank = new Map(employees.map((e, i) => [e.id, i]));
  const pattern = buildPattern(employees, data.company.pattern.anchor);
  const shifts = shiftsBetween(range.from, range.to);
  const workable = shifts.filter((s) => companyClosedReason(data, s) === null);

  // Scale factor k: seats to fill divided by all counting shifts (ADR-aaa3ccd).
  const totalCounting = employees.reduce((sum, e) => sum + workable.filter((s) => countsFor(e, s)).length, 0);
  const k = totalCounting === 0 ? 0 : (seats * workable.length) / totalCounting;

  // Assignments that stay: everything except auto assignments from startAt on, inside the range.
  const kept = new Map<ShiftKey, Assignment[]>();
  for (const [key, list] of Object.entries(data.assignments) as [ShiftKey, Assignment[]][]) {
    const [date, part] = key.split(':') as [string, Shift['part']];
    const shift = { date, part };
    const regenerated = compareShifts(shift, startAt) >= 0 && compareShifts(shift, range.from) >= 0 && compareShifts(shift, range.to) <= 0;
    const entries = regenerated ? list.filter((a) => a.source === 'manual') : [...list];
    if (entries.length > 0) kept.set(key, entries);
  }

  const worked = new Map(employees.map((e) => [e.id, 0]));
  const counting = new Map(employees.map((e) => [e.id, 0]));
  const unfilled: Unfilled[] = [];
  const assignedTo = (s: Shift): readonly string[] => kept.get(shiftKey(s))?.map((a) => a.employeeId) ?? [];

  for (const shift of shifts) {
    const key = shiftKey(shift);
    const closed = companyClosedReason(data, shift) !== null;
    const initial = kept.get(key)?.length ?? 0;
    const initialIds = (kept.get(key) ?? []).map((a) => a.employeeId);

    if (!closed && compareShifts(shift, startAt) >= 0) {
      const reasonSet = new Set<ReasonCode>();
      let missing = 0;
      for (let seat = initial; seat < seats; seat++) {
        const taken = new Set(assignedTo(shift));
        const evaluated = employees
          .filter((e) => !taken.has(e.id))
          .map((employee) => {
            const gap = k * (counting.get(employee.id) ?? 0) - (worked.get(employee.id) ?? 0);
            return { employee, gap, ...evaluate(orderedRules, { data, employee, shift, assignedTo, gap, pattern }) };
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
          kept.set(key, [...(kept.get(key) ?? []), { employeeId: best.employee.id, source: 'auto' }]);
          worked.set(best.employee.id, (worked.get(best.employee.id) ?? 0) + 1);
        } else {
          missing++;
          for (const c of evaluated) for (const r of c.blockedBy) reasonSet.add(r);
        }
      }
      if (missing > 0) unfilled.push({ shift, missing, reasons: [...reasonSet].sort() });
    }

    // Tally what was already on this shift before generating (picks above were counted as they were made).
    for (const id of initialIds) worked.set(id, (worked.get(id) ?? 0) + 1);
    if (!closed) for (const e of employees) if (countsFor(e, shift)) counting.set(e.id, (counting.get(e.id) ?? 0) + 1);
  }

  // Stable output: sorted shifts, and employees within a shift in the fixed employee order.
  const assignments = Object.fromEntries(
    [...kept.entries()]
      .sort(([a], [b]) => byString(a, b))
      .map(([key, list]) => [
        key,
        [...list].sort((a, b) => (employeeRank.get(a.employeeId) ?? 1e9) - (employeeRank.get(b.employeeId) ?? 1e9)),
      ]),
  ) as Record<ShiftKey, Assignment[]>;
  return { assignments, unfilled };
}
