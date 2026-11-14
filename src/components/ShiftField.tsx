import { useId } from 'react';
import type { Shift } from '../schedule/shift';
import { useT } from '../i18n/I18nProvider';

interface ShiftFieldProps {
  label: string;
  value: Shift | undefined;
  onChange(value: Shift | undefined): void;
  /** Earliest selectable date (ISO). */
  minDate?: string;
}

/** Picks a shift: a date plus the day or the night shift (ADR-fec8e13). Empty date = no value. */
export function ShiftField({ label, value, onChange, minDate }: ShiftFieldProps) {
  const t = useT();
  const id = useId();
  const part = value?.part ?? 'day';
  return (
    <div className="field" role="group" aria-labelledby={id}>
      <span id={id}>{label}</span>
      <div className="shift-field">
        <input
          type="date"
          min={minDate}
          aria-label={`${label}: ${t.shift.date}`}
          value={value?.date ?? ''}
          onChange={(e) => onChange(e.target.value ? { date: e.target.value, part } : undefined)}
        />
        <select
          aria-label={`${label}: ${t.shift.part}`}
          value={part}
          disabled={!value}
          onChange={(e) => value && onChange({ date: value.date, part: e.target.value as Shift['part'] })}
        >
          <option value="day">{t.calendar.day}</option>
          <option value="night">{t.calendar.night}</option>
        </select>
      </div>
    </div>
  );
}
