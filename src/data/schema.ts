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

export const employeeSchema = z
  .object({
    id: z.string().min(1),
    firstName: z.string().trim().min(1),
    lastName: z.string().trim().min(1),
    firstShift: shiftSchema.optional(),
    lastShift: shiftSchema.optional(),
    vacations: z.array(vacationSchema).default([]),
    /** Overrides the company "max shifts in a row" for this employee. */
    maxInRow: z.number().int().min(1).optional(),
    /** Allows exactly one day+night (or night+day) pair back to back (ADR-86a9b67). */
    allowMixedPair: z.boolean().default(false),
  })
  .refine((e) => !e.firstShift || !e.lastShift || compareShifts(e.firstShift, e.lastShift) <= 0, {
    message: 'firstShift must not be after lastShift',
  });

export const assignmentSchema = z.object({
  employeeId: z.string().min(1),
  /** Manual assignments are locked: the generator never changes them (ADR-fec8e13). */
  source: z.enum(['manual', 'auto']),
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
});

export const forbiddenShiftSchema = z.object({
  id: z.string().min(1),
  shift: shiftSchema,
  employeeId: z.string().min(1),
});

export const dataSchema = z.object({
  employees: z.array(employeeSchema).default([]),
  /** Assignments by shift key ("YYYY-MM-DD:day" or ":night"). */
  assignments: z.record(z.string().regex(shiftKeyPattern), assignmentSchema).default({}),
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
