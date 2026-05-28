import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Tag, ShieldCheck } from 'lucide-react';
import { FIELD_TYPES } from '../FieldDefinitions/fieldTypes';
import { isSuperAdmin } from '../../../utils/permissions';
import api from '../../../api';
import '../UsersManager/UserFormDrawer.css';

interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  isListVisible: boolean;
  fieldOptions?: string[];
}

interface GroupData {
  id?: number;
  display_name?: string;
  metadata?: Record<string, any> | null;
  permissions?: string[];
}

interface PermissionDef {
  id: number;
  permission_key: string;
  display_order: number;
}

interface GroupFormDrawerProps {
  group: GroupData | null;
  fields: FieldDef[];
  currentUser?: any;
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

export const GroupFormDrawer = ({ group, fields, currentUser, onClose, onSaved }: GroupFormDrawerProps) => {
  const { t } = useTranslation();
  const isEdit = !!group?.id;
  const canEditPermissions = isEdit && isSuperAdmin(currentUser);

  const [displayName, setDisplayName]       = useState('');
  const [metaValues, setMetaValues]         = useState<Record<string, string>>({});
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [allPermissions, setAllPermissions] = useState<PermissionDef[]>([]);
  const [permDrafts, setPermDrafts]         = useState<Set<string>>(new Set());

  useEffect(() => {
    if (group) {
      setDisplayName(group.display_name ?? '');
      const mv: Record<string, string> = {};
      fields.forEach(f => { mv[f.fieldKey] = getMetaValue(group, f.fieldKey); });
      setMetaValues(mv);
      setPermDrafts(new Set(group.permissions ?? []));
    }
  }, [group]);

  useEffect(() => {
    if (canEditPermissions) {
      api.get('/permissions')
        .then(res => setAllPermissions(res.data))
        .catch(err => console.error('Failed to load permissions', err));
    }
  }, [canEditPermissions]);

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
        const body: any = { displayName: displayName.trim(), metadata };
        if (canEditPermissions) body.permissions = Array.from(permDrafts);
        await api.patch(`/groups/${group!.id}`, body);
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
                    ) : f.fieldType === 'combobox' ? (
                      <select
                        className="ufd-input"
                        value={metaValues[f.fieldKey] ?? ''}
                        onChange={e => setMetaValues({ ...metaValues, [f.fieldKey]: e.target.value })}
                      >
                        <option value="">{t('combobox_select_placeholder')}</option>
                        {(f.fieldOptions ?? []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
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

          {/* Permissions section (super admin editing a group) */}
          {canEditPermissions && allPermissions.length > 0 && (
            <div className="ufd-section">
              <p className="ufd-section-label"><ShieldCheck size={13} /> {t('permissions_section')}</p>
              {allPermissions.map(p => (
                <label key={p.permission_key} className="ufd-checkbox-wrap" style={{ marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={permDrafts.has(p.permission_key)}
                    onChange={e => {
                      const next = new Set(permDrafts);
                      e.target.checked ? next.add(p.permission_key) : next.delete(p.permission_key);
                      setPermDrafts(next);
                    }}
                  />
                  <span style={{ fontSize: '0.85rem', color: '#334155' }}>
                    {t(`permission_${p.permission_key.toLowerCase()}_name`, { defaultValue: p.permission_key })}
                  </span>
                </label>
              ))}
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '8px', fontStyle: 'italic' }}>
                {t('permissions_note')}
              </p>
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
