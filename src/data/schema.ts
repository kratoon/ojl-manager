import { z } from 'zod';

export const employeeSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
});

export const dataSchema = z.object({
  employees: z.array(employeeSchema),
});

export type Employee = z.infer<typeof employeeSchema>;
export type Data = z.infer<typeof dataSchema>;

export const emptyData: Data = { employees: [] };
