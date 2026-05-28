import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FIELD_TYPES } from './fieldTypes';
import api from '../../../api';

interface Language { code: string; name: string; }
interface FieldDefinitionsSidebarProps {
  languages: Language[];
  selectedLang: string;
  entityType: string;
  onSelect: (code: string) => void;
  onFieldAdded: () => void;
}

export const FieldDefinitionsSidebar = ({
  languages, selectedLang, entityType, onSelect, onFieldAdded,
}: FieldDefinitionsSidebarProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ fieldKey: '', label: '', fieldType: 'text' });
  const [adding, setAdding] = useState(false);
  const isEnglish = selectedLang === 'en';

  const handleAdd = async () => {
    if (!form.fieldKey.trim() || !form.label.trim()) return;
    setAdding(true);
    try {
      await api.post('/field-definitions', {
        entityType,
        fieldKey: form.fieldKey.trim().toLowerCase().replace(/\s+/g, '_'),
        fieldType: form.fieldType,
        label: form.label.trim(),
      });
      setForm({ fieldKey: '', label: '', fieldType: 'text' });
      onFieldAdded();
    } catch (err) {
      console.error('Failed to add field', err);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fd-sidebar">
      <div className="fd-sidebar-section">
        <p className="fd-sidebar-label">{t('languages_label')}</p>
        <ul className="fd-lang-list">
          {languages.map(l => (
            <li
              key={l.code}
              className={`fd-lang-item ${selectedLang === l.code ? 'active' : ''}`}
              onClick={() => onSelect(l.code)}
            >
              <span className="fd-lang-flag">{l.code.toUpperCase()}</span>
              <span className="fd-lang-name">{l.name}</span>
            </li>
          ))}
        </ul>
      </div>

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
              onChange={e => setForm({ ...form, fieldType: e.target.value })}
            >
              {FIELD_TYPES.map(ft => (
                <option key={ft.value} value={ft.value}>
                  {ft.symbol}  {ft.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className="fd-add-btn"
            onClick={handleAdd}
            disabled={adding || !form.fieldKey.trim() || !form.label.trim()}
          >
            {adding ? '...' : `+ ${t('add_new_field')}`}
          </button>
        </div>
      )}
    </div>
  );
};