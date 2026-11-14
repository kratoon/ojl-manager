import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { defaultLocale, labels, type Labels, type Locale } from './labels';

const I18nContext = createContext<Labels>(labels[defaultLocale]);

export function I18nProvider({ locale = defaultLocale, children }: { locale?: Locale; children: ReactNode }) {
  const value = useMemo(() => labels[locale], [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = value.app.title;
  }, [locale, value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Returns the labels of the active locale, e.g. `const t = useT(); t.nav.setup`. */
export function useT(): Labels {
  return useContext(I18nContext);
}
