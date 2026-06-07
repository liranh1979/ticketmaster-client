import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import api from '../../../api';
import { FieldTranslationGrid } from '../FieldDefinitions/FieldTranslationGrid';
import '../FieldDefinitions/FieldDefinitionsManager.css';

interface Label { id: number; labelKey: string; color: string; }
interface Language { code: string; name: string; }

const genKey = (name: string) =>
  name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export const LabelsManagementPage = () => {
  const { t } = useTranslation();
  const [labels, setLabels]           = useState<Label[]>([]);
  const [languages, setLanguages]     = useState<Language[]>([]);
  const [selectedLang, setSelectedLang] = useState('en');
  const [loading, setLoading]         = useState(true);
  const [refreshKey, setRefreshKey]   = useState(0);
  const [isDirty, setIsDirty]         = useState(false);

  const [keyInput, setKeyInput]   = useState('');
  const [nameInput, setNameInput] = useState('');
  const [color, setColor]         = useState('#3b82f6');
  const [adding, setAdding]       = useState(false);

  const fetchAll = async (bumpRefresh = false) => {
    try {
      const [labelsRes, langsRes] = await Promise.all([
        api.get('/ticket-labels'),
        api.get('/languages'),
      ]);
      setLabels(labelsRes.data);
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
      await api.post('/ticket-labels', { labelKey: key, color, name });
      setKeyInput(''); setNameInput(''); setColor('#3b82f6');
      fetchAll(true);
    } finally { setAdding(false); }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('delete_label') + '?')) return;
    await api.delete(`/ticket-labels/${id}`);
    setLabels(prev => prev.filter(l => l.id !== id));
    setRefreshKey(k => k + 1);
  };

  const labelFieldDefs = labels.map(l => ({
    id: l.id,
    fieldKey: l.labelKey,
    fieldType: 'label' as const,
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
      {/* Header */}
      <div className="fd-page-header">
        <div className="fd-page-header-content">
          <h2 className="fd-page-title">{t('label_management')}</h2>
          <p className="fd-page-subtitle">
            {t('editing_language')}: <strong>{selectedLang.toUpperCase()}</strong>
            {' · '}
            {labels.length} {t('label_field_group').toLowerCase()}
          </p>
        </div>
        <div className="fd-header-badge">
          <span className="fd-header-badge-dot" />
          {t('label_field_group')}
        </div>
      </div>

      {/* Body */}
      <div className="fd-body">

        {/* Sidebar */}
        <aside className="fd-sidebar-wrapper">
          <div className="fd-sidebar">

            {/* Existing labels */}
            <div className="fd-sidebar-section">
              <p className="fd-sidebar-label">{t('label_field_group')}</p>
              {labels.length === 0 && (
                <p style={{ fontSize: '0.78rem', color: '#94a3b8', fontStyle: 'italic' }}>
                  {t('no_labels')}
                </p>
              )}
              {labels.map(label => (
                <div
                  key={label.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 4px', borderBottom: '1px solid #f1f5f9',
                  }}
                >
                  <span
                    style={{
                      width: 10, height: 10, borderRadius: '50%',
                      background: label.color, flexShrink: 0,
                    }}
                  />
                  <span className="fd-key-code" style={{ flex: 1 }}>{label.labelKey}</span>
                  <button
                    onClick={() => handleDelete(label.id)}
                    title={t('delete_label')}
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
                </div>
              ))}
            </div>

            {/* Add form — English only */}
            {isEnglish && (
              <div className="fd-sidebar-section fd-add-field-section">
                <p className="fd-sidebar-label">{t('create_label')}</p>

                <div className="fd-form-group">
                  <label className="fd-form-label">{t('field_label_label')}</label>
                  <input
                    className="fd-input"
                    placeholder="e.g. Critical Bug"
                    value={nameInput}
                    onChange={e => handleNameChange(e.target.value)}
                  />
                </div>

                <div className="fd-form-group">
                  <label className="fd-form-label">{t('label_key_label')}</label>
                  <input
                    className="fd-input"
                    placeholder="e.g. critical_bug"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}
                  />
                </div>

                <div className="fd-form-group">
                  <label className="fd-form-label">{t('label_color_label')}</label>
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    style={{
                      width: '100%', height: 36, padding: 2,
                      border: '1.5px solid #e2e8f0', borderRadius: 7,
                      cursor: 'pointer', background: '#fff',
                    }}
                  />
                </div>

                <button
                  className="fd-add-btn"
                  onClick={handleAdd}
                  disabled={!canAdd}
                >
                  {adding ? '...' : `+ ${t('create_label')}`}
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main content */}
        <main className="fd-main-content">
          {/* Language tabs */}
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

          {labelFieldDefs.length === 0 ? (
            <div className="fd-empty">
              <div className="fd-empty-icon">🏷️</div>
              <p>{t('no_labels')}</p>
            </div>
          ) : (
            <FieldTranslationGrid
              targetLang={selectedLang}
              fieldDefs={labelFieldDefs}
              refreshKey={refreshKey}
              translationType="label"
              onDirtyChange={setIsDirty}
            />
          )}
        </main>
      </div>
    </div>
  );
};
