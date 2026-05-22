import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import { getFieldType } from '../FieldDefinitions/fieldTypes';
import api from '../../../api';

interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  isListVisible: boolean;
}

interface ConfigureColumnsModalProps {
  fields: FieldDef[];
  onClose: () => void;
}

export const ConfigureColumnsModal = ({ fields, onClose }: ConfigureColumnsModalProps) => {
  const { t } = useTranslation();
  const [visibility, setVisibility] = useState<Record<number, boolean>>(
    Object.fromEntries(fields.map(f => [f.id, f.isListVisible]))
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all(
        fields
          .filter(f => visibility[f.id] !== f.isListVisible)
          .map(f => api.patch(`/field-definitions/${f.id}/list-visibility?visible=${visibility[f.id]}`))
      );
      onClose();
    } catch (err) {
      console.error('Failed to save visibility', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ccm-overlay" onClick={onClose}>
      <div className="ccm-modal" onClick={e => e.stopPropagation()}>
        <div className="ccm-header">
          <h3 className="ccm-title">{t('configure_columns')}</h3>
          <button className="ccm-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="ccm-subtitle">{t('configure_columns_desc')}</p>

        <div className="ccm-field-list">
          {fields.map(f => {
            const ft = getFieldType(f.fieldType);
            return (
              <label key={f.id} className="ccm-field-row">
                <input
                  type="checkbox"
                  className="ccm-checkbox"
                  checked={visibility[f.id] ?? false}
                  onChange={e => setVisibility({ ...visibility, [f.id]: e.target.checked })}
                />
                <span className="ccm-type-badge" style={{ background: ft.color, color: ft.text }}>
                  {ft.symbol}
                </span>
                <span className="ccm-field-key">{f.fieldKey}</span>
              </label>
            );
          })}
        </div>

        <div className="ccm-footer">
          <button className="ccm-btn ccm-btn-cancel" onClick={onClose}>{t('cancel_btn')}</button>
          <button className="ccm-btn ccm-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : t('save_changes_btn')}
          </button>
        </div>
      </div>
    </div>
  );
};