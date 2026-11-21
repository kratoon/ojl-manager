import { useT } from '../i18n/I18nProvider';
import { href } from '../router';
import { Nav } from './Nav';
import { SetupMenu } from './SetupMenu';
import { APP_VERSION } from '../version';

export function Header() {
  const t = useT();
  return (
    <header className="header">
      <a className="header__title" href={href({ name: 'home' })}>
        {t.app.title}
      </a>
      <span className="header__version" title={t.app.version}>
        {`v${APP_VERSION}`}
      </span>
      <Nav />
      <SetupMenu />
    </header>
  );
}
