import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import './HoursOfOperationEditor.css';

interface DaySchedule {
  day_of_week: number;
  is_open: boolean;
  slot1_start: string | null;
  slot1_end:   string | null;
  slot2_start: string | null;
  slot2_end:   string | null;
}

interface HoursOfOperationDto {
  days: DaySchedule[];
  timezone: string;
}

interface Props {
  companyId?: number | null;   // null/undefined = global
  timezone?: string;
  onSaved?: () => void;
}

const DAY_KEYS = ['hoo_day_0','hoo_day_1','hoo_day_2','hoo_day_3','hoo_day_4','hoo_day_5','hoo_day_6'];

const DEFAULT_DAYS: DaySchedule[] = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i, is_open: true,
  slot1_start: null, slot1_end: null, slot2_start: null, slot2_end: null,
}));

export const HoursOfOperationEditor = ({ companyId, timezone: initialTz, onSaved }: Props) => {
  const { t } = useTranslation();
  const [days, setDays]         = useState<DaySchedule[]>(DEFAULT_DAYS);
  const [timezone, setTimezone] = useState(initialTz ?? 'UTC');
  const [aiText, setAiText]     = useState('');
  const [parsing, setParsing]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [saveMsg, setSaveMsg]   = useState('');

  useEffect(() => {
    const url = companyId != null ? `/companies/${companyId}/hours` : '/companies/global/hours';
    api.get<HoursOfOperationDto>(url)
      .then(r => {
        if (r.data.days?.length === 7) setDays(r.data.days);
        if (r.data.timezone) setTimezone(r.data.timezone);
      })
      .catch(() => {});
  }, [companyId]);

  const update = (idx: number, patch: Partial<DaySchedule>) =>
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, ...patch } : d));

  const handleParse = async () => {
    if (!aiText.trim()) return;
    setParsing(true);
    try {
      const res = await api.post<DaySchedule[]>('/companies/hours/parse-ai', { text: aiText });
      if (res.data?.length === 7) setDays(res.data);
    } catch { /* ignore */ }
    finally { setParsing(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const url = companyId != null ? `/companies/${companyId}/hours` : '/companies/global/hours';
      await api.put(url, { days, timezone });
      setSaveMsg(t('hoo_save_success'));
      onSaved?.();
      setTimeout(() => setSaveMsg(''), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="hoo-editor">
      {/* AI input */}
      <div className="hoo-ai-panel">
        <div className="hoo-ai-label">{t('hoo_ai_label')}</div>
        <div className="hoo-ai-hint">{t('hoo_ai_hint')}</div>
        <div className="hoo-ai-row">
          <textarea
            className="hoo-ai-textarea"
            value={aiText}
            onChange={e => setAiText(e.target.value)}
            placeholder={t('hoo_ai_label')}
          />
          <button className="hoo-ai-btn" onClick={handleParse} disabled={parsing || !aiText.trim()}>
            {parsing ? t('hoo_ai_parsing') : t('hoo_ai_btn')}
          </button>
        </div>
      </div>

      {/* Day grid */}
      <div className="hoo-grid">
        {days.map((day, idx) => (
          <div key={day.day_of_week} className={`hoo-row ${!day.is_open ? 'hoo-row--closed' : ''}`}>
            <span className="hoo-day-name">{t(DAY_KEYS[day.day_of_week])}</span>

            <label className="hoo-toggle">
              <input
                type="checkbox"
                checked={day.is_open}
                onChange={e => update(idx, { is_open: e.target.checked })}
              />
              <span className="hoo-toggle-label">{day.is_open ? t('hoo_open') : t('hoo_closed')}</span>
            </label>

            <div className="hoo-times">
              <input type="time" className="hoo-time-input" disabled={!day.is_open}
                value={day.slot1_start ?? ''} placeholder="--:--"
                onChange={e => update(idx, { slot1_start: e.target.value || null })} />
              <span className="hoo-sep">—</span>
              <input type="time" className="hoo-time-input" disabled={!day.is_open}
                value={day.slot1_end ?? ''} placeholder="--:--"
                onChange={e => update(idx, { slot1_end: e.target.value || null })} />

              {day.is_open && day.slot2_start == null && (
                <button className="hoo-break-btn"
                  onClick={() => update(idx, { slot1_end: day.slot1_end ?? '12:00', slot2_start: '13:00', slot2_end: day.slot2_end ?? '17:00' })}>
                  {t('hoo_add_break')}
                </button>
              )}

              {day.is_open && day.slot2_start != null && (
                <>
                  <span className="hoo-sep">|</span>
                  <input type="time" className="hoo-time-input"
                    value={day.slot2_start ?? ''} placeholder="--:--"
                    onChange={e => update(idx, { slot2_start: e.target.value || null })} />
                  <span className="hoo-sep">—</span>
                  <input type="time" className="hoo-time-input"
                    value={day.slot2_end ?? ''} placeholder="--:--"
                    onChange={e => update(idx, { slot2_end: e.target.value || null })} />
                  <button className="hoo-break-btn hoo-break-btn--remove"
                    onClick={() => update(idx, { slot2_start: null, slot2_end: null })}>
                    {t('hoo_remove_break')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="hoo-save-row">
        <button className="hoo-save-btn" onClick={handleSave} disabled={saving}>
          {t('hoo_save_btn')}
        </button>
        {saveMsg && <span className="hoo-save-msg">{saveMsg}</span>}
      </div>
    </div>
  );
};
