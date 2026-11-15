import { useMemo, useState } from 'react';
import { useData } from '../data/DataProvider';
import type { Data, Employee, Vacation } from '../data/schema';
import { useT } from '../i18n/I18nProvider';
import { toIsoDate } from '../schedule/shift';
import { collectTimeOff, removeTimeOff, upsertTimeOff, type TimeOffRow } from '../schedule/timeOff';
import { TimeOffDialog } from './TimeOffDialog';
import { TimeOffTable } from './TimeOffTable';

interface TimeOffSectionProps {
  data: Data;
  /** Only this employee's time off (the employee page). Without it: everybody's, with an Employee column. */
  employee?: Employee;
  canEdit: boolean;
}

/** The time off table with its add/edit dialog and delete, saved straight to the data. */
export function TimeOffSection({ data, employee, canEdit }: TimeOffSectionProps) {
  const t = useT();
  const { save } = useData();
  const today = useMemo(() => toIsoDate(new Date()), []);
  const [dialog, setDialog] = useState<{ row?: TimeOffRow } | null>(null);

  const rows = useMemo(() => collectTimeOff(employee ? [employee] : data.employees), [data.employees, employee]);

  async function persist(employeeId: string, vacation: Vacation, previousEmployeeId?: string) {
    await save({ ...data, employees: upsertTimeOff(data.employees, employeeId, vacation, previousEmployeeId) });
    setDialog(null);
  }

  async function remove(row: TimeOffRow) {
    if (!window.confirm(t.timeOff.deleteConfirm)) return;
    await save({ ...data, employees: removeTimeOff(data.employees, row.employee.id, row.vacation.id) });
  }

  return (
    <>
      <TimeOffTable
        rows={rows}
        showEmployee={!employee}
        today={today}
        canEdit={canEdit}
        onAdd={() => setDialog({})}
        onEdit={(row) => setDialog({ row })}
        onDelete={(row) => void remove(row)}
      />
      {canEdit && dialog && (
        <TimeOffDialog
          row={dialog.row}
          employees={employee ? undefined : data.employees}
          employeeId={employee?.id}
          onSave={persist}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
