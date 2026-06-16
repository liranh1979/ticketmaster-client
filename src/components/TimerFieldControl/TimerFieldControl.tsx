import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TimerProgressBar } from '../TimerProgressBar/TimerProgressBar';

interface TimerValue {
  duration_value?: number;
  duration_unit?: string;
  started_at?: string;
  target_datetime?: string;
}

interface Props {
  fieldKey: string;
  value: TimerValue | null | undefined;
  onChange: (key: string, value: TimerValue) => void;
  readOnly: boolean;
  isAdmin: boolean;
}

export const TimerFieldControl = ({ fieldKey, value, onChange, readOnly, isAdmin }: Props) => {
  const { t } = useTranslation();
  const [durationValue, setDurationValue] = useState<number>(
    value?.duration_value ?? 24
  );
  const [durationUnit, setDurationUnit] = useState<string>(
    value?.duration_unit ?? 'hours'
  );

  // Sync local state when value changes from outside
  useEffect(() => {
    if (value?.duration_value != null) setDurationValue(value.duration_value);
    if (value?.duration_unit)          setDurationUnit(value.duration_unit);
  }, [value?.duration_value, value?.duration_unit]);

  const canEdit = isAdmin && !readOnly;

  const handleSet = () => {
    onChange(fieldKey, { duration_value: durationValue, duration_unit: durationUnit });
  };

  const hasTarget = !!value?.target_datetime;

  return (
    <div className="tfc-root">
      {hasTarget && (
        <TimerProgressBar value={value} />
      )}

      {canEdit && (
        <div className="tfc-edit-row">
          <input
            type="number"
            className="tfc-num-input"
            min={1}
            value={durationValue}
            onChange={e => setDurationValue(Math.max(1, parseInt(e.target.value) || 1))}
          />
          <select
            className="tfc-unit-select"
            value={durationUnit}
            onChange={e => setDurationUnit(e.target.value)}
          >
            <option value="minutes">{t('timer_unit_minutes', { defaultValue: 'Minutes' })}</option>
            <option value="hours">{t('timer_unit_hours', { defaultValue: 'Hours' })}</option>
            <option value="days">{t('timer_unit_days', { defaultValue: 'Days' })}</option>
          </select>
          <button className="tfc-set-btn" onClick={handleSet}>
            {hasTarget ? 'Update timer' : 'Set timer'}
          </button>
        </div>
      )}

      {!hasTarget && !canEdit && (
        <span className="tfc-not-set">{t('timer_not_set', { defaultValue: 'Not set' })}</span>
      )}
    </div>
  );
};
