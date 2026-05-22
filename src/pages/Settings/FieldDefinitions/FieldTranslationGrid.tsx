import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getFieldType } from './fieldTypes';
import api from '../../../api';

interface FieldDef { id: number; fieldKey: string; fieldType: string; }
interface FieldTranslationGridProps {
  targetLang: string;
  fieldDefs: FieldDef[];
  refreshKey: number;
  onDirtyChange: (isDirty: boolean) => void;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export const FieldTranslationGrid = ({
  targetLang, fieldDefs, refreshKey, onDirtyChange,
}: FieldTranslationGridProps) => {
  const { t, i18n } = useTranslation();
  const [translations, setTranslations]   = useState<Record<string, string>>({});
  const [englishSource, setEnglishSource] = useState<Record<string, string>>({});
  const [isDirty,   setIsDirty]   = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [translating, setTranslating] = useState(false);
  const isEnglish = targetLang === 'en';

  // Load translations whenever lang or refreshKey changes
  useEffect(() => {
    const load = async () => {
      try {
        const [transRes, enRes] = await Promise.all([
          api.get(`/field-definitions/translations/${targetLang}`),
          isEnglish ? Promise.resolve(null) : api.get('/field-definitions/translations/en'),
        ]);
        setTranslations(transRes.data);
        setEnglishSource(enRes ? enRes.data : transRes.data);
        setIsDirty(false);
        onDirtyChange(false);
        setSaveStatus('idle');
      } catch (err) {
        console.error('Failed to load field translations', err);
      }
    };
    load();
  }, [targetLang, refreshKey]);

  // Warn on browser close / refresh when there are unsaved changes
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const markDirty = useCallback((next: Record<string, string>) => {
    setTranslations(next);
    setIsDirty(true);
    onDirtyChange(true);
    setSaveStatus('idle');
  }, [onDirtyChange]);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await api.post('/field-definitions/translations/update', { lang: targetLang, translations });
      i18n.addResourceBundle(targetLang, 'translation', translations, true, true);
      setIsDirty(false);
      onDirtyChange(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err) {
      console.error('Save error', err);
      setSaveStatus('error');
    }
  };

  const handleBulkTranslate = async () => {
    if (!window.confirm(`Auto-translate all fields to ${targetLang.toUpperCase()}?`)) return;
    setTranslating(true);
    try {
      const res = await api.post('/ai/translate-bulk', { translations: englishSource, targetLanguage: targetLang });
      if (res.data.success) markDirty({ ...translations, ...res.data.translations });
    } catch (err) {
      console.error('Bulk translate failed', err);
    } finally {
      setTranslating(false);
    }
  };

  if (fieldDefs.length === 0) {
    return (
      <div className="fd-empty">
        <div className="fd-empty-icon">📋</div>
        <p>{t('no_custom_fields')}</p>
      </div>
    );
  }

  return (
    <div className="fd-grid-wrapper">

      {/* Header */}
      <div className="fd-grid-header">
        <div>
          <h3 className="fd-grid-title">
            {t('editing_language')}: <span className="fd-lang-badge">{targetLang.toUpperCase()}</span>
            {isDirty && <span className="fd-unsaved-dot" title="Unsaved changes" />}
          </h3>
          <p className="fd-grid-subtitle">{fieldDefs.length} field{fieldDefs.length !== 1 ? 's' : ''}</p>
        </div>
        {!isEnglish && (
          <button className="fd-ai-btn" onClick={handleBulkTranslate} disabled={translating}>
            {translating
              ? <><Loader2 size={16} className="icon-spin" /> {t('translating')}</>
              : <><Sparkles size={16} /> {t('auto_translate_all')}</>}
          </button>
        )}
      </div>

      {/* Table */}
      <div className="fd-table-container">
        <table className="fd-table">
          <thead>
            <tr>
              <th style={{ width: '140px' }}>{t('field_type_select')}</th>
              <th style={{ width: '180px' }}>{t('field_key_label')}</th>
              {!isEnglish && <th>{t('english_source')}</th>}
              <th>{isEnglish ? t('field_label_label') : t('translation')}</th>
            </tr>
          </thead>
          <tbody>
            {fieldDefs.map(field => {
              const ft = getFieldType(field.fieldType);
              return (
                <tr key={field.id} className="fd-row">
                  <td>
                    <span className="fd-type-badge" style={{ background: ft.color, color: ft.text }}>
                      <span className="fd-type-symbol">{ft.symbol}</span>
                      {ft.label}
                    </span>
                  </td>
                  <td><code className="fd-key-code">{field.fieldKey}</code></td>
                  {!isEnglish && <td className="fd-source-text">{englishSource[field.fieldKey] || ''}</td>}
                  <td>
                    <input
                      className="fd-trans-input"
                      value={translations[field.fieldKey] ?? ''}
                      onChange={e => markDirty({ ...translations, [field.fieldKey]: e.target.value })}
                      placeholder={isEnglish ? t('field_label_hint') : ''}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="fd-grid-actions">
        {saveStatus === 'success' && (
          <span className="fd-status fd-status-success">
            <CheckCircle size={16} /> Saved successfully
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="fd-status fd-status-error">
            <XCircle size={16} /> Save failed — please try again
          </span>
        )}
        {isDirty && saveStatus === 'idle' && (
          <span className="fd-status fd-status-warning">Unsaved changes</span>
        )}
        <button
          className={`fd-save-btn ${isDirty ? 'fd-save-btn-active' : ''}`}
          onClick={handleSave}
          disabled={saveStatus === 'saving' || !isDirty}
        >
          {saveStatus === 'saving' ? t('saving') : t('save_btn')}
        </button>
      </div>
    </div>
  );
};