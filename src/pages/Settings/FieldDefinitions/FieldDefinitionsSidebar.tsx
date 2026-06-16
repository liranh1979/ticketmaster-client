import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FIELD_TYPES } from './fieldTypes';
import api from '../../../api';
interface SuggestedField {
  suggestedFieldKey: string;
  suggestedLabel: string;
  suggestedFieldType: string;
}
interface FieldDefinitionsSidebarProps {
  selectedLang: string;
  entityType: string;
  onFieldAdded: () => void;
  suggestedFields?: SuggestedField[];
}

export const FieldDefinitionsSidebar = ({
  selectedLang, entityType, onFieldAdded, suggestedFields,
}: FieldDefinitionsSidebarProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ fieldKey: '', label: '', fieldType: 'text' });
  const [options, setOptions] = useState<string[]>([]);
  const [optionInput, setOptionInput] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(20);
  const [adding, setAdding] = useState(false);
  const isEnglish = selectedLang === 'en';

  const addOption = () => {
    const val = optionInput.trim();
    if (val && !options.includes(val)) {
      setOptions([...options, val]);
    }
    setOptionInput('');
  };

  const removeOption = (i: number) => {
    setOptions(options.filter((_, j) => j !== i));
  };

  const handleAdd = async () => {
    if (!form.fieldKey.trim() || !form.label.trim()) return;
    if (form.fieldType === 'combobox' && options.length === 0) return;
    setAdding(true);
    try {
      await api.post('/field-definitions', {
        entityType,
        fieldKey: form.fieldKey.trim().toLowerCase().replace(/\s+/g, '_'),
        fieldType: form.fieldType,
        label: form.label.trim(),
        fieldOptions: form.fieldType === 'combobox' ? options : null,
        fieldConfig: form.fieldType === 'timer'
          ? { alert_threshold_percent: alertThreshold }
          : null,
      });
      setForm({ fieldKey: '', label: '', fieldType: 'text' });
      setOptions([]);
      setOptionInput('');
      setAlertThreshold(20);
      onFieldAdded();
    } catch (err) {
      console.error('Failed to add field', err);
    } finally {
      setAdding(false);
    }
  };

  const isCombobox = form.fieldType === 'combobox';
  const isTimer    = form.fieldType === 'timer';
  const canAdd = !adding && form.fieldKey.trim() && form.label.trim() && (!isCombobox || options.length > 0);

  return (
    <div className="fd-sidebar">
      {isEnglish && suggestedFields && suggestedFields.length > 0 && (
        <div className="fd-sidebar-section fd-ldap-suggestions-section">
          <p className="fd-sidebar-label">{t('ldap_suggested_by_section')}</p>
          {suggestedFields.map((sf, i) => (
            <div key={i} className="fd-ldap-suggestion-item">
              <div className="fd-ldap-suggestion-info">
                <span className="fd-ldap-suggestion-label">{sf.suggestedLabel}</span>
                <span className="fd-ldap-suggestion-type">{sf.suggestedFieldType}</span>
              </div>
              <div className="fd-ldap-suggestion-key">{sf.suggestedFieldKey}</div>
              <button
                className="fd-ldap-suggestion-fill-btn"
                onClick={() => setForm({
                  fieldKey: sf.suggestedFieldKey,
                  label: sf.suggestedLabel,
                  fieldType: sf.suggestedFieldType,
                })}
              >
                {t('ldap_use_suggestion_btn')}
              </button>
            </div>
          ))}
        </div>
      )}

      {isEnglish && (
        <div className="fd-sidebar-section fd-add-field-section">
          <p className="fd-sidebar-label">{t('add_new_field')}</p>

          <div className="fd-form-group">
            <label className="fd-form-label">{t('field_key_label')}</label>
            <input
              className="fd-input"
              placeholder={t('field_key_hint')}
              value={form.fieldKey}
              onChange={e => setForm({ ...form, fieldKey: e.target.value })}
            />
          </div>

          <div className="fd-form-group">
            <label className="fd-form-label">{t('field_label_label')}</label>
            <input
              className="fd-input"
              placeholder={t('field_label_hint')}
              value={form.label}
              onChange={e => setForm({ ...form, label: e.target.value })}
            />
          </div>

          <div className="fd-form-group">
            <label className="fd-form-label">{t('field_type_select')}</label>
            <select
              className="fd-select"
              value={form.fieldType}
              onChange={e => {
                setForm({ ...form, fieldType: e.target.value });
                setOptions([]);
                setOptionInput('');
              }}
            >
              {FIELD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>
                  {ft.symbol}  {ft.label}
                </option>
              ))}
            </select>
          </div>

          {isCombobox && (
            <div className="fd-form-group">
              <label className="fd-form-label">{t('combobox_options_label')}</label>
              <div className="fd-options-input-row">
                <input
                  className="fd-input"
                  placeholder={t('add_option_placeholder')}
                  value={optionInput}
                  onChange={e => setOptionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                />
                <button className="fd-options-add-btn" onClick={addOption} disabled={!optionInput.trim()}>+</button>
              </div>
              {options.length > 0 && (
                <div className="fd-option-chips">
                  {options.map((opt, i) => (
                    <span key={i} className="fd-option-chip">
                      {opt}
                      <button className="fd-option-chip-remove" onClick={() => removeOption(i)}>×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {isTimer && (
            <div className="fd-form-group">
              <label className="fd-form-label">Alert when % remaining ≤</label>
              <input
                type="number"
                className="fd-input"
                min={1}
                max={99}
                value={alertThreshold}
                onChange={e => setAlertThreshold(Math.min(99, Math.max(1, parseInt(e.target.value) || 20)))}
              />
            </div>
          )}

          <button
            className="fd-add-btn"
            onClick={handleAdd}
            disabled={!canAdd}
          >
            {adding ? '...' : `+ ${t('add_new_field')}`}
          </button>
        </div>
      )}
    </div>
  );
};
