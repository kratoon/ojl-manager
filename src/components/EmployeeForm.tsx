import { useState, type FormEvent } from 'react';
import { employeeSchema, type Employee } from '../data/schema';
import { useT } from '../i18n/I18nProvider';

interface EmployeeFormProps {
  employee?: Employee;
  onSubmit(employee: Employee): Promise<void>;
  onCancel(): void;
}

/** Shared by the create modal and the edit page. */
export function EmployeeForm({ employee, onSubmit, onCancel }: EmployeeFormProps) {
  const t = useT();
  const [firstName, setFirstName] = useState(employee?.firstName ?? '');
  const [lastName, setLastName] = useState(employee?.lastName ?? '');
  const [error, setError] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    const parsed = employeeSchema.safeParse({ id: employee?.id ?? crypto.randomUUID(), firstName, lastName });
    if (!parsed.success) return setError(true);
    try {
      await onSubmit(parsed.data);
    } catch {
      setError(true);
    }
  }

  return (
    <form className="form" onSubmit={handle}>
      <label className="field">
        <span>{t.employees.firstName}</span>
        <input autoFocus value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </label>
      <label className="field">
        <span>{t.employees.lastName}</span>
        <input value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </label>
      {error && (
        <p role="alert" className="error">
          {t.employees.saveError}
        </p>
      )}
      <div className="form__actions">
        <button type="button" className="button" onClick={onCancel}>
          {t.common.cancel}
        </button>
        <button type="submit" className="button button--primary">
          {t.common.save}
        </button>
      </div>
    </form>
  );
}
