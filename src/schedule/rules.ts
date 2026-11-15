import type { Data, Employee } from '../data/schema';
import { onPattern, type PatternModel } from './pattern';
import { compareShifts, nextShift, previousShift, shiftKey, type Shift } from './shift';

// Rule engine (ADR-86a9b67, ADR-aaa3ccd). A rule returns a verdict or null (no opinion).
// Violated hard rules return score 0; satisfied hard rules return null so they never inflate the score.

export const NEUTRAL_SCORE = 5;

/** Machine-readable reasons. The UI maps these to labels, the engine never produces text. */
export type ReasonCode =
  | 'closed-weekday'
  | 'closed-period'
  | 'vacation'
  | 'before-first-shift'
  | 'after-last-shift'
  | 'forbidden'
  | 'max-in-row'
  | 'day-night-mix'
  | 'pair-limit'
  | 'pattern'
  | 'fairness';

export interface Verdict {
  /** 0 = cannot be assigned, 1 to 10 = allowed, higher is more preferred. */
  score: number;
  reason: ReasonCode;
}

export interface RuleContext {
  data: Data;
  employee: Employee;
  shift: Shift;
  /** Ids of the employees working a shift according to the schedule so far. */
  assignedTo(shift: Shift): readonly string[];
  /** Long/short week rotation, when the generator has one (ADR-a1cb97d). */
  pattern?: PatternModel;
  /** Expected shifts by now minus shifts worked so far (ADR-aaa3ccd). Positive = behind. */
  gap: number;
  /**
   * The employee is making up missed shifts (ADR-a1cb97d): they started when they fell far enough behind the
   * others and continue until the gap is closed, so the rotation is not held against them meanwhile.
   */
  compensating?: boolean;
}

export interface Rule {
  id: string;
  /** Weight in the weighted average. Default 1. */
  weight?(data: Data): number;
  evaluate(ctx: RuleContext): Verdict | null;
}

const blocked = (reason: ReasonCode): Verdict => ({ score: 0, reason });

const weekdays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

export function weekdayOf(date: string): (typeof weekdays)[number] {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return weekdays[new Date(y, m - 1, d).getDay()] as (typeof weekdays)[number];
}

/** Why nobody can work this shift because of company rules, or null when the company is open. */
export function companyClosedReason(data: Data, shift: Shift): ReasonCode | null {
  if (!data.company.workingDays.includes(weekdayOf(shift.date))) return 'closed-weekday';
  const inClosedPeriod = data.company.closedPeriods.some(
    (p) => compareShifts(p.from, shift) <= 0 && compareShifts(shift, p.to) <= 0,
  );
  return inClosedPeriod ? 'closed-period' : null;
}

const within = (from: Shift, to: Shift, shift: Shift) => compareShifts(from, shift) <= 0 && compareShifts(shift, to) <= 0;

const closedRule: Rule = {
  id: 'closed',
  evaluate: ({ data, shift }) => {
    const reason = companyClosedReason(data, shift);
    return reason ? blocked(reason) : null;
  },
};

const windowRule: Rule = {
  id: 'window',
  evaluate: ({ employee, shift }) => {
    if (employee.firstShift && compareShifts(shift, employee.firstShift) < 0) return blocked('before-first-shift');
    if (employee.lastShift && compareShifts(shift, employee.lastShift) > 0) return blocked('after-last-shift');
    return null;
  },
};

const vacationRule: Rule = {
  id: 'vacation',
  evaluate: ({ employee, shift }) =>
    employee.vacations.some((v) => within(v.from, v.to, shift)) ? blocked('vacation') : null,
};

const forbiddenRule: Rule = {
  id: 'forbidden',
  evaluate: ({ data, employee, shift }) =>
    data.forbiddenShifts.some((f) => f.employeeId === employee.id && compareShifts(f.shift, shift) === 0)
      ? blocked('forbidden')
      : null,
};

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const t = new Date(y, m - 1, d + days);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** Max shifts of the same kind on consecutive dates (company value, per-employee override). */
const maxInRowRule: Rule = {
  id: 'max-in-row',
  evaluate: ({ data, employee, shift, assignedTo }) => {
    const limit = employee.maxInRow ?? data.company.maxInRow;
    const same = (days: number) => assignedTo({ date: addDays(shift.date, days), part: shift.part }).includes(employee.id);
    let run = 1;
    for (let d = 1; same(-d); d++) run++;
    for (let d = 1; same(d); d++) run++;
    return run > limit ? blocked('max-in-row') : null;
  },
};

