import { Header } from './components/Header';
import { useT } from './i18n/I18nProvider';
import { CalendarPage } from './pages/CalendarPage';
import { CompanyRulesPage } from './pages/CompanyRulesPage';
import { EmployeePage } from './pages/EmployeePage';
import { EmployeesPage } from './pages/EmployeesPage';
import { HomePage } from './pages/HomePage';
import { usePermissions } from './permissions/PermissionsProvider';
import { routePermissions, useRoute } from './router';

export function App() {
  const t = useT();
  const route = useRoute();
  const { can } = usePermissions();

  let page = <HomePage />;
  if (!can(routePermissions[route.name])) page = <p role="alert">{t.common.noAccess}</p>;
  else if (route.name === 'employees') page = <EmployeesPage />;
  else if (route.name === 'calendar') page = <CalendarPage />;
  else if (route.name === 'rules') page = <CompanyRulesPage />;
  else if (route.name === 'employee') page = <EmployeePage id={route.id} />;

  return (
    <>
      <Header />
      <main className="content">{page}</main>
    </>
  );
}
