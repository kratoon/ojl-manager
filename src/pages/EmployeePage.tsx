import { EmployeeForm } from '../components/EmployeeForm';
import { useData } from '../data/DataProvider';
import type { Employee } from '../data/schema';
import { useT } from '../i18n/I18nProvider';
import { setPartner } from '../schedule/pattern';
import { href } from '../router';

const backToList = () => {
  window.location.hash = href({ name: 'employees' });
};

/** Edit page for one employee (route #/employees/<id>, requires employees:edit). */
export function EmployeePage({ id }: { id: string }) {
  const t = useT();
  const { state, save } = useData();

  if (state.status === 'loading') return <p>{t.common.loading}</p>;
  if (state.status === 'error') {
    return (
      <p role="alert" className="error">
        {t.employees.loadError}
      </p>
    );
  }

  const { data } = state;
  const employee = data.employees.find((e) => e.id === id);

  const submit = async (next: Employee) => {
    // The pair relation is kept mutual: the partner (and anybody released) is updated as well.
    const replaced = data.employees.map((e) => (e.id === next.id ? next : e));
    await save({ ...data, employees: setPartner(replaced, next.id, next.partnerId) });
    backToList();
  };

  return (
    <section>
      <a className="back-link" href={href({ name: 'employees' })}>
        {t.employees.backToList}
      </a>
      {employee ? (
        <>
          <h1>{t.employees.editTitle}</h1>
          <div className="card">
            <EmployeeForm key={employee.id} extended others={data.employees.filter((e) => e.id !== employee.id)} employee={employee} onSubmit={submit} onCancel={backToList} />
          </div>
        </>
      ) : (
        <p role="alert">{t.employees.notFound}</p>
      )}
    </section>
  );
}
