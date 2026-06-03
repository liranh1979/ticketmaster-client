import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { getFieldType } from './fieldTypes';
import api from '../../../api';

interface FieldDef { id: number; fieldKey: string; fieldType: string; fieldOptions?: string[]; }
interface FieldTranslationGridProps {
  targetLang: string;
  fieldDefs: FieldDef[];
  refreshKey: number;
  translationType: string;
  onDirtyChange: (isDirty: boolean) => void;
}

type SaveStatus = 'idle' | 'saving' | 'success' | 'error';

export const FieldTranslationGrid = ({
  targetLang, fieldDefs, refreshKey, translationType, onDirtyChange,
}: FieldTranslationGridProps) => {
  const { t, i18n } = useTranslation();
  const [translations, setTranslations]   = useState<Record<string, string>>({});
  const [englishSource, setEnglishSource] = useState<Record<string, string>>({});
  const [isDirty,   setIsDirty]   = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [translating, setTranslating] = useState(false);
  const isEnglish = targetLang === 'en';

  // Options editor state
  const [optionsOpen, setOptionsOpen]   = useState<Record<number, boolean>>({});
  const [optionDrafts, setOptionDrafts] = useState<Record<number, string[]>>({});
  const [optionInputs, setOptionInputs] = useState<Record<number, string>>({});
  const [savingOpts, setSavingOpts]     = useState<Record<number, boolean>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const [transRes, enRes] = await Promise.all([
          api.get(`/field-definitions/translations/${targetLang}`, { params: { translationType } }),
          isEnglish ? Promise.resolve(null) : api.get('/field-definitions/translations/en', { params: { translationType } }),
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
      await api.post('/field-definitions/translations/update', { lang: targetLang, translations, type: translationType });
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
    if (!window.confirm(t('confirm_bulk_translate', { lang: targetLang.toUpperCase() }))) return;
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

  const toggleOptions = (field: FieldDef) => {
    const next = !optionsOpen[field.id];
    setOptionsOpen(prev => ({ ...prev, [field.id]: next }));
    if (next && optionDrafts[field.id] === undefined) {
      setOptionDrafts(prev => ({ ...prev, [field.id]: field.fieldOptions ?? [] }));
    }
  };

  const addOptionToDraft = (fieldId: number) => {
    const val = (optionInputs[fieldId] ?? '').trim();
    if (!val || (optionDrafts[fieldId] ?? []).includes(val)) return;
    setOptionDrafts(prev => ({ ...prev, [fieldId]: [...(prev[fieldId] ?? []), val] }));
    setOptionInputs(prev => ({ ...prev, [fieldId]: '' }));
  };

  const removeOptionFromDraft = (fieldId: number, i: number) => {
    setOptionDrafts(prev => ({ ...prev, [fieldId]: prev[fieldId].filter((_, j) => j !== i) }));
  };

  const saveOptions = async (fieldId: number) => {
    setSavingOpts(prev => ({ ...prev, [fieldId]: true }));
    try {
      await api.patch(`/field-definitions/${fieldId}/options`, optionDrafts[fieldId] ?? []);
      setOptionsOpen(prev => ({ ...prev, [fieldId]: false }));
    } catch (err) {
      console.error('Failed to save options', err);
    } finally {
      setSavingOpts(prev => ({ ...prev, [fieldId]: false }));
    }
  };

  const colSpan = isEnglish ? 3 : 4;

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

      <div className="fd-grid-header">
        <div>
          <h3 className="fd-grid-title">
            {t('editing_language')}: <span className="fd-lang-badge">{targetLang.toUpperCase()}</span>
            {isDirty && <span className="fd-unsaved-dot" title="Unsaved changes" />}
          </h3>
          <p className="fd-grid-subtitle">{t('fields_count', { count: fieldDefs.length })}</p>
        </div>
        {!isEnglish && (
          <button className="fd-ai-btn" onClick={handleBulkTranslate} disabled={translating}>
            {translating
              ? <><Loader2 size={16} className="icon-spin" /> {t('translating')}</>
              : <><Sparkles size={16} /> {t('auto_translate_all')}</>}
          </button>
        )}
      </div>

      <div className="fd-table-container">
        <table className="fd-table">
          <thead>
            <tr>
              <th style={{ width: '160px' }}>{t('field_type_select')}</th>
              <th style={{ width: '180px' }}>{t('field_key_label')}</th>
              {!isEnglish && <th>{t('english_source')}</th>}
              <th>{isEnglish ? t('field_label_label') : t('translation')}</th>
            </tr>
          </thead>
          <tbody>
            {fieldDefs.map(field => {
              const ft = getFieldType(field.fieldType);
              const isCombobox = field.fieldType === 'combobox';
              const isOpen = !!optionsOpen[field.id];
              const drafts = optionDrafts[field.id] ?? field.fieldOptions ?? [];
              return (
                <React.Fragment key={field.id}>
                  <tr className="fd-row">
                    <td>
                      <div className="fd-type-cell">
                        <span className="fd-type-badge" style={{ background: ft.color, color: ft.text }}>
                          <span className="fd-type-symbol">{ft.symbol}</span>
                          {ft.label}
                        </span>
                        {isCombobox && (
                          <button
                            className={`fd-options-toggle ${isOpen ? 'fd-options-toggle-active' : ''}`}
                            onClick={() => toggleOptions(field)}
                          >
                            {t('edit_options_btn')}
                          </button>
                        )}
                      </div>
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

                  {isCombobox && isOpen && (
                    <tr className="fd-options-row">
                      <td colSpan={colSpan}>
                        <div className="fd-options-editor">
                          <div className="fd-options-chips">
                            {drafts.length === 0 && (
                              <span className="fd-options-empty">{t('no_options_yet')}</span>
                            )}
                            {drafts.map((opt, i) => (
                              <span key={i} className="fd-option-chip">
                                {opt}
                                <button className="fd-option-chip-remove" onClick={() => removeOptionFromDraft(field.id, i)}>×</button>
                              </span>
                            ))}
                          </div>
                          <div className="fd-options-add-row">
                            <input
                              className="fd-input fd-options-add-input"
                              placeholder={t('add_option_placeholder')}
                              value={optionInputs[field.id] ?? ''}
                              onChange={e => setOptionInputs(prev => ({ ...prev, [field.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOptionToDraft(field.id); } }}
                            />
                            <button
                              className="fd-options-add-btn"
                              onClick={() => addOptionToDraft(field.id)}
                              disabled={!(optionInputs[field.id] ?? '').trim()}
                            >+</button>
                            <button
                              className="fd-options-save-btn"
                              onClick={() => saveOptions(field.id)}
                              disabled={savingOpts[field.id]}
                            >
                              {savingOpts[field.id] ? '...' : t('save_btn')}
                            </button>
                          </div>

                          {/* Option-value translations — one input per option */}
                          {drafts.length > 0 && (
                            <div className="fd-option-translations">
                              <p className="fd-option-translations-label">{t('option_translations_label') || 'Option Labels'}</p>
                              <div className="fd-option-translations-grid">
                                {drafts.map(opt => {
                                  const optKey = `${field.fieldKey}_opt_${opt}`;
                                  return (
                                    <div key={opt} className="fd-option-trans-row">
                                      <span className="fd-option-trans-key">{opt}</span>
                                      <input
                                        className="fd-trans-input fd-option-trans-input"
                                        value={translations[optKey] ?? ''}
                                        onChange={e => markDirty({ ...translations, [optKey]: e.target.value })}
                                        placeholder={isEnglish ? opt : (englishSource[optKey] || opt)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="fd-grid-actions">
        {saveStatus === 'success' && (
          <span className="fd-status fd-status-success">
            <CheckCircle size={16} /> {t('saved_successfully')}
          </span>
        )}
        {saveStatus === 'error' && (
          <span className="fd-status fd-status-error">
            <XCircle size={16} /> {t('save_failed')}
          </span>
        )}
        {isDirty && saveStatus === 'idle' && (
          <span className="fd-status fd-status-warning">{t('unsaved_changes')}</span>
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
