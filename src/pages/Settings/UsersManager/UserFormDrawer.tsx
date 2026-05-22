import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Eye, EyeOff, User, Lock, Tag } from 'lucide-react';
import { FIELD_TYPES } from '../FieldDefinitions/fieldTypes';
import api from '../../../api';
import './UserFormDrawer.css';

interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  isListVisible: boolean;
}

interface UserData {
  id?: number;
  username?: string;
  display_name?: string;
  is_super_admin?: boolean;
  metadata?: Record<string, any> | null;
}

interface UserFormDrawerProps {
  user: UserData | null;   // null = create mode
  fields: FieldDef[];
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

export const UserFormDrawer = ({ user, fields, onClose, onSaved }: UserFormDrawerProps) => {
  const { t } = useTranslation();
  const isEdit = !!user?.id;

  const [form, setForm] = useState({
    username:    '',
    displayName: '',
    password:    '',
  });
  const [metaValues, setMetaValues] = useState<Record<string, string>>({});
  const [showPass, setShowPass]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

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
    }
  }, [user]);

  const handleSave = async () => {
    setError('');
    if (!isEdit && !form.username.trim()) { setError('Username is required'); return; }
    if (!isEdit && !form.password.trim()) { setError('Password is required'); return; }
    if (!form.displayName.trim())         { setError('Display name is required'); return; }

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
      setError(e?.response?.data?.message ?? 'An error occurred');
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
              <h3 className="ufd-title">{isEdit ? 'Edit User' : 'New User'}</h3>
              {isEdit && <p className="ufd-subtitle">@{user?.username}</p>}
            </div>
          </div>
          <button className="ufd-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Body */}
        <div className="ufd-body">

          {/* Basic info section */}
          <div className="ufd-section">
            <p className="ufd-section-label"><User size={13} /> Basic Info</p>

            {!isEdit && (
              <div className="ufd-field">
                <label className="ufd-label">Username</label>
                <input
                  className="ufd-input"
                  placeholder="e.g. jdoe"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value.toLowerCase() })}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="ufd-field">
              <label className="ufd-label">Display Name</label>
              <input
                className="ufd-input"
                placeholder="e.g. John Doe"
                value={form.displayName}
                onChange={e => setForm({ ...form, displayName: e.target.value })}
              />
            </div>

            <div className="ufd-field">
              <label className="ufd-label">
                <Lock size={12} />
                {isEdit ? 'New Password' : 'Password'}
                {isEdit && <span className="ufd-optional">leave blank to keep current</span>}
              </label>
              <div className="ufd-pass-wrap">
                <input
                  className="ufd-input"
                  type={showPass ? 'text' : 'password'}
                  placeholder={isEdit ? '••••••••' : 'Enter password'}
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
              <p className="ufd-section-label"><Tag size={13} /> Custom Fields</p>
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
                        <span>{metaValues[f.fieldKey] === 'true' ? 'Yes' : 'No'}</span>
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

        {/* Footer */}
        <div className="ufd-footer">
          <button className="ufd-btn ufd-btn-cancel" onClick={onClose}>Cancel</button>
          <button className="ufd-btn ufd-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create User'}
          </button>
        </div>

      </aside>
    </div>
  );
};