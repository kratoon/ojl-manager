import type { Assignment, Data, Employee, Vacation } from '../data/schema';
import { buildPattern, type PatternEvidence } from './pattern';
import { byString, compareEmployees } from './order';
import { companyClosedReason, defaultRules, evaluate, type ReasonCode, type Rule } from './rules';
import { compareShifts, shiftKey, shiftsBetween, toIsoDate, type Shift, type ShiftKey } from './shift';

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

const EVIDENCE_DAYS = 14;

/**
 * Shifts that stay as they are and show where the rotation stands: two weeks around the start, locked ones
 * on both sides and automatic ones only before the start (the others are about to be regenerated).
 */
function patternEvidence(kept: Map<ShiftKey, Assignment[]>, startAt: Shift): PatternEvidence[] {
  const [y, m, d] = startAt.date.split('-').map(Number) as [number, number, number];
  const from = toIsoDate(new Date(y, m - 1, d - EVIDENCE_DAYS));
  const to = toIsoDate(new Date(y, m - 1, d + EVIDENCE_DAYS));
  const evidence: PatternEvidence[] = [];
  for (const [key, list] of kept) {
    const [date, part] = key.split(':') as [string, Shift['part']];
    if (date < from || date > to) continue;
    const shift = { date, part };
    const before = compareShifts(shift, startAt) < 0;
    const employeeIds = list.filter((a) => before || a.source === 'manual').map((a) => a.employeeId);
    if (employeeIds.length > 0) evidence.push({ shift, employeeIds });
  }
  return evidence;
}

