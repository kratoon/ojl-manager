import { TimeOffSection } from '../components/TimeOffSection';
import { useData } from '../data/DataProvider';
import { useT } from '../i18n/I18nProvider';
import { usePermissions } from '../permissions/PermissionsProvider';

/** All time off of all employees in one table, ordered by date (route #/time-off). */
export function TimeOffPage() {
  const t = useT();
  const { can } = usePermissions();
  const { state } = useData();

  if (state.status === 'loading') return <p>{t.common.loading}</p>;
  if (state.status === 'error') {
    return (
      <p role="alert" className="error">
        {t.employees.loadError}
      </p>
    );
  }
  return (
    <section>
      <div className="page-header">
        <h1>{t.timeOff.title}</h1>
      </div>
      <TimeOffSection data={state.data} canEdit={can('employees:edit')} />
    </section>
  );
}
