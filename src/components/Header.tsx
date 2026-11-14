import { useT } from '../i18n/I18nProvider';
import { usePermissions } from '../permissions/PermissionsProvider';
import { href } from '../router';
import { SetupMenu } from './SetupMenu';

export function Header() {
  const t = useT();
  const { mode } = usePermissions();
  return (
    <header className="header">
      <a className="header__title" href={href({ name: 'home' })}>
        {t.app.title}
      </a>
      <span className="header__right">
        <span className="badge">{t.mode[mode]}</span>
        <SetupMenu />
      </span>
    </header>
  );
}
