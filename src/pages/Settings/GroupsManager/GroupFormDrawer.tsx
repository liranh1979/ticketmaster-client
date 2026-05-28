import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Tag } from 'lucide-react';
import { FIELD_TYPES } from '../FieldDefinitions/fieldTypes';
import api from '../../../api';
import '../UsersManager/UserFormDrawer.css';

interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  isListVisible: boolean;
}

interface GroupData {
  id?: number;
  display_name?: string;
  metadata?: Record<string, any> | null;
}

interface GroupFormDrawerProps {
  group: GroupData | null;
  fields: FieldDef[];
  onClose: () => void;
  onSaved: () => void;
}

const getMetaValue = (group: GroupData, key: string): string => {
  const m = group.metadata?.[key];
  if (!m) return '';
  if (typeof m === 'object') return m.value ?? '';
  return String(m);
};

const inputTypeFor = (fieldType: string): string => {
  switch (fieldType) {
    case 'number': return 'number';
    case 'date':   return 'date';
    case 'email':  return 'email';
    case 'phone':  return 'tel';
    case 'url':    return 'url';
    default:       return 'text';
  }
};

export const GroupFormDrawer = ({ group, fields, onClose, onSaved }: GroupFormDrawerProps) => {
  const { t } = useTranslation();
  const isEdit = !!group?.id;

  const [displayName, setDisplayName] = useState('');
  const [metaValues, setMetaValues]   = useState<Record<string, string>>({});
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    if (group) {
      setDisplayName(group.display_name ?? '');
      const mv: Record<string, string> = {};
      fields.forEach(f => { mv[f.fieldKey] = getMetaValue(group, f.fieldKey); });
      setMetaValues(mv);
    }
  }, [group]);

  const handleSave = async () => {
    setError('');
    if (!displayName.trim()) { setError(t('error_group_name_required')); return; }

    setSaving(true);
    try {
      if (isEdit) {
        const metadata: Record<string, any> = {};
        fields.forEach(f => {
          const existing = group?.metadata?.[f.fieldKey];
          metadata[f.fieldKey] = {
            ...(typeof existing === 'object' && existing !== null ? existing : {}),
            translation_key: f.fieldKey,
            value: metaValues[f.fieldKey] ?? '',
          };
        });
        await api.patch(`/groups/${group!.id}`, { displayName: displayName.trim(), metadata });
      } else {
        await api.post('/groups', { displayName: displayName.trim() });
      }
      onSaved();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? t('error_occurred'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ufd-overlay" onClick={onClose}>
      <aside className="ufd-drawer" onClick={e => e.stopPropagation()}>

        <div className="ufd-header">
          <div className="ufd-header-left">
            <div className="ufd-header-icon">
              <span style={{ fontSize: '18px' }}>👥</span>
            </div>
            <div>
              <h3 className="ufd-title">{isEdit ? t('edit_group') : t('new_group')}</h3>
              {isEdit && <p className="ufd-subtitle">{group?.display_name}</p>}
            </div>
          </div>
          <button className="ufd-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="ufd-body">
          <div className="ufd-section">
            <div className="ufd-field">
              <label className="ufd-label">{t('group_name_label')}</label>
              <input
                className="ufd-input"
                placeholder={t('group_name_placeholder')}
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          {isEdit && fields.length > 0 && (
            <div className="ufd-section">
              <p className="ufd-section-label"><Tag size={13} /> {t('custom_fields_section')}</p>
              {fields.map(f => {
                const ft = FIELD_TYPES.find(t => t.value === f.fieldType) ?? FIELD_TYPES[0];
                return (
                  <div key={f.id} className="ufd-field">
                    <label className="ufd-label">
                      <span className="ufd-type-pip" style={{ background: ft.color, color: ft.text }}>
                        {ft.symbol}
                      </span>
                      {f.fieldKey}
                    </label>
                    {f.fieldType === 'checkbox' ? (
                      <label className="ufd-checkbox-wrap">
                        <input
                          type="checkbox"
                          checked={metaValues[f.fieldKey] === 'true'}
                          onChange={e => setMetaValues({ ...metaValues, [f.fieldKey]: String(e.target.checked) })}
                        />
                        <span>{metaValues[f.fieldKey] === 'true' ? t('yes') : t('no')}</span>
                      </label>
                    ) : f.fieldType === 'rich-text' ? (
                      <textarea
                        className="ufd-textarea"
                        value={metaValues[f.fieldKey] ?? ''}
                        onChange={e => setMetaValues({ ...metaValues, [f.fieldKey]: e.target.value })}
                        rows={3}
                      />
                    ) : (
                      <input
                        className="ufd-input"
                        type={inputTypeFor(f.fieldType)}
                        value={metaValues[f.fieldKey] ?? ''}
                        onChange={e => setMetaValues({ ...metaValues, [f.fieldKey]: e.target.value })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className="ufd-error">{error}</div>}
        </div>

        <div className="ufd-footer">
          <button className="ufd-btn ufd-btn-cancel" onClick={onClose}>{t('cancel_btn')}</button>
          <button className="ufd-btn ufd-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : isEdit ? t('save_btn') : t('create_group')}
          </button>
        </div>

      </aside>
    </div>
  );
};