export function generate({ data, range, startAt, rules = defaultRules }: GenerateInput): GenerateResult {
  const seats = data.company.seatsPerShift;
  const orderedRules = [...rules].sort((a, b) => byString(a.id, b.id));
  const employees = [...data.employees].sort(compareEmployees);
  const employeeRank = new Map(employees.map((e, i) => [e.id, i]));
  const shifts = shiftsBetween(range.from, range.to);
  const workable = shifts.filter((s) => companyClosedReason(data, s) === null);

  // Scale factor k: seats to fill divided by all counting shifts (ADR-aaa3ccd).
  const totalCounting = employees.reduce((sum, e) => sum + workable.filter((s) => countsFor(e, s)).length, 0);
  const k = totalCounting === 0 ? 0 : (seats * workable.length) / totalCounting;
  // The same scale factor per kind, so day and night shifts are balanced separately (OJL-ba0e2e7).
  const kindScale = (part: Shift['part']) => {
    const ofKind = workable.filter((s) => s.part === part);
    const counting = employees.reduce((sum, e) => sum + ofKind.filter((s) => countsFor(e, s)).length, 0);
    return counting === 0 ? 0 : (seats * ofKind.length) / counting;
  };
  const kScale = { day: kindScale('day'), night: kindScale('night') };

  // Assignments that stay: everything except auto assignments from startAt on, inside the range.
  const kept = new Map<ShiftKey, Assignment[]>();
  for (const [key, list] of Object.entries(data.assignments) as [ShiftKey, Assignment[]][]) {
    const [date, part] = key.split(':') as [string, Shift['part']];
    const shift = { date, part };
    const regenerated = compareShifts(shift, startAt) >= 0 && compareShifts(shift, range.from) >= 0 && compareShifts(shift, range.to) <= 0;
    const entries = regenerated ? list.filter((a) => a.source === 'manual') : [...list];
    if (entries.length > 0) kept.set(key, entries);
  }

  const pattern = buildPattern(employees, data.company.pattern.anchor, patternEvidence(kept, startAt));

  const worked = new Map(employees.map((e) => [e.id, 0]));
  const counting = new Map(employees.map((e) => [e.id, 0]));
  const workedKind = { day: new Map(employees.map((e) => [e.id, 0])), night: new Map(employees.map((e) => [e.id, 0])) };
  const countingKind = { day: new Map(employees.map((e) => [e.id, 0])), night: new Map(employees.map((e) => [e.id, 0])) };
  const unfilled: Unfilled[] = [];
  const compensatingIds = new Set<string>();
  /** Expected shifts by now minus shifts worked so far. Positive = behind. */
  const gapOf = (e: Employee) => k * (counting.get(e.id) ?? 0) - (worked.get(e.id) ?? 0);
  const kindGapOf = (e: Employee, part: Shift['part']) =>
    kScale[part] * (countingKind[part].get(e.id) ?? 0) - (workedKind[part].get(e.id) ?? 0);
  const assignedTo = (s: Shift): readonly string[] => kept.get(shiftKey(s))?.map((a) => a.employeeId) ?? [];

  for (const shift of shifts) {
    const key = shiftKey(shift);
    const closed = companyClosedReason(data, shift) !== null;
    const initial = kept.get(key)?.length ?? 0;
    const initialIds = (kept.get(key) ?? []).map((a) => a.employeeId);

    if (!closed && compareShifts(shift, startAt) >= 0) {
      // Compensation starts when an employee is `compensationGap` behind the others and ends when caught up.
      const inWindow = employees.filter((e) => countsFor(e, shift));
      const meanGap = inWindow.length === 0 ? 0 : inWindow.reduce((sum, e) => sum + gapOf(e), 0) / inWindow.length;
      for (const e of inWindow) {
        const behind = gapOf(e) - meanGap;
        if (behind >= data.company.pattern.compensationGap) compensatingIds.add(e.id);
        else if (behind <= 0) compensatingIds.delete(e.id);
      }
      const reasonSet = new Set<ReasonCode>();
      let missing = 0;
      for (let seat = initial; seat < seats; seat++) {
        const taken = new Set(assignedTo(shift));
        const evaluated = employees
          .filter((e) => !taken.has(e.id))
          .map((employee) => {
            const gap = gapOf(employee);
            const kindGap = kindGapOf(employee, shift.part);
            const compensating = compensatingIds.has(employee.id);
            return { employee, gap, kindGap, ...evaluate(orderedRules, { data, employee, shift, assignedTo, gap, kindGap, compensating, pattern }) };
          });
        let candidates = evaluated.filter((c) => c.score > 0);
        // Fairness cap: skip employees too far above expected, unless that would leave nobody.
        const underCap = candidates.filter((c) => c.gap >= -data.company.fairnessCap);
        if (underCap.length > 0) candidates = underCap;
        // The same cap for the kind of this shift: nobody piles up nights (or days) while others remain.
        const underKindCap = candidates.filter((c) => c.kindGap >= -data.company.fairnessCap);
        if (underKindCap.length > 0) candidates = underKindCap;

        const best = candidates.reduce<(typeof candidates)[number] | undefined>(
          (top, c) => (top === undefined || c.score > top.score ? c : top),
          undefined,
        );
        if (best) {
          kept.set(key, [...(kept.get(key) ?? []), { employeeId: best.employee.id, source: 'auto' }]);
          worked.set(best.employee.id, (worked.get(best.employee.id) ?? 0) + 1);
          workedKind[shift.part].set(best.employee.id, (workedKind[shift.part].get(best.employee.id) ?? 0) + 1);
        } else {
          missing++;
          for (const c of evaluated) for (const r of c.blockedBy) reasonSet.add(r);
        }
      }
      if (missing > 0) unfilled.push({ shift, missing, reasons: [...reasonSet].sort() });
    }

    // Tally what was already on this shift before generating (picks above were counted as they were made).
    for (const id of initialIds) {
      worked.set(id, (worked.get(id) ?? 0) + 1);
      workedKind[shift.part].set(id, (workedKind[shift.part].get(id) ?? 0) + 1);
    }
    if (!closed) {
      for (const e of employees) {
        if (!countsFor(e, shift)) continue;
        counting.set(e.id, (counting.get(e.id) ?? 0) + 1);
        countingKind[shift.part].set(e.id, (countingKind[shift.part].get(e.id) ?? 0) + 1);
      }
    }
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
