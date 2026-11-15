import type { Data, Employee } from '../data/schema';
import { compareEmployees } from './order';
import type { Shift } from './shift';

// Long/short week rotation (ADR-a1cb97d). A week has three blocks: MON+TUE, WED+THU, FRI+SAT+SUN.
// Counting blocks from an anchor Monday gives one sequence (short, short, long, ...). A fixed pair works
// every other block and alternates day and night on the blocks it works. Pure functions of the date.

const MS_PER_DAY = 86_400_000;

function dayNumber(date: string): number {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Block number of a date counted from the anchor Monday (block 0 is MON+TUE of the anchor week). */
export function blockNumber(date: string, anchor: string): number {
  const diff = dayNumber(date) - dayNumber(anchor);
  const week = Math.floor(diff / 7);
  const dayOfWeek = diff - 7 * week; // 0 = Monday
  const blockInWeek = dayOfWeek < 2 ? 0 : dayOfWeek < 4 ? 1 : 2;
  return 3 * week + blockInWeek;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** Does the pair at this position (0 to 3, A to D) work this shift in the pattern? */
export function patternWorks(position: number, shift: Shift, anchor: string): boolean {
  const p = mod(position, 4);
  const n = blockNumber(shift.date, anchor);
  if (mod(n, 2) !== mod(p, 2)) return false;
  const m = Math.floor(n / 2);
  const part = mod(m + Math.floor(p / 2), 2) === 0 ? 'day' : 'night';
  return part === shift.part;
}

export interface PatternModel {
  anchor: string;
  /** Position in the rotation for every employee (pair members share a position). */
  positions: Map<string, number>;
}

/** The partner of an employee when the pairing is mutual, otherwise undefined. */
function mutualPartner(e: Employee, byId: Map<string, Employee>): Employee | undefined {
  const partner = e.partnerId ? byId.get(e.partnerId) : undefined;
  return partner && partner.id !== e.id && partner.partnerId === e.id ? partner : undefined;
}

/** A kept shift of the schedule: who works it. Used to line the rotation up with what is already locked. */
export interface PatternEvidence {
  shift: Shift;
  employeeIds: readonly string[];
}

/**
 * Positions come from sorting the pairs by their first member (last name, first name, id); unpaired
 * employees follow the pairs. Deterministic and independent of the order of the input.
 *
 * With `evidence` (shifts that stay as they are, e.g. locked ones) the rotation continues from them: each
 * pair takes the position whose shifts match its evidence best, and only pairs without any evidence fall
 * back to the name order on the positions that are left.
 */
export function buildPattern(employees: Employee[], anchor: string, evidence: readonly PatternEvidence[] = []): PatternModel {
  const sorted = [...employees].sort(compareEmployees);
  const byId = new Map(sorted.map((e) => [e.id, e]));
  const units: string[][] = []; // pairs first (by first member), then single employees
  const singles: string[][] = [];
  const seen = new Set<string>();
  for (const e of sorted) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    const partner = mutualPartner(e, byId);
    if (partner) {
      seen.add(partner.id);
      units.push([e.id, partner.id]);
    } else {
      singles.push([e.id]);
    }
  }
  // Without any pair there is no rotation to follow: the pattern abstains.
  if (units.length === 0) return { anchor, positions: new Map() };
  units.push(...singles);

  // votes[u][p]: evidence shifts worked by unit u that pattern position p also works.
  const votes = units.map(() => [0, 0, 0, 0]);
  const unitOf = new Map<string, number>();
  units.forEach((ids, u) => ids.forEach((id) => unitOf.set(id, u)));
  for (const { shift, employeeIds } of evidence) {
    const touched = new Set(employeeIds.flatMap((id) => unitOf.get(id) ?? []));
    for (const u of touched) {
      for (let p = 0; p < 4; p++) if (patternWorks(p, shift, anchor)) (votes[u] as number[])[p]! += 1;
    }
  }

  const unitPosition: (number | undefined)[] = units.map(() => undefined);
  const taken = new Set<number>();
  const options = units.flatMap((_, u) => [0, 1, 2, 3].map((p) => ({ u, p, v: (votes[u] as number[])[p] as number })));
  options.sort((a, b) => b.v - a.v || a.u - b.u || a.p - b.p);
  for (const { u, p, v } of options) {
    if (v > 0 && unitPosition[u] === undefined && !taken.has(p)) {
      unitPosition[u] = p;
      taken.add(p);
    }
  }
  // Units without evidence take the positions that are left in name order, then carry on counting.
  const free = [0, 1, 2, 3].filter((p) => !taken.has(p));
  const positions = new Map<string, number>();
  units.forEach((ids, u) => {
    const position = unitPosition[u] ?? free.shift() ?? u;
    for (const id of ids) positions.set(id, position);
  });
  return { anchor, positions };
}

/** 1 for the 10-score preference, see the pattern rule. */
export function onPattern(model: PatternModel, employeeId: string, shift: Shift): boolean | null {
  const position = model.positions.get(employeeId);
  return position === undefined ? null : patternWorks(position, shift, model.anchor);
}

export interface PairingProblems {
  /** Employees without a (mutual) partner. */
  unpaired: Employee[];
  /** True when generating is allowed: everybody is paired, except one employee when their number is odd. */
  ok: boolean;
}

export function pairingProblems(employees: Employee[]): PairingProblems {
  const byId = new Map(employees.map((e) => [e.id, e]));
  const unpaired = employees.filter((e) => !mutualPartner(e, byId)).sort(compareEmployees);
  const allowed = employees.length % 2; // one lone employee is fine with an odd headcount
  return { unpaired, ok: unpaired.length <= allowed };
}

/** Pair `id` with `partnerId` (or unpair when undefined), keeping the relation mutual. */
export function setPartner(employees: Employee[], id: string, partnerId: string | undefined): Employee[] {
  const target = partnerId && partnerId !== id ? partnerId : undefined;
  const releasing = new Set<string>();
  const current = employees.find((e) => e.id === id)?.partnerId;
  if (current) releasing.add(current);
  const newPartnerOld = target ? employees.find((e) => e.id === target)?.partnerId : undefined;
  if (newPartnerOld) releasing.add(newPartnerOld);
  return employees.map((e) => {
    if (e.id === id) return { ...e, partnerId: target };
    if (e.id === target) return { ...e, partnerId: id };
    if (releasing.has(e.id) && (e.partnerId === id || e.partnerId === target)) return { ...e, partnerId: undefined };
    return e;
  });
}

export type { Data };
