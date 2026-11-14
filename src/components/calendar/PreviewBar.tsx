import { useLocale, useT } from '../../i18n/I18nProvider';
import type { Data } from '../../data/schema';
import type { Unfilled } from '../../schedule/generator';

interface PreviewBarProps {
  data: Data;
  changed: number;
  unfilled: Unfilled[];
  totals: Record<string, number>;
  onApply(): void;
  onDiscard(): void;
}

/** Sticky bar shown while a regenerate preview is displayed. Nothing is saved until Apply. */
export function PreviewBar({ data, changed, unfilled, totals, onApply, onDiscard }: PreviewBarProps) {
  const t = useT();
  const locale = useLocale();
  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' });
  const dateOf = (date: string) => {
    const [y, m, d] = date.split('-').map(Number) as [number, number, number];
    return fmt.format(new Date(y, m - 1, d));
  };

  return (
    <aside className="preview" aria-label={t.calendar.previewTitle}>
      <div className="preview__summary">
        <strong>{t.calendar.previewTitle}</strong>
        <span>{`${t.calendar.previewChanged}: ${changed}`}</span>
        <span>{`${t.calendar.previewUnfilled}: ${unfilled.length}`}</span>
        <span className="preview__actions">
          <button type="button" className="button" onClick={onDiscard}>
            {t.calendar.previewDiscard}
          </button>
          <button type="button" className="button button--primary" onClick={onApply}>
            {t.calendar.previewApply}
          </button>
        </span>
      </div>
      <details>
        <summary>{t.calendar.previewDetails}</summary>
        <div className="preview__details">
          <h3>{t.calendar.previewTotals}</h3>
          <ul>
            {data.employees.map((e) => (
              <li key={e.id}>{`${e.firstName} ${e.lastName}: ${totals[e.id] ?? 0}`}</li>
            ))}
          </ul>
          {unfilled.length > 0 && (
            <>
              <h3>{t.calendar.previewUnfilledList}</h3>
              <ul>
                {unfilled.slice(0, 50).map((u) => (
                  <li key={`${u.shift.date}:${u.shift.part}`}>
                    {`${dateOf(u.shift.date)} ${u.shift.part === 'day' ? t.calendar.day : t.calendar.night}: ${u.reasons.map((r) => t.reasons[r]).join(', ')}`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </details>
    </aside>
  );
}
