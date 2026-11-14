import type { Employee } from '../data/schema';

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Total order used for every tie: last name, first name, id. */
export const compareEmployees = (a: Employee, b: Employee) =>
  byString(a.lastName, b.lastName) || byString(a.firstName, b.firstName) || byString(a.id, b.id);

export { byString };
