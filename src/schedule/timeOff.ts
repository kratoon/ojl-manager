import type { Employee, Vacation } from '../data/schema';
import { compareEmployees } from './order';
import { compareShifts } from './shift';

// Time off (vacation, sick days) is stored on the employee. These helpers list, order and change it
// across all employees without touching anything else.

export interface TimeOffRow {
  employee: Employee;
  vacation: Vacation;
}

/** Every time off of the given employees, ordered by start, then end, then employee name, then id. */
export function collectTimeOff(employees: Employee[]): TimeOffRow[] {
  return employees
    .flatMap((employee) => employee.vacations.map((vacation) => ({ employee, vacation })))
    .sort(
      (a, b) =>
        compareShifts(a.vacation.from, b.vacation.from) ||
        compareShifts(a.vacation.to, b.vacation.to) ||
        compareEmployees(a.employee, b.employee) ||
        (a.vacation.id < b.vacation.id ? -1 : a.vacation.id > b.vacation.id ? 1 : 0),
    );
}

/** Ended before `today` (ISO date): the whole last day still counts as current. */
export const isPastTimeOff = (vacation: Vacation, today: string): boolean => vacation.to.date < today;

/** Adds the time off, or replaces the one with the same id. Moves it when `previousEmployeeId` differs. */
export function upsertTimeOff(employees: Employee[], employeeId: string, vacation: Vacation, previousEmployeeId = employeeId): Employee[] {
  return employees.map((e) => {
    const without = e.vacations.filter((v) => v.id !== vacation.id);
    if (e.id === employeeId) return { ...e, vacations: [...without, vacation] };
    if (e.id === previousEmployeeId) return { ...e, vacations: without };
    return e;
  });
}

export function removeTimeOff(employees: Employee[], employeeId: string, vacationId: string): Employee[] {
  return employees.map((e) => (e.id === employeeId ? { ...e, vacations: e.vacations.filter((v) => v.id !== vacationId) } : e));
}
