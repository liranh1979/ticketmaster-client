import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Eye, EyeOff, User, Lock, Tag, Users, ShieldCheck } from 'lucide-react';
import { FIELD_TYPES } from '../FieldDefinitions/fieldTypes';
import { isSuperAdmin } from '../../../utils/permissions';
import api from '../../../api';
import './UserFormDrawer.css';

interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  isListVisible: boolean;
  fieldOptions?: string[];
}

interface UserData {
  id?: number;
  username?: string;
  display_name?: string;
  is_super_admin?: boolean;
  metadata?: Record<string, any> | null;
  personal_permissions?: string[];
}

interface PermissionDef {
  id: number;
  permission_key: string;
  display_order: number;
}

interface UserFormDrawerProps {
  user: UserData | null;   // null = create mode
  fields: FieldDef[];
  currentUser?: any;
  onClose: () => void;
  onSaved: () => void;
}

const getMetaValue = (user: UserData, key: string): string => {
  const m = user.metadata?.[key];
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

export const UserFormDrawer = ({ user, fields, currentUser, onClose, onSaved }: UserFormDrawerProps) => {
  const { t } = useTranslation();
  const isEdit = !!user?.id;
  const canEditPermissions = isEdit && isSuperAdmin(currentUser) && !user?.is_super_admin;

  const [form, setForm] = useState({
    username:    '',
    displayName: '',
    password:    '',
  });
  const [metaValues, setMetaValues]         = useState<Record<string, string>>({});
  const [showPass, setShowPass]             = useState(false);
  const [saving, setSaving]                 = useState(false);
  const [error, setError]                   = useState('');
  const [userGroups, setUserGroups]         = useState<{ id: number; display_name: string }[]>([]);
  const [groupsLoading, setGroupsLoading]   = useState(false);
  const [allPermissions, setAllPermissions] = useState<PermissionDef[]>([]);
  const [permDrafts, setPermDrafts]         = useState<Set<string>>(new Set());

  useEffect(() => {
    if (user?.id) {
      setGroupsLoading(true);
      api.get(`/groups/by-user/${user.id}`)
        .then(res => setUserGroups(res.data))
        .catch(err => console.error('Failed to load user groups', err))
        .finally(() => setGroupsLoading(false));
    }
  }, [user?.id]);

  useEffect(() => {
    if (canEditPermissions) {
      api.get('/permissions')
        .then(res => setAllPermissions(res.data))
        .catch(err => console.error('Failed to load permissions', err));
    }
  }, [canEditPermissions]);

  useEffect(() => {
    if (user) {
      setForm({
        username:    user.username ?? '',
        displayName: user.display_name ?? '',
        password:    '',
      });
      const mv: Record<string, string> = {};
      fields.forEach(f => { mv[f.fieldKey] = getMetaValue(user, f.fieldKey); });
      setMetaValues(mv);
      setPermDrafts(new Set(user.personal_permissions ?? []));
    }
  }, [user]);

  const handleSave = async () => {
    setError('');
    if (!isEdit && !form.username.trim()) { setError(t('error_username_required')); return; }
    if (!isEdit && !form.password.trim()) { setError(t('error_password_required')); return; }
    if (!form.displayName.trim())         { setError(t('error_display_name_required')); return; }

    setSaving(true);
    try {
      // Build metadata payload — wrap each value in the expected shape
      const metadata: Record<string, any> = {};
      fields.forEach(f => {
        const existing = user?.metadata?.[f.fieldKey];
        metadata[f.fieldKey] = {
          ...(typeof existing === 'object' && existing !== null ? existing : {}),
          translation_key: f.fieldKey,
          value: metaValues[f.fieldKey] ?? '',
        };
      });

      if (isEdit) {
        const body: any = { displayName: form.displayName, metadata };
        if (form.password.trim()) body.password = form.password;
        if (canEditPermissions) body.permissions = Array.from(permDrafts);
        await api.patch(`/users/${user!.id}`, body);
      } else {
        await api.post('/users', {
          username:    form.username.trim().toLowerCase(),
          displayName: form.displayName.trim(),
          password:    form.password,
        });
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

        {/* Header */}
        <div className="ufd-header">
          <div className="ufd-header-left">
            <div className="ufd-header-icon">
              <User size={18} />
            </div>
            <div>
              <h3 className="ufd-title">{isEdit ? t('edit_user') : t('new_user')}</h3>
              {isEdit && <p className="ufd-subtitle">@{user?.username}</p>}
            </div>
          </div>
          <button className="ufd-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="ufd-body">

          {/* Basic info section */}
          <div className="ufd-section">
            <p className="ufd-section-label"><User size={13} /> {t('basic_info')}</p>

            {!isEdit && (
              <div className="ufd-field">
                <label className="ufd-label">{t('col_username')}</label>
                <input
                  className="ufd-input"
                  placeholder={t('username_placeholder')}
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="ufd-field">
              <label className="ufd-label">{t('col_display_name')}</label>
              <input
                className="ufd-input"
                placeholder={t('display_name_placeholder')}
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
              />
            </div>

            <div className="ufd-field">
              <label className="ufd-label">
                <Lock size={12} />
                {isEdit ? t('new_password') : t('login_password')}
                {isEdit && <span className="ufd-optional">{t('password_optional_note')}</span>}
              </label>
              <div className="ufd-pass-wrap">
                <input
                  className="ufd-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder={isEdit ? '••••••••' : t('password_placeholder')}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  autoComplete="new-password"
                />
                <button className="ufd-pass-toggle" type="button" onClick={() => setShowPass(s => !s)}>
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Custom fields section */}
          {fields.length > 0 && (
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

          {/* Groups membership (edit mode, read-only) */}
          {isEdit && (
            <div className="ufd-section">
              <p className="ufd-section-label"><Users size={13} /> {t('user_groups_section')}</p>
              {groupsLoading ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>...</div>
              ) : userGroups.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                  {t('no_groups_assigned')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {userGroups.map(g => (
                    <span key={g.id} style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      background: '#ede9fe',
                      color: '#5b21b6',
                      borderRadius: 999,
                      fontSize: '0.75rem',
                      fontWeight: 600,
                    }}>
                      {g.display_name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Permissions section (super admin editing a non-super-admin) */}
          {canEditPermissions && allPermissions.length > 0 && (
            <div className="ufd-section">
              <p className="ufd-section-label"><ShieldCheck size={13} /> {t('permissions_section')}</p>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '8px' }}>{t('personal_permissions_label')}</p>
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

        {/* Footer */}
        <div className="ufd-footer">
          <button className="ufd-btn ufd-btn-cancel" onClick={onClose}>{t('cancel_btn')}</button>
          <button className="ufd-btn ufd-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? t('saving') : isEdit ? t('save_btn') : t('create_user')}
          </button>
        </div>

      </aside>
    </div>
  );
};