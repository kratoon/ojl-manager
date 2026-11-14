import type { Assignment, Employee } from '../../data/schema';
import { useT } from '../../i18n/I18nProvider';
import type { ReasonCode } from '../../schedule/rules';
import type { DayPart } from '../../schedule/shift';
import { LockIcon, MoonIcon, SunIcon, WarningIcon } from './icons';

interface ShiftTileProps {
  part: DayPart;
  assignment: Assignment | undefined;
  employee: Employee | undefined;
  closed: boolean;
  warnings: ReasonCode[];
  changed: boolean;
  /** Set while previewing a changed shift: who was assigned before (employee undefined = nobody). */
  previous?: { employee: Employee | undefined };
  /** Dates of neighbouring months: shown for reference only. */
  outside?: boolean;
  onSelect?: () => void;
}

/** One day or night slot of a calendar day. Clickable when the user may edit. */
export function ShiftTile({ part, assignment, employee, closed, warnings, changed, previous, outside, onSelect }: ShiftTileProps) {
  const t = useT();
  const manual = assignment?.source === 'manual';
  const classes = ['slot', `slot--${part}`];
  if (outside) classes.push('slot--outside');
  else {
    if (!assignment && !closed) classes.push('slot--empty');
    if (closed && !assignment) classes.push('slot--closed');
    if (changed) classes.push('slot--changed');
  }

  if (manual || warnings.length > 0) classes.push('slot--icons');

  const partLabel = part === 'day' ? t.calendar.day : t.calendar.night;
  const name = employee ? `${employee.firstName} ${employee.lastName}` : '';
  const status = !assignment ? (closed ? t.calendar.closed : t.calendar.empty) : '';
  const warningText = warnings.map((w) => t.reasons[w]).join(', ');
  const previousName = previous?.employee ? `${previous.employee.firstName} ${previous.employee.lastName}` : t.calendar.previouslyNobody;

  const content = (
    <>
      <span className="slot__line">
        <span className="slot__label" title={partLabel}>
          {part === 'day' ? <SunIcon /> : <MoonIcon />}
        </span>
        {employee ? (
          <span className="slot__name" title={name}>
            {employee.lastName}
          </span>
        ) : (
          <span className="slot__status">{status}</span>
        )}
      </span>
      {previous && (
        <span className="slot__previous" title={`${t.calendar.previously}: ${previousName}`}>
          {`${t.calendar.previously}: ${previous.employee?.lastName ?? previousName}`}
        </span>
      )}
      <span className="slot__icons">
        {warnings.length > 0 && (
          <span className="slot__icon slot__icon--warning" title={`${t.calendar.warning}: ${warningText}`} role="img" aria-label={`${t.calendar.warning}: ${warningText}`}>
            <WarningIcon />
          </span>
        )}
        {manual && (
          <span className="slot__icon" title={t.calendar.locked} role="img" aria-label={t.calendar.locked}>
            <LockIcon />
          </span>
        )}
      </span>
    </>
  );

  if (!onSelect) return <div className={classes.join(' ')}>{content}</div>;
  return (
    <button type="button" className={classes.join(' ')} onClick={onSelect} aria-label={`${partLabel}: ${name || status}`}>
      {content}
    </button>
  );
}
