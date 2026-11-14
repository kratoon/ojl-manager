import { useT } from '../../i18n/I18nProvider';
import { MoonIcon, SunIcon } from './icons';

/** Explains the "total (day/night)" notation used for shift counts. */
export function ShiftCountsLegend() {
  const t = useT();
  return (
    <span className="preview__legend">
      <strong>{t.calendar.previewTotal}</strong>
      {' ('}
      <span className="preview__legend-item">
        <SunIcon />
        {t.calendar.day}
      </span>
      {' / '}
      <span className="preview__legend-item">
        <MoonIcon />
        {t.calendar.night}
      </span>
      {')'}
    </span>
  );
}
