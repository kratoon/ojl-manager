import { useState } from 'react';
import type { Company } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import {
  patternDominates,
  settingRanges,
  validateNumber,
  type NumberSetting,
  type SettingError,
} from '../../schedule/settings';
import { Modal } from '../Modal';

interface SettingsDialogProps {
  company: Company;
  onSave(next: Company): Promise<void>;
  onClose(): void;
}

type Values = Record<NumberSetting, string>;

/** The values of a fresh data file. */
const defaults: Values = {
  patternWeight: String(settingRanges.patternWeight.fallback),
  fairnessWeight: String(settingRanges.fairnessWeight.fallback),
  kindBalanceWeight: String(settingRanges.kindBalanceWeight.fallback),
  fairnessCap: String(settingRanges.fairnessCap.fallback),
  compensationGap: String(settingRanges.compensationGap.fallback),
};

function initial(company: Company): Values {
  return {
    patternWeight: String(company.pattern.weight),
    fairnessWeight: String(company.fairnessWeight),
    kindBalanceWeight: String(company.kindBalanceWeight),
    fairnessCap: String(company.fairnessCap),
    compensationGap: String(company.pattern.compensationGap),
  };
}

interface ScoreExampleProps {
  pattern: number;
  fairness: number;
  kind: number;
}

/** The weighted average of rule scores, explained with two example employees and the weights being edited. */
function ScoreExample({ pattern, fairness, kind }: ScoreExampleProps) {
  const t = useT();
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), template);

  // Scores each rule gives the two employees in the example (1 to 10).
  const rules = [
    { name: t.settings.scoreRulePattern, weight: pattern, first: 10, second: 1 },
    { name: t.settings.scoreRuleFairness, weight: fairness, first: 5, second: 10 },
    { name: t.settings.scoreRuleKind, weight: kind, first: 5, second: 10 },
  ];
  const total = rules.reduce((sum, r) => sum + r.weight, 0);
  const final = (pick: 'first' | 'second') => rules.reduce((sum, r) => sum + r[pick] * r.weight, 0) / total;
  const a = final('first');
  const b = final('second');
  const winner = Math.abs(a - b) < 1e-9 ? t.settings.scoreTie : fill(t.settings.scoreWinner, { n: a > b ? '1' : '2' });

  return (
    <details className="score-help">
      <summary>{t.settings.scoreTitle}</summary>
      <p className="hint">{t.settings.scoreIntro}</p>
      <p className="hint">{t.settings.scoreExample}</p>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{t.settings.scoreEmployee}</th>
              {rules.map((r) => (
                <th key={r.name} scope="col" className="num">
                  {fill(t.settings.scoreColumn, { name: r.name, weight: fmt.format(r.weight) })}
                </th>
              ))}
              <th scope="col" className="num">
                {t.settings.scoreFinal}
              </th>
            </tr>
          </thead>
          <tbody>
            {(['first', 'second'] as const).map((pick) => (
              <tr key={pick}>
                <th scope="row">{pick === 'first' ? t.settings.scoreOnPattern : t.settings.scoreOffPattern}</th>
                {rules.map((r) => (
                  <td key={r.name} className="num">
                    {r[pick]}
                  </td>
                ))}
                <td className="num">
                  <strong>{fmt.format(final(pick))}</strong>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="hint">
        {rules.map((r) => `${fmt.format(r.weight)}`).join(' + ')}
        {` = ${fmt.format(total)}. `}
        <strong>{winner}</strong>
      </p>
      <p className="hint">{t.settings.scoreNotes}</p>
    </details>
  );
}

/** Scheduling numbers of the generator with a help text, the allowed range and validation for each. */
export function SettingsDialog({ company, onSave, onClose }: SettingsDialogProps) {
  const t = useT();
  const locale = useLocale();
  const fmt = new Intl.NumberFormat(locale);
  const [values, setValues] = useState<Values>(() => initial(company));
  const [saveError, setSaveError] = useState(false);

  const fill = (template: string, vars: Record<string, string>) =>
    Object.entries(vars).reduce((text, [k, v]) => text.replaceAll(`{${k}}`, v), template);

  const errors: Record<NumberSetting, SettingError | null> = {
    patternWeight: validateNumber(values.patternWeight, settingRanges.patternWeight),
    fairnessWeight: validateNumber(values.fairnessWeight, settingRanges.fairnessWeight),
    kindBalanceWeight: validateNumber(values.kindBalanceWeight, settingRanges.kindBalanceWeight),
    fairnessCap: validateNumber(values.fairnessCap, settingRanges.fairnessCap),
    compensationGap: validateNumber(values.compensationGap, settingRanges.compensationGap),
  };
  const valid = Object.values(errors).every((e) => e === null);
  // Checked only on valid numbers: the rotation has to outweigh everything else together.
  const dominates = !valid || patternDominates(Number(values.patternWeight), [Number(values.fairnessWeight), Number(values.kindBalanceWeight)]);

  const errorText = (key: NumberSetting, error: SettingError) => {
    const r = settingRanges[key];
    if (error === 'range') return fill(t.settings.errorRange, { min: fmt.format(r.min), max: fmt.format(r.max) });
    return t.settings.errorRequired;
  };

  /** The number being typed when it is valid, otherwise the saved one: the example never shows nonsense. */
  const weightOf = (key: NumberSetting, saved: number) => (errors[key] === null ? Number(values[key]) : saved);

  async function submit() {
    if (!valid) return;
    setSaveError(false);
    try {
      await onSave({
        ...company,
        fairnessWeight: Number(values.fairnessWeight),
        kindBalanceWeight: Number(values.kindBalanceWeight),
        fairnessCap: Number(values.fairnessCap),
        pattern: {
          ...company.pattern,
          weight: Number(values.patternWeight),
          compensationGap: Number(values.compensationGap),
        },
      });
    } catch {
      setSaveError(true);
    }
  }

  function numberField(key: NumberSetting, label: string, help: string, scale: string) {
    const r = settingRanges[key];
    const error = errors[key];
    return (
      <div className="setting" key={key}>
        <label className="field">
          <span>{label}</span>
          <input
            type="number"
            inputMode="decimal"
            min={r.min}
            max={r.max}
            step={r.step}
            value={values[key]}
            aria-invalid={error !== null}
            aria-describedby={`${key}-help`}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </label>
        <div id={`${key}-help`} className="setting__help">
          <p className="hint">{help}</p>
          <p className="hint">{scale}</p>
          <p className="hint">{fill(t.settings.range, { min: fmt.format(r.min), max: fmt.format(r.max), default: fmt.format(r.fallback) })}</p>
        </div>
        {error && (
          <p role="alert" className="error">
            {errorText(key, error)}
          </p>
        )}
      </div>
    );
  }

  return (
    <Modal title={t.settings.title} wide onClose={onClose}>
      <form
        className="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="hint">{t.settings.intro}</p>
        <p className="hint">{t.settings.weightsHint}</p>
        <ScoreExample
          pattern={weightOf('patternWeight', company.pattern.weight)}
          fairness={weightOf('fairnessWeight', company.fairnessWeight)}
          kind={weightOf('kindBalanceWeight', company.kindBalanceWeight)}
        />

        <fieldset className="vacations">
          <legend>{t.settings.patternTitle}</legend>
          {numberField('patternWeight', t.settings.patternWeight, t.settings.patternWeightHelp, t.settings.patternWeightScale)}
          {numberField('compensationGap', t.settings.compensationGap, t.settings.compensationGapHelp, t.settings.compensationGapScale)}
        </fieldset>

        <fieldset className="vacations">
          <legend>{t.settings.fairnessTitle}</legend>
          {numberField('fairnessWeight', t.settings.fairnessWeight, t.settings.fairnessWeightHelp, t.settings.fairnessWeightScale)}
          {numberField('kindBalanceWeight', t.settings.kindBalanceWeight, t.settings.kindBalanceWeightHelp, t.settings.kindBalanceWeightScale)}
          {numberField('fairnessCap', t.settings.fairnessCap, t.settings.fairnessCapHelp, t.settings.fairnessCapScale)}
        </fieldset>

        {!dominates && (
          <p role="status" className="warning">
            {t.settings.patternNotDominant}
          </p>
        )}
        {saveError && (
          <p role="alert" className="error">
            {t.employees.saveError}
          </p>
        )}
        <div className="form__actions">
          <button type="button" className="button form__actions-start" onClick={() => setValues(defaults)}>
            {t.settings.reset}
          </button>
          <button type="button" className="button" onClick={onClose}>
            {t.common.cancel}
          </button>
          <button type="submit" className="button button--primary" disabled={!valid}>
            {t.common.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
