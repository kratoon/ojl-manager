import type { Employee } from '../data/schema';

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Total order used for every tie: name, then id. */
export const compareEmployees = (a: Employee, b: Employee) => byString(a.name, b.name) || byString(a.id, b.id);

export { byString };
