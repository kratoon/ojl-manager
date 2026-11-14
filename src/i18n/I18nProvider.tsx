import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { defaultLocale, labels, type Labels, type Locale } from './labels';

interface I18nValue {
  locale: Locale;
  labels: Labels;
}

const I18nContext = createContext<I18nValue>({ locale: defaultLocale, labels: labels[defaultLocale] });

export function I18nProvider({ locale = defaultLocale, children }: { locale?: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ locale, labels: labels[locale] }), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = value.labels.app.title;
  }, [locale, value]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Returns the labels of the active locale, e.g. `const t = useT(); t.nav.setup`. */
export function useT(): Labels {
  return useContext(I18nContext).labels;
}

/** Active locale code (e.g. 'cs'), for Intl formatting. */
export function useLocale(): Locale {
  return useContext(I18nContext).locale;
}
