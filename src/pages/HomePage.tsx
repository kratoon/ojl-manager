import { useT } from '../i18n/I18nProvider';

export function HomePage() {
  const t = useT();
  return <p>{t.home.welcome}</p>;
}
