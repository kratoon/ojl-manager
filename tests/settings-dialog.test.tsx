import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { SettingsDialog } from '../src/components/calendar/SettingsDialog';
import { companySchema } from '../src/data/schema';
import { I18nProvider } from '../src/i18n/I18nProvider';

const render = (company: unknown) =>
  renderToString(
    <I18nProvider>
      <SettingsDialog company={companySchema.parse(company)} onSave={async () => {}} onClose={() => {}} />
    </I18nProvider>,
  );

describe('score example in the settings dialog', () => {
  it('uses the real weights: with the defaults the rotation wins', () => {
    const html = render({});
    expect(html).toContain('Jak se počítá skóre');
    expect(html).toContain('váha 40');
    expect(html).toContain('7,9');
    expect(html).toContain('4,9');
    expect(html).toContain('Vybrán bude zaměstnanec 1.');
  });

  it('follows the configured weights: a weak pattern loses to the other rules', () => {
    const html = render({ weightsVersion: 2, fairnessWeight: 20, kindBalanceWeight: 10, pattern: { weight: 10 } });
    expect(html).toContain('váha 10');
    expect(html).toContain('6,3'); // (10*10 + 5*20 + 5*10) / 40 = 6.25
    expect(html).toContain('7,8'); // (1*10 + 10*20 + 10*10) / 40 = 7.75
    expect(html).toContain('Vybrán bude zaměstnanec 2.');
  });
});
