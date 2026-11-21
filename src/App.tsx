import { useEffect } from 'react';
import { Header } from './components/Header';
import { useT } from './i18n/I18nProvider';
import { CalendarPage } from './pages/CalendarPage';
import { CompanyRulesPage } from './pages/CompanyRulesPage';
import { EmployeePage } from './pages/EmployeePage';
import { EmployeesPage } from './pages/EmployeesPage';
import { TimeOffPage } from './pages/TimeOffPage';
import { usePermissions } from './permissions/PermissionsProvider';
import { routePermissions, useRoute } from './router';
import { APP_VERSION } from './version';

export function App() {
  const t = useT();
  const route = useRoute();
  const { can } = usePermissions();

  // The index has no content of its own: send visitors to the calendar.
  useEffect(() => {
    if (route.name === 'home') window.location.replace('#/calendar');
  }, [route.name]);

  let page = null;
  if (route.name === 'home') page = null;
  else if (!can(routePermissions[route.name])) page = <p role="alert">{t.common.noAccess}</p>;
  else if (route.name === 'employees') page = <EmployeesPage />;
  else if (route.name === 'calendar') page = <CalendarPage />;
  else if (route.name === 'rules') page = <CompanyRulesPage />;
  else if (route.name === 'timeOff') page = <TimeOffPage />;
  else if (route.name === 'employee') page = <EmployeePage id={route.id} />;

  return (
    <>
      <Header />
      <main className="content">{page}</main>
      <footer className="footer">{`${t.app.version} ${APP_VERSION}`}</footer>
    </>
  );
}
