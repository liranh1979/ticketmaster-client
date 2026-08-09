import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, Lock } from 'lucide-react';
import api from '../../../api';
import { FieldTranslationGrid } from '../FieldDefinitions/FieldTranslationGrid';
import '../FieldDefinitions/FieldDefinitionsManager.css';

interface AlertType {
  id: number;
  typeKey: string;
  color: string;
  icon: string | null;
  isSystem: boolean;
  displayOrder: number;
}
interface Language { code: string; name: string; }

const COLORS = ['critical', 'high', 'medium', 'low', 'info', 'neutral'];

const genKey = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const AlertTypesManager = () => {
  const { t } = useTranslation();
  const [alertTypes, setAlertTypes]     = useState<AlertType[]>([]);
  const [languages, setLanguages]       = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState('en');
  const [loading, setLoading]           = useState(true);
  const [refreshKey, setRefreshKey]     = useState(0);
  const [isDirty, setIsDirty]           = useState(false);

  const [nameInput, setNameInput]   = useState('');
  const [keyInput, setKeyInput]     = useState('');
  const [color, setColor]           = useState('info');
  const [icon, setIcon]             = useState('');
  const [adding, setAdding]         = useState(false);

  const fetchAll = async (bumpRefresh = false) => {
    try {
      const [alertTypesRes, langsRes] = await Promise.all([
        api.get('/alert-types'),
        api.get('/languages'),
      ]);
      setAlertTypes(alertTypesRes.data);
      setLanguages(langsRes.data);
      if (bumpRefresh) setRefreshKey(k => k + 1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleNameChange = (name: string) => {
    setNameInput(name);
    setKeyInput(genKey(name));
  };

  const handleAdd = async () => {
    const key  = keyInput.trim();
    const name = nameInput.trim();
    if (!key || !name) return;
    setAdding(true);
    try {
      await api.post('/alert-types', { typeKey: key, name, color, icon: icon.trim() || null });
      setNameInput(''); setKeyInput(''); setColor('info'); setIcon('');
      fetchAll(true);
    } finally { setAdding(false); }
  };

  const handleDelete = async (a: AlertType) => {
    if (a.isSystem) return;
    if (!window.confirm(t('alert_type_delete_confirm', { defaultValue: 'Delete this alert type? This cannot be undone.' }))) return;
    await api.delete(`/alert-types/${a.id}`);
    setAlertTypes(prev => prev.filter(x => x.id !== a.id));
    setRefreshKey(k => k + 1);
  };

  const alertTypeFieldDefs = alertTypes.map(a => ({
    id: a.id,
    fieldKey: a.typeKey,
    fieldType: 'alert_type' as const,
  }));

  const isEnglish = selectedLang === 'en';
  const canAdd    = !adding && nameInput.trim() && keyInput.trim();

  if (loading) {
    return (
      <div className="fd-loading">
        <div className="fd-spinner" />
        <span>{t('loading_custom_fields')}</span>
      </div>
    );
  }

  return (
    <div className="fd-page">
      <div className="fd-page-header">
        <div className="fd-page-header-content">
          <h2 className="fd-page-title">{t('field_group_alerts', { defaultValue: 'Alert Types' })}</h2>
          <p className="fd-page-subtitle">
            {t('editing_language')}: <strong>{selectedLang.toUpperCase()}</strong>
            {' · '}
            {alertTypes.length} {t('field_group_alerts', { defaultValue: 'Alert Types' }).toLowerCase()}
          </p>
        </div>
        <div className="fd-header-badge">
          <span className="fd-header-badge-dot" />
          {t('field_group_alerts', { defaultValue: 'Alert Types' })}
        </div>
      </div>

      <div className="fd-body">
        <aside className="fd-sidebar-wrapper">
          <div className="fd-sidebar">
            <div className="fd-sidebar-section">
              <p className="fd-sidebar-label">{t('field_group_alerts', { defaultValue: 'Alert Types' })}</p>
              {alertTypes.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  {t('no_alert_types', { defaultValue: 'No alert types defined.' })}
                </p>
              )}
              {alertTypes.map(a => (
                <div
                  key={a.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 4px', borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{a.icon || '●'}</span>
                  <span className="fd-key-code" style={{ flex: 1 }}>{a.typeKey}</span>
                  <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{a.color}</span>
                  {a.isSystem ? (
                    <span title={t('alert_type_system_locked', { defaultValue: 'Built-in — cannot be deleted' })}
                          style={{ color: '#cbd5e1', display: 'flex', padding: 2 }}>
                      <Lock size={12} />
                    </span>
                  ) : (
                    <button
                      onClick={() => handleDelete(a)}
                      title={t('alert_type_delete_confirm', { defaultValue: 'Delete this alert type? This cannot be undone.' })}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: '#94a3b8', display: 'flex', padding: 2,
                        borderRadius: 4, transition: 'color .12s',
                      }}
                      onMouseOver={e => (e.currentTarget.style.color = '#dc2626')}
                      onMouseOut={e  => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {isEnglish && (
              <div className="fd-sidebar-section fd-add-field-section">
                <p className="fd-sidebar-label">{t('alert_type_create_btn', { defaultValue: '+ Add Alert Type' })}</p>

                <div className="fd-form-group">
                  <label className="fd-form-label">{t('announcements_form_severity_label', { defaultValue: 'Alert Type' })}</label>
                  <input
                    className="fd-input"
                    placeholder="e.g. Maintenance"
                    value={nameInput}
                    onChange={e => handleNameChange(e.target.value)}
                  />
                </div>

                <div className="fd-form-group">
                  <label className="fd-form-label">{t('alert_type_key_label', { defaultValue: 'Key' })}</label>
                  <input
                    className="fd-input"
                    placeholder="e.g. maintenance"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                  />
                </div>

                <div className="fd-form-group">
                  <label className="fd-form-label">{t('alert_type_color_label', { defaultValue: 'Color' })}</label>
                  <select className="fd-input" value={color} onChange={e => setColor(e.target.value)}>
                    {COLORS.map(c => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
                  </select>
                </div>

                <div className="fd-form-group">
                  <label className="fd-form-label">{t('alert_type_icon_label', { defaultValue: 'Icon (emoji)' })}</label>
                  <input
                    className="fd-input"
                    placeholder="🔧"
                    value={icon}
                    onChange={e => setIcon(e.target.value)}
                    maxLength={4}
                  />
                </div>

                <button
                  className="fd-add-btn"
                  onClick={handleAdd}
                  disabled={!canAdd}
                >
                  {adding ? '...' : t('alert_type_create_btn', { defaultValue: '+ Add Alert Type' })}
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className="fd-main-content">
          <div className="fd-lang-tab-bar">
            {languages.map(l => (
              <button
                key={l.code}
                className={`fd-lang-tab-btn${selectedLang === l.code ? ' fd-lang-tab-active' : ''}`}
                onClick={() => {
                  if (isDirty && !window.confirm(t('confirm_discard_changes'))) return;
                  setSelectedLang(l.code);
                }}
              >
                <span className="fd-lang-tab-code">{l.code.toUpperCase()}</span>
                {l.name}
              </button>
            ))}
          </div>

          {alertTypeFieldDefs.length === 0 ? (
            <div className="fd-empty">
              <div className="fd-empty-icon">🚨</div>
              <p>{t('no_alert_types', { defaultValue: 'No alert types defined.' })}</p>
            </div>
          ) : (
            <FieldTranslationGrid
              targetLang={selectedLang}
              fieldDefs={alertTypeFieldDefs}
              refreshKey={refreshKey}
              translationType="alert_types"
              onDirtyChange={setIsDirty}
            />
          )}
        </main>
      </div>
    </div>
  );
};
