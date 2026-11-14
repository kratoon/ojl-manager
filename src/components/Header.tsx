import { useT } from '../i18n/I18nProvider';
import { href } from '../router';
import { SetupMenu } from './SetupMenu';

export function Header() {
  const t = useT();
  return (
    <header className="header">
      <a className="header__title" href={href({ name: 'home' })}>
        {t.app.title}
      </a>
      <SetupMenu />
    </header>
  );
}
