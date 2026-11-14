import { useEffect, useMemo, useRef } from 'react';
import { calendarMonthsAhead, calendarStart } from '../calendar/config';
import { isSameDay, monthGrid, monthsBetween } from '../calendar/dates';
import { useLocale, useT } from '../i18n/I18nProvider';

// 2024-01-01 is a Monday: used only to ask Intl for localized weekday names.
const mondayReference = (offset: number) => new Date(2024, 0, 1 + offset);

export function CalendarPage() {
  const t = useT();
  const locale = useLocale();
  const today = useMemo(() => new Date(), []);
  const currentRef = useRef<HTMLElement>(null);

  const months = useMemo(() => {
    const end = new Date(today.getFullYear(), today.getMonth() + calendarMonthsAhead, 1);
    return monthsBetween(calendarStart, { year: end.getFullYear(), month: end.getMonth() });
  }, [today]);
  // The current month, or the first one if today is before the calendar start.
  const focus = useMemo(() => {
    const current = months.find((m) => m.year === today.getFullYear() && m.month === today.getMonth());
    return current ?? months[0];
  }, [months, today]);
  const monthName = useMemo(() => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }), [locale]);
  const weekdays = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(mondayReference(i)));
  }, [locale]);

  const focusMonth = (smooth: boolean) => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    currentRef.current?.scrollIntoView({ block: 'start', behavior: smooth && !reduceMotion ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    focusMonth(false);
  }, []);

  return (
    <section>
      <h1>{t.calendar.title}</h1>
      {months.map(({ year, month }) => {
        const isFocus = year === focus?.year && month === focus.month;
        const grid = monthGrid(year, month);
        return (
          <section key={`${year}-${month}`} className="month" ref={isFocus ? currentRef : undefined}>
            <h2 className="month__title">{monthName.format(new Date(year, month, 1))}</h2>
            <div className="month__grid" role="grid">
              <div className="week week--head" role="row">
                {weekdays.map((name) => (
                  <div key={name} className="weekday" role="columnheader">
                    {name}
                  </div>
                ))}
              </div>
              {grid.weeks.map((week, w) => (
                <div key={w} className="week" role="row">
                  {week.map((cell, d) =>
                    cell ? (
                      <div key={d} className={isSameDay(cell.date, today) ? 'day day--today' : 'day'} role="gridcell">
                        <span className="day__number">{cell.day}</span>
                        <div className="slot slot--day">
                          <span className="slot__label">{t.calendar.day}</span>
                        </div>
                        <div className="slot slot--night">
                          <span className="slot__label">{t.calendar.night}</span>
                        </div>
                      </div>
                    ) : (
                      <div key={d} className="day day--empty" role="gridcell" />
                    ),
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })}
      <button type="button" className="button button--primary fab" onClick={() => focusMonth(true)}>
        {t.calendar.currentMonth}
      </button>
    </section>
  );
}
