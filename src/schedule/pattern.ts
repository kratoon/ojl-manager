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

/**
 * Positions come from sorting the pairs by their first member (last name, first name, id); unpaired
 * employees follow the pairs. Deterministic and independent of the order of the input.
 */
export function buildPattern(employees: Employee[], anchor: string): PatternModel {
  const sorted = [...employees].sort(compareEmployees);
  const byId = new Map(sorted.map((e) => [e.id, e]));
  const positions = new Map<string, number>();
  const singles: Employee[] = [];
  let next = 0;
  for (const e of sorted) {
    if (positions.has(e.id)) continue;
    const partner = mutualPartner(e, byId);
    if (partner) {
      positions.set(e.id, next);
      positions.set(partner.id, next);
      next++;
    } else {
      singles.push(e);
    }
  }
  // Without any pair there is no rotation to follow: the pattern abstains.
  if (next === 0) return { anchor, positions: new Map() };
  for (const e of singles) positions.set(e.id, next++);
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
