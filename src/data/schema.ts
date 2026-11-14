import { z } from 'zod';
import { compareShifts, isoDatePattern, shiftKeyPattern } from '../schedule/shift';

// Everything added after the first version has a default, so older data files keep loading.

export const shiftSchema = z.object({
  date: z.string().regex(isoDatePattern).refine((d) => !Number.isNaN(Date.parse(d)), 'invalid date'),
  part: z.enum(['day', 'night']),
});

export const weekdaySchema = z.enum(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
export type Weekday = z.infer<typeof weekdaySchema>;
export const allWeekdays: Weekday[] = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Vacation from one shift to another (inclusive). */
export const vacationSchema = z
  .object({
    id: z.string().min(1),
    from: shiftSchema,
    to: shiftSchema,
    /** On (default): the missed shifts are made up around the PTO. Off: fewer shifts are accepted (ADR-aaa3ccd). */
    compensate: z.boolean().default(true),
  })
  .refine((v) => compareShifts(v.from, v.to) <= 0, { message: 'from must not be after to' });

/** Older files stored firstName and lastName: they become a single name. */
function migrateName(value: unknown): unknown {
  if (value && typeof value === 'object' && !('name' in value)) {
    const { firstName, lastName, ...rest } = value as Record<string, unknown>;
    const parts = [firstName, lastName].filter((p): p is string => typeof p === 'string' && p.trim() !== '');
    return { ...rest, name: parts.join(' ') };
  }
  return value;
}

const employeeObject = z
  .object({
    id: z.string().min(1),
    name: z.string().trim().min(1),
    firstShift: shiftSchema.optional(),
    lastShift: shiftSchema.optional(),
    vacations: z.array(vacationSchema).default([]),
    /** Overrides the company "max shifts in a row" for this employee. */
    maxInRow: z.number().int().min(1).optional(),
    /** Allows exactly one day+night (or night+day) pair back to back (ADR-86a9b67). */
    allowMixedPair: z.boolean().default(false),
    /** The other member of this employee's fixed pair (kept mutual, ADR-a1cb97d). */
    partnerId: z.string().min(1).optional(),
  })
  .refine((e) => !e.firstShift || !e.lastShift || compareShifts(e.firstShift, e.lastShift) <= 0, {
    message: 'firstShift must not be after lastShift',
  });

export const employeeSchema = z.preprocess(migrateName, employeeObject);

export const assignmentSchema = z.object({
  employeeId: z.string().min(1),
  /** Manual assignments are locked: the generator never changes them (ADR-fec8e13). */
  source: z.enum(['manual', 'auto']),
});

/** The employees on one shift (one entry per seat). Older files stored a single assignment: it migrates. */
export const shiftAssignmentsSchema = z.preprocess(
  (value) => (Array.isArray(value) ? value : [value]),
  z.array(assignmentSchema).max(8).refine((list) => new Set(list.map((a) => a.employeeId)).size === list.length, {
    message: 'an employee cannot take two seats of one shift',
  }),
);

/** Start of block 0 of the long/short rotation: a Monday (ADR-a1cb97d). */
const mondaySchema = z
  .string()
  .regex(isoDatePattern)
  .refine((d) => {
    const [y, m, day] = d.split('-').map(Number) as [number, number, number];
    return new Date(y, m - 1, day).getDay() === 1;
  }, 'anchor must be a Monday');

export const patternSettingsSchema = z.object({
  anchor: mondaySchema.default('2026-11-02'),
  /** Weight of the pattern preference in the score. */
  weight: z.number().positive().default(4),
});

export const companySchema = z.object({
  workingDays: z.array(weekdaySchema).default(allWeekdays),
  closedPeriods: z
    .array(
      z
        .object({ id: z.string().min(1), from: shiftSchema, to: shiftSchema })
        .refine((c) => compareShifts(c.from, c.to) <= 0, { message: 'from must not be after to' }),
    )
    .default([]),
  /** Max shifts of the same kind on consecutive dates. */
  maxInRow: z.number().int().min(1).default(3),
  /** Weight of the fairness rule in the score (ADR-aaa3ccd). */
  fairnessWeight: z.number().positive().default(2),
  /** Shifts above expected after which an employee is skipped while others remain (ADR-aaa3ccd). */
  fairnessCap: z.number().min(0).default(2),
  /** Employees per shift (ADR-a1cb97d). */
  seatsPerShift: z.number().int().min(1).max(4).default(2),
  pattern: patternSettingsSchema.default(() => patternSettingsSchema.parse({})),
});

export const forbiddenShiftSchema = z.object({
  id: z.string().min(1),
  shift: shiftSchema,
  employeeId: z.string().min(1),
});

export const dataSchema = z.object({
  employees: z.array(employeeSchema).default([]),
  /** Assignments by shift key ("YYYY-MM-DD:day" or ":night"). */
  assignments: z.record(z.string().regex(shiftKeyPattern), shiftAssignmentsSchema).default({}),
  company: companySchema.default(() => companySchema.parse({})),
  /** Date-specific rule: an employee who must not work a given shift. */
  forbiddenShifts: z.array(forbiddenShiftSchema).default([]),
});

export type Vacation = z.infer<typeof vacationSchema>;
export type Employee = z.infer<typeof employeeSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;
export type Company = z.infer<typeof companySchema>;
export type ForbiddenShift = z.infer<typeof forbiddenShiftSchema>;
export type Data = z.infer<typeof dataSchema>;

export const emptyData: Data = dataSchema.parse({});
