import { useState } from 'react';
import { patternSettingsSchema, type Company } from '../../data/schema';
import { useLocale, useT } from '../../i18n/I18nProvider';
import {
  settingRanges,
  validateMonday,
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

type Values = Record<NumberSetting, string> & { anchor: string };

/** The values of a fresh data file. */
const defaults: Values = {
  patternWeight: String(settingRanges.patternWeight.fallback),
  fairnessWeight: String(settingRanges.fairnessWeight.fallback),
  kindBalanceWeight: String(settingRanges.kindBalanceWeight.fallback),
  fairnessCap: String(settingRanges.fairnessCap.fallback),
  compensationGap: String(settingRanges.compensationGap.fallback),
  anchor: patternSettingsSchema.parse({}).anchor,
};

function initial(company: Company): Values {
  return {
    patternWeight: String(company.pattern.weight),
    fairnessWeight: String(company.fairnessWeight),
    kindBalanceWeight: String(company.kindBalanceWeight),
    fairnessCap: String(company.fairnessCap),
    compensationGap: String(company.pattern.compensationGap),
    anchor: company.pattern.anchor,
  };
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

  const errors: Record<keyof Values, SettingError | null> = {
    patternWeight: validateNumber(values.patternWeight, settingRanges.patternWeight),
    fairnessWeight: validateNumber(values.fairnessWeight, settingRanges.fairnessWeight),
    kindBalanceWeight: validateNumber(values.kindBalanceWeight, settingRanges.kindBalanceWeight),
    fairnessCap: validateNumber(values.fairnessCap, settingRanges.fairnessCap),
    compensationGap: validateNumber(values.compensationGap, settingRanges.compensationGap),
    anchor: validateMonday(values.anchor),
  };
  const valid = Object.values(errors).every((e) => e === null);

  const errorText = (key: NumberSetting, error: SettingError) => {
    const r = settingRanges[key];
    if (error === 'range') return fill(t.settings.errorRange, { min: fmt.format(r.min), max: fmt.format(r.max) });
    if (error === 'monday') return t.settings.errorMonday;
    return t.settings.errorRequired;
  };

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
          anchor: values.anchor,
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

        <fieldset className="vacations">
          <legend>{t.settings.patternTitle}</legend>
          {numberField('patternWeight', t.settings.patternWeight, t.settings.patternWeightHelp, t.settings.patternWeightScale)}
          {numberField('compensationGap', t.settings.compensationGap, t.settings.compensationGapHelp, t.settings.compensationGapScale)}
          <div className="setting">
            <label className="field">
              <span>{t.settings.patternAnchor}</span>
              <input
                type="date"
                value={values.anchor}
                aria-invalid={errors.anchor !== null}
                aria-describedby="anchor-help"
                onChange={(e) => setValues((v) => ({ ...v, anchor: e.target.value }))}
              />
            </label>
            <div id="anchor-help" className="setting__help">
              <p className="hint">{t.settings.patternAnchorHelp}</p>
              <p className="hint">{t.settings.patternAnchorScale}</p>
            </div>
            {errors.anchor && (
              <p role="alert" className="error">
                {errors.anchor === 'monday' ? t.settings.errorMonday : t.settings.errorRequired}
              </p>
            )}
          </div>
        </fieldset>

        <fieldset className="vacations">
          <legend>{t.settings.fairnessTitle}</legend>
          {numberField('fairnessWeight', t.settings.fairnessWeight, t.settings.fairnessWeightHelp, t.settings.fairnessWeightScale)}
          {numberField('kindBalanceWeight', t.settings.kindBalanceWeight, t.settings.kindBalanceWeightHelp, t.settings.kindBalanceWeightScale)}
          {numberField('fairnessCap', t.settings.fairnessCap, t.settings.fairnessCapHelp, t.settings.fairnessCapScale)}
        </fieldset>

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