/**
 * No day/night mixing back to back: shifts that follow each other in time (day then night of a date,
 * night then the next date's day) cannot belong to the same employee. With the per-employee override
 * exactly one such pair is allowed, never three in a chain.
 */
const noMixingRule: Rule = {
  id: 'no-mixing',
  evaluate: ({ employee, shift, assignedTo }) => {
    const mine = (s: Shift) => assignedTo(s).includes(employee.id);
    let chain = 1;
    for (let s = previousShift(shift); mine(s); s = previousShift(s)) chain++;
    for (let s = nextShift(shift); mine(s); s = nextShift(s)) chain++;
    if (chain === 1) return null;
    if (!employee.allowMixedPair) return blocked('day-night-mix');
    return chain > 2 ? blocked('pair-limit') : null;
  },
};

/** Fairness is a rule: clamp(5 + gap, 1, 10). It never returns 0 by itself. */
const fairnessRule: Rule = {
  id: 'fairness',
  weight: (data) => data.company.fairnessWeight,
  evaluate: ({ gap }) => ({ score: Math.min(10, Math.max(1, NEUTRAL_SCORE + gap)), reason: 'fairness' }),
};

/**
 * Long/short week rotation as the strongest soft preference: 10 when the employee's pair is on pattern for
 * this shift, 1 otherwise. No opinion without a pattern or for an employee without a position. An employee
 * who is compensating (far behind the others after PTO) gets no opinion off pattern, so fairness decides and
 * they are brought back up to date. Once the gap is closed the rotation wins again.
 */
const patternRule: Rule = {
  id: 'pattern',
  weight: (data) => data.company.pattern.weight,
  evaluate: ({ employee, shift, pattern, compensating }) => {
    if (!pattern) return null;
    const on = onPattern(pattern, employee.id, shift);
    if (on === null) return null;
    if (!on && compensating) return null;
    return { score: on ? 10 : 1, reason: 'pattern' };
  },
};

/** The registry. Kept sorted by id so combining is always in the same order (determinism). */
export const defaultRules: Rule[] = [
  closedRule,
  fairnessRule,
  forbiddenRule,
  maxInRowRule,
  noMixingRule,
  patternRule,
  vacationRule,
  windowRule,
].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

export interface Evaluation {
  /** 0 = blocked. Otherwise the weighted average of the opinions, or the neutral score. */
  score: number;
  /** Reasons of every rule that returned 0. */
  blockedBy: ReasonCode[];
}

/** Any 0 wins; otherwise weighted average of non-null scores; neutral when nobody has an opinion. */
export function evaluate(rules: Rule[], ctx: RuleContext): Evaluation {
  const blockedBy: ReasonCode[] = [];
  let sum = 0;
  let weight = 0;
  for (const rule of rules) {
    const verdict = rule.evaluate(ctx);
    if (!verdict) continue;
    if (verdict.score === 0) {
      blockedBy.push(verdict.reason);
      continue;
    }
    const w = rule.weight?.(ctx.data) ?? 1;
    sum += verdict.score * w;
    weight += w;
  }
  if (blockedBy.length > 0) return { score: 0, blockedBy };
  return { score: weight === 0 ? NEUTRAL_SCORE : sum / weight, blockedBy };
}

/**
 * Which rules a given assignment breaks (used for warnings on manual assignments). The shift itself is
 * treated as unassigned so it does not count against itself.
 */
export function brokenRules(data: Data, shift: Shift, employeeId: string, rules: Rule[] = defaultRules): ReasonCode[] {
  const employee = data.employees.find((e) => e.id === employeeId);
  if (!employee) return [];
  const own = shiftKey(shift);
  const assignedTo = (s: Shift): readonly string[] => {
    const key = shiftKey(s);
    return key === own ? [] : (data.assignments[key]?.map((a) => a.employeeId) ?? []);
  };
  return evaluate(rules, { data, employee, shift, assignedTo, gap: 0 }).blockedBy;
}
