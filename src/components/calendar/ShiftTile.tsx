import type { Assignment, Employee } from '../../data/schema';
import { useT } from '../../i18n/I18nProvider';
import type { ReasonCode } from '../../schedule/rules';
import type { DayPart } from '../../schedule/shift';
import { LockIcon, WarningIcon } from './icons';

interface ShiftTileProps {
  part: DayPart;
  assignment: Assignment | undefined;
  employee: Employee | undefined;
  closed: boolean;
  warnings: ReasonCode[];
  changed: boolean;
  onSelect?: () => void;
}

/** One day or night slot of a calendar day. Clickable when the user may edit. */
export function ShiftTile({ part, assignment, employee, closed, warnings, changed, onSelect }: ShiftTileProps) {
  const t = useT();
  const manual = assignment?.source === 'manual';
  const classes = ['slot', `slot--${part}`];
  if (!assignment && !closed) classes.push('slot--empty');
  if (closed && !assignment) classes.push('slot--closed');
  if (changed) classes.push('slot--changed');

  const partLabel = part === 'day' ? t.calendar.day : t.calendar.night;
  const name = employee ? `${employee.firstName} ${employee.lastName}` : '';
  const status = !assignment ? (closed ? t.calendar.closed : t.calendar.empty) : '';
  const warningText = warnings.map((w) => t.reasons[w]).join(', ');

  const content = (
    <>
      <span className="slot__label">{partLabel}</span>
      {employee ? (
        <span className="slot__name" title={name}>
          {employee.lastName}
        </span>
      ) : (
        <span className="slot__status">{status}</span>
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
