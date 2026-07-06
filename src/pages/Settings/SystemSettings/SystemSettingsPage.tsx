import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, Sparkles, Loader2, CheckCircle, Upload } from 'lucide-react';
import { useSystemSettings } from '../../../contexts/SystemSettingsContext';
import { formatDateTime } from '../../../utils/dateTime';
import { runBulkTranslate, type BulkTranslateProgress } from '../../../utils/bulkTranslateRunner';
import api from '../../../api';
import './SystemSettingsPage.css';

interface Language { code: string; name: string; }
interface MissingEntry { type: string; key: string; englishText: string; }

const FALLBACK_TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Sao_Paulo', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Europe/Madrid',
  'Europe/Rome', 'Europe/Istanbul', 'Asia/Jerusalem', 'Asia/Dubai', 'Asia/Kolkata',
  'Asia/Bangkok', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney', 'Pacific/Auckland',
];

function getTimezones(): string[] {
  try {
    // @ts-ignore — Intl.supportedValuesOf is widely supported in modern browsers but not in older TS lib targets
    const list: string[] = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
    return list.length > 0 ? list : FALLBACK_TIMEZONES;
  } catch {
    return FALLBACK_TIMEZONES;
  }
}

export const SystemSettingsPage = () => {
  const { t } = useTranslation();
  const settings = useSystemSettings();

  const [languages, setLanguages] = useState<Language[]>([]);
  const [languageCode, setLanguageCode] = useState('en');
  const [timezone, setTimezone] = useState('UTC');
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>('24h');

  const [missingCount, setMissingCount] = useState(0);
  const [missingEntries, setMissingEntries] = useState<MissingEntry[]>([]);
  const [checkingMissing, setCheckingMissing] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<BulkTranslateProgress | null>(null);

  const [accelerationInterval, setAccelerationInterval] = useState(5);

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const timezones = getTimezones();

  useEffect(() => {
    api.get<Language[]>('/languages').then(r => setLanguages(r.data)).catch(() => {});
  }, []);

  // Sync local form state once the real settings have loaded from the server
  useEffect(() => {
    if (settings.loading) return;
    setLanguageCode(settings.defaultLanguageCode);
    setTimezone(settings.defaultTimezone);
    setTimeFormat(settings.defaultTimeFormat);
    if ((settings as any).accelerationCronInterval != null) {
      setAccelerationInterval((settings as any).accelerationCronInterval);
    }
  }, [settings.loading, settings.defaultLanguageCode, settings.defaultTimezone, settings.defaultTimeFormat]);

  const checkMissing = async (lang: string) => {
    if (lang === 'en') { setMissingCount(0); setMissingEntries([]); return; }
    setCheckingMissing(true);
    try {
      const res = await api.get('/system-settings/missing-translations', { params: { lang } });
      setMissingCount(res.data.count ?? 0);
      setMissingEntries(res.data.entries ?? []);
    } catch {
      setMissingCount(0);
      setMissingEntries([]);
    } finally {
      setCheckingMissing(false);
    }
  };

  useEffect(() => { checkMissing(languageCode); }, [languageCode]);

  const handleTranslateMissing = async () => {
    if (missingEntries.length === 0) return;
    setTranslating(true);
    try {
      // Composite "type::key" keeps entries from different types (e.g. the same field key
      // used in both ticket_fields and workflow_fields) from colliding in one flat batch.
      const combined: Record<string, string> = {};
      missingEntries.forEach(e => { combined[`${e.type}::${e.key}`] = e.englishText; });

      const result = await runBulkTranslate(combined, languageCode, setBulkProgress);

      const byType: Record<string, Record<string, string>> = {};
      Object.entries(result.translations).forEach(([composite, text]) => {
        const sep = composite.indexOf('::');
        const type = composite.slice(0, sep);
        const key = composite.slice(sep + 2);
        (byType[type] ??= {})[key] = text;
      });

      for (const [type, perTypeTranslations] of Object.entries(byType)) {
        if (type === 'system') {
          await api.post('/languages/update', { lang: languageCode, translations: perTypeTranslations });
        } else {
          await api.post('/field-definitions/translations/update', { lang: languageCode, translations: perTypeTranslations, type });
        }
      }

      if (result.partial) {
        alert(`Translation stopped early: ${result.error}\n\nSaved ${Object.keys(result.translations).length} of ${missingEntries.length} translated fields.`);
      }

      await checkMissing(languageCode);
    } catch (err) {
      console.error('Auto-translate failed', err);
    } finally {
      setTranslating(false);
      setBulkProgress(null);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.post('/system-settings/update', {
        defaultLanguageCode: languageCode,
        defaultTimezone: timezone,
        defaultTimeFormat: timeFormat,
        accelerationCronInterval: accelerationInterval,
      });
      await settings.refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Failed to save system settings', err);
    } finally {
      setSaving(false);
    }
  };

  const handleLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoPreview(URL.createObjectURL(file));
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.post('/system-settings/logo/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await settings.refresh();
    } catch (err) {
      console.error('Logo upload failed', err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const previewNow = new Date();
  const previewOpts = { timezone, hour12: timeFormat === '12h' };

  return (
    <div className="ss-page">
      <div className="ss-header">
        <div className="ss-header-icon"><Settings2 size={22} /></div>
        <div>
          <h2 className="ss-title">{t('system_settings_title')}</h2>
          <p className="ss-subtitle">{t('system_settings_subtitle')}</p>
        </div>
      </div>

      <div className="ss-card">
        <label className="ss-label">{t('default_language_label')}</label>
        <select className="ss-select" value={languageCode} onChange={e => setLanguageCode(e.target.value)}>
          {languages.map(l => (
            <option key={l.code} value={l.code}>{l.name} ({l.code.toUpperCase()})</option>
          ))}
        </select>

        {languageCode !== 'en' && (
          <div className="ss-missing-banner">
            {checkingMissing ? (
              <span className="ss-missing-checking"><Loader2 size={14} className="icon-spin" /> …</span>
            ) : missingCount > 0 ? (
              <>
                <span>{t('missing_translations_banner', { count: missingCount })}</span>
                <button className="ss-ai-btn" onClick={handleTranslateMissing} disabled={translating}>
                  {translating
                    ? <><Loader2 size={14} className="icon-spin" /> {t('translating_missing_fields')}</>
                    : <><Sparkles size={14} /> {t('auto_translate_missing_btn')}</>}
                </button>
              </>
            ) : (
              <span className="ss-missing-ok"><CheckCircle size={14} /> {t('no_missing_translations')}</span>
            )}
          </div>
        )}

        {bulkProgress && bulkProgress.totalBatches > 0 && (
          <div className="ss-bulk-progress">
            <div className="ss-bulk-progress-track">
              <div
                className="ss-bulk-progress-fill"
                style={{ width: `${Math.round((bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100)}%` }}
              />
            </div>
            <div className="ss-bulk-progress-label">
              Batch {bulkProgress.currentBatch} of {bulkProgress.totalBatches} · {bulkProgress.done}/{bulkProgress.total} fields
            </div>
          </div>
        )}
      </div>

      <div className="ss-card">
        <label className="ss-label">{t('default_timezone_label')}</label>
        <select className="ss-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
          {timezones.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
        <p className="ss-clock-preview">{formatDateTime(previewNow, previewOpts)}</p>
      </div>

      <div className="ss-card">
        <label className="ss-label">{t('default_time_format_label')}</label>
        <div className="ss-toggle-group">
          <button
            className={`ss-toggle-btn${timeFormat === '24h' ? ' ss-toggle-btn-active' : ''}`}
            onClick={() => setTimeFormat('24h')}
          >
            {t('time_format_24h')}
          </button>
          <button
            className={`ss-toggle-btn${timeFormat === '12h' ? ' ss-toggle-btn-active' : ''}`}
            onClick={() => setTimeFormat('12h')}
          >
            {t('time_format_12h')}
          </button>
        </div>
      </div>

      <div className="ss-card">
        <label className="ss-label">{t('acceleration_interval_label')}</label>
        <input
          type="number"
          min="0"
          className="ss-select"
          style={{ maxWidth: 100 }}
          value={accelerationInterval}
          onChange={e => setAccelerationInterval(Math.max(0, +e.target.value))}
        />
        <p className="ss-hint">{t('acceleration_interval_hint')}</p>
      </div>

      <div className="ss-card">
        <label className="ss-label">{t('system_logo_label')}</label>
        <p className="ss-hint">{t('system_logo_hint')}</p>
        <div className="ss-logo-row">
          <div className="ss-logo-preview">
            <img src={logoPreview || settings.logoUrl || '/logo.png'} alt="" />
          </div>
          <label className="ss-upload-btn">
            {uploadingLogo ? <Loader2 size={15} className="icon-spin" /> : <Upload size={15} />}
            {t('upload_logo_btn')}
            <input type="file" accept="image/*" hidden onChange={handleLogoFileChange} disabled={uploadingLogo} />
          </label>
        </div>
      </div>

      <div className="ss-actions">
        {saved && <span className="ss-saved-msg"><CheckCircle size={15} /> {t('system_settings_saved')}</span>}
        <button className="ss-save-btn" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={15} className="icon-spin" /> : t('save_btn')}
        </button>
      </div>
    </div>
  );
};
