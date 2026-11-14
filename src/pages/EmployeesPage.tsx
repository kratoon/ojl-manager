import { useState } from 'react';
import { EmployeeForm } from '../components/EmployeeForm';
import { Modal } from '../components/Modal';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { useData } from '../data/DataProvider';
import type { Employee } from '../data/schema';
import { useT } from '../i18n/I18nProvider';
import { usePermissions } from '../permissions/PermissionsProvider';
import { href } from '../router';

function CreateEmployeeDialog({ onSubmit, onClose }: { onSubmit(employee: Employee): Promise<void>; onClose(): void }) {
  const t = useT();
  return (
    <Modal title={t.employees.createTitle} onClose={onClose}>
      <EmployeeForm onSubmit={onSubmit} onCancel={onClose} />
    </Modal>
  );
}

export function EmployeesPage() {
  const t = useT();
  const { can } = usePermissions();
  const { state, save } = useData();
  const [creating, setCreating] = useState(false);
  const canEdit = can('employees:edit');

  if (state.status === 'loading') return <p>{t.common.loading}</p>;
  if (state.status === 'error') {
    return (
      <p role="alert" className="error">
        {t.employees.loadError}
      </p>
    );
  }

  const { data } = state;
  const create = async (employee: Employee) => {
    await save({ ...data, employees: [...data.employees, employee] });
    setCreating(false);
  };
  const remove = async (employee: Employee) => {
    if (!window.confirm(t.employees.deleteConfirm)) return;
    // Drop everything that refers to the removed employee.
    const assignments = Object.fromEntries(Object.entries(data.assignments).filter(([, a]) => a.employeeId !== employee.id));
    const forbiddenShifts = data.forbiddenShifts.filter((f) => f.employeeId !== employee.id);
    await save({ ...data, employees: data.employees.filter((e) => e.id !== employee.id), assignments, forbiddenShifts });
  };

  return (
    <section>
      <div className="page-header">
        <h1>{t.employees.title}</h1>
        {canEdit && (
          <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
            {t.employees.add}
          </button>
        )}
      </div>
      {data.employees.length === 0 ? (
        <p>{t.employees.empty}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">{t.employees.firstName}</th>
                <th scope="col">{t.employees.lastName}</th>
                {canEdit && (
                  <th scope="col" className="table__actions">
                    <span className="sr-only">{t.common.actions}</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.employees.map((employee) => (
                <tr key={employee.id}>
                  <td>{employee.firstName}</td>
                  <td>{employee.lastName}</td>
                  {canEdit && (
                    <td className="table__actions">
                      <RowActionsMenu
                        actions={[
                          { key: 'edit', icon: 'edit', label: t.common.edit, onSelect: () => {
                              window.location.hash = href({ name: 'employee', id: employee.id });
                            },
                          },
                          { key: 'delete', icon: 'delete', label: t.common.delete, danger: true, onSelect: () => remove(employee) },
                        ]}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && creating && <CreateEmployeeDialog onSubmit={create} onClose={() => setCreating(false)} />}
    </section>
  );
}
