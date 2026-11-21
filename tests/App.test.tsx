import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { App } from '../src/App';
import { DataProvider } from '../src/data/DataProvider';
import { MemoryDataStore } from '../src/data/DataStore';
import { I18nProvider } from '../src/i18n/I18nProvider';
import { PermissionsProvider } from '../src/permissions/PermissionsProvider';
import { defaultLocale, labels } from '../src/i18n/labels';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('labels', () => {
  it('defaults to Czech', () => {
    expect(defaultLocale).toBe('cs');
  });

  it('has identical keys in every locale', () => {
    const reference = keys(labels[defaultLocale]).sort();
    for (const locale of Object.values(labels)) {
      expect(keys(locale).sort()).toEqual(reference);
    }
  });

  it('has no empty labels', () => {
    for (const locale of Object.values(labels)) {
      for (const key of keys(locale)) {
        const value = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], locale);
        expect(value, key).not.toBe('');
      }
    }
  });
});

describe('App', () => {
  it('renders the header with the setup button in Czech by default', () => {
    const html = renderToString(
      <I18nProvider>
        <PermissionsProvider>
          <DataProvider store={new MemoryDataStore()}>
            <App />
          </DataProvider>
        </PermissionsProvider>
      </I18nProvider>,
    );
    expect(html).toContain('OJL Manager');
    expect(html).toContain('aria-label="Nastavení"');
    expect(html).toContain('aria-label="Soubor"');
  });
});
