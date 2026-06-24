import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, User, Lock, Globe } from 'lucide-react';
import i18n from '../../i18n';
import api from '../../api';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import '../../pages/Settings/UsersManager/UserFormDrawer.css';
import './PersonalSettingsModal.css';

interface ProfileField {
  fieldKey: string;
  fieldType: string;
  fieldOptions?: string[];
  value: string;
  editable: boolean;
}

interface SelfProfile {
  username: string;
  displayName: string;
  email: string;
  preferredLanguage: string | null;
  canChangePassword: boolean;
  fields: ProfileField[];
}

interface Language { code: string; name: string; }

interface Props {
  onClose: () => void;
  onUserUpdate?: (partial: Record<string, any>) => void;
}

export const PersonalSettingsModal = ({ onClose, onUserUpdate }: Props) => {
  const { t } = useTranslation();
  const systemSettings = useSystemSettings();

  const [profile, setProfile] = useState<SelfProfile | null>(null);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [form, setForm] = useState({ displayName: '', email: '', preferredLanguage: '' });
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    Promise.all([api.get<SelfProfile>('/profile'), api.get<Language[]>('/languages')])
      .then(([profileRes, langRes]) => {
        const p = profileRes.data;
        setProfile(p);
        setForm({
          displayName: p.displayName ?? '',
          email: p.email ?? '',
          preferredLanguage: p.preferredLanguage ?? '',
        });
        const fv: Record<string, string> = {};
        p.fields.forEach(f => { fv[f.fieldKey] = f.value ?? ''; });
        setFieldValues(fv);
        setLanguages(langRes.data);
      })
      .catch(err => console.error('Failed to load profile', err))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const metadata: Record<string, string> = {};
      (profile?.fields ?? []).filter(f => f.editable).forEach(f => {
        metadata[f.fieldKey] = fieldValues[f.fieldKey] ?? '';
      });

      await api.patch('/profile', {
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        preferredLanguage: form.preferredLanguage || '',
        metadata,
      });

      onUserUpdate?.({
        display_name: form.displayName.trim(),
        preferred_language: form.preferredLanguage || null,
      });
      i18n.changeLanguage(form.preferredLanguage || systemSettings.defaultLanguageCode);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? t('error_occurred'));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwError('');
    setPwSuccess(false);
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError(t('passwords_do_not_match'));
      return;
    }
    setPwSaving(true);
    try {
      await api.post('/profile/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } catch (err: any) {
      setPwError(err?.response?.status === 401
        ? t('current_password_incorrect')
        : (err?.response?.data?.message ?? t('error_occurred')));
    } finally {
      setPwSaving(false);
    }
  };

  return (
    <div className="ufd-overlay" onClick={onClose}>
      <aside className="ufd-drawer" onClick={e => e.stopPropagation()}>
        <div className="ufd-header">
          <div className="ufd-header-left">
            <div className="ufd-header-icon"><User size={18} /></div>
            <div>
              <h3 className="ufd-title">{t('personal_settings_title')}</h3>
              {profile && <p className="ufd-subtitle">@{profile.username}</p>}
            </div>
          </div>
          <button className="ufd-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="ufd-body">
          {loading ? (
            <div className="psm-loading">{t('loading_users')}</div>
          ) : (
            <>
              {/* Profile section */}
              <div className="ufd-section">
                <p className="ufd-section-label"><User size={13} /> {t('my_profile_label')}</p>

                <div className="ufd-field">
                  <label className="ufd-label">{t('username_label')}</label>
                  <div className="psm-readonly">@{profile?.username}</div>
                </div>

                <div className="ufd-field">
                  <label className="ufd-label">{t('col_display_name')}</label>
                  <input
                    className="ufd-input"
                    value={form.displayName}
                    onChange={e => setForm({ ...form, displayName: e.target.value })}
                  />
                </div>

                <div className="ufd-field">
                  <label className="ufd-label">{t('col_email')}</label>
                  <input
                    className="ufd-input"
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                  />
                </div>

                {profile?.fields.map(f => (
                  <div className="ufd-field" key={f.fieldKey}>
                    <label className="ufd-label">{t(f.fieldKey, { defaultValue: f.fieldKey })}</label>
                    {f.editable ? (
                      f.fieldType === 'combobox' ? (
                        <select
                          className="ufd-input"
                          value={fieldValues[f.fieldKey] ?? ''}
                          onChange={e => setFieldValues({ ...fieldValues, [f.fieldKey]: e.target.value })}
                        >
                          <option value="">—</option>
                          {(f.fieldOptions ?? []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          className="ufd-input"
                          value={fieldValues[f.fieldKey] ?? ''}
                          onChange={e => setFieldValues({ ...fieldValues, [f.fieldKey]: e.target.value })}
                        />
                      )
                    ) : (
                      <div className="psm-readonly">{fieldValues[f.fieldKey] || '—'}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Language section */}
              <div className="ufd-section">
                <p className="ufd-section-label"><Globe size={13} /> {t('personal_language_label')}</p>
                <div className="ufd-field">
                  <select
                    className="ufd-input"
                    value={form.preferredLanguage}
                    onChange={e => setForm({ ...form, preferredLanguage: e.target.value })}
                  >
                    <option value="">{t('use_system_default_label')}</option>
                    {languages.map(l => (
                      <option key={l.code} value={l.code}>{l.name} ({l.code.toUpperCase()})</option>
                    ))}
                  </select>
                </div>
              </div>

              {saveError && <div className="ufd-error">{saveError}</div>}
              {saveSuccess && <div className="psm-success">{t('profile_saved_success')}</div>}
              <button className="ufd-btn ufd-btn-save" onClick={handleSaveProfile} disabled={saving}>
                {saving ? t('saving') : t('save_btn')}
              </button>

              {/* Password section */}
              <div className="ufd-section">
                <p className="ufd-section-label"><Lock size={13} /> {t('change_password_label')}</p>

                {profile?.canChangePassword ? (
                  <>
                    <div className="ufd-field">
                      <label className="ufd-label">{t('current_password_label')}</label>
                      <input
                        className="ufd-input"
                        type="password"
                        value={pwForm.currentPassword}
                        onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      />
                    </div>
                    <div className="ufd-field">
                      <label className="ufd-label">{t('new_password_label')}</label>
                      <input
                        className="ufd-input"
                        type="password"
                        value={pwForm.newPassword}
                        onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      />
                    </div>
                    <div className="ufd-field">
                      <label className="ufd-label">{t('confirm_password_label')}</label>
                      <input
                        className="ufd-input"
                        type="password"
                        value={pwForm.confirmPassword}
                        onChange={e => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
                      />
                    </div>
                    {pwError && <div className="ufd-error">{pwError}</div>}
                    {pwSuccess && <div className="psm-success">{t('password_changed_success')}</div>}
                    <button
                      className="ufd-btn ufd-btn-save"
                      onClick={handleChangePassword}
                      disabled={pwSaving || !pwForm.currentPassword || !pwForm.newPassword}
                    >
                      {pwSaving ? t('saving') : t('change_password_label')}
                    </button>
                  </>
                ) : (
                  <p className="psm-readonly">{t('synced_account_no_password')}</p>
                )}
              </div>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
