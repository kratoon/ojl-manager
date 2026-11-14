import type { Assignment, Employee } from '../../data/schema';
import { useT } from '../../i18n/I18nProvider';
import type { ReasonCode } from '../../schedule/rules';
import type { DayPart } from '../../schedule/shift';
import { LockIcon, MoonIcon, SunIcon, WarningIcon } from './icons';

export interface TileEntry {
  assignment: Assignment;
  employee: Employee | undefined;
  warnings: ReasonCode[];
}

interface ShiftTileProps {
  part: DayPart;
  /** Employees on the shift, one per filled seat. */
  entries: TileEntry[];
  /** Seats per shift: missing ones are shown as empty rows. */
  seats: number;
  closed: boolean;
  changed: boolean;
  /** Set while previewing a changed shift: who was assigned before. */
  previous?: Employee[];
  /** Dates of neighbouring months: shown for reference only. */
  outside?: boolean;
  onSelect?: () => void;
}

/** One day or night slot of a calendar day, with a row per seat. Clickable when the user may edit. */
export function ShiftTile({ part, entries, seats, closed, changed, previous, outside, onSelect }: ShiftTileProps) {
  const t = useT();
  const classes = ['slot', `slot--${part}`];
  if (outside) classes.push('slot--outside');
  else {
    if (entries.length === 0 && closed) classes.push('slot--closed');
    if (changed) classes.push('slot--changed');
  }

  const partLabel = part === 'day' ? t.calendar.day : t.calendar.night;
  const fullName = (e: Employee | undefined) => (e ? `${e.firstName} ${e.lastName}` : '');
  const status = closed ? t.calendar.closed : t.calendar.empty;
  const emptySeats = Math.max(seats - entries.length, 0);
  const previousText = previous && previous.length > 0 ? previous.map((e) => e.lastName).join(', ') : t.calendar.previouslyNobody;
  const summary = entries.length > 0 ? entries.map((e) => fullName(e.employee)).join(', ') : status;

  const content = (
    <>
      <span className="slot__line">
        <span className="slot__label" title={partLabel}>
          {part === 'day' ? <SunIcon /> : <MoonIcon />}
        </span>
        <span className="slot__seats">
          {entries.map(({ assignment, employee, warnings }) => {
            const warningText = warnings.map((w) => t.reasons[w]).join(', ');
            return (
              <span key={assignment.employeeId} className="slot__seat">
                <span className="slot__name" title={fullName(employee)}>
                  {employee?.lastName ?? ''}
                </span>
                {warnings.length > 0 && (
                  <span className="slot__icon slot__icon--warning" title={`${t.calendar.warning}: ${warningText}`} role="img" aria-label={`${t.calendar.warning}: ${warningText}`}>
                    <WarningIcon />
                  </span>
                )}
                {assignment.source === 'manual' && (
                  <span className="slot__icon" title={t.calendar.locked} role="img" aria-label={t.calendar.locked}>
                    <LockIcon />
                  </span>
                )}
              </span>
            );
          })}
          {!outside &&
            Array.from({ length: emptySeats }, (_, i) => (
              <span key={`empty-${i}`} className={closed ? 'slot__seat slot__seat--closed' : 'slot__seat slot__seat--empty'}>
                <span className="slot__status">{status}</span>
              </span>
            ))}
        </span>
      </span>
      {previous && (
        <span className="slot__previous" title={`${t.calendar.previously}: ${previous.map(fullName).join(', ') || t.calendar.previouslyNobody}`}>
          {`${t.calendar.previously}: ${previousText}`}
        </span>
      )}
    </>
  );

  if (!onSelect) return <div className={classes.join(' ')}>{content}</div>;
  return (
    <button type="button" className={classes.join(' ')} onClick={onSelect} aria-label={`${partLabel}: ${summary}`}>
      {content}
    </button>
  );
}
