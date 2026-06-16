import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldDefinitionsSidebar } from '../FieldDefinitions/FieldDefinitionsSidebar';
import { FieldTranslationGrid } from '../FieldDefinitions/FieldTranslationGrid';
import './WorkflowFieldsManager.css';
import api from '../../../api';

interface Language { code: string; name: string; }
interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  fieldOptions?: string[];
  isAdminOnly?: boolean;
  fieldVisibility?: string;
  isSystem?: boolean;
}

export const WorkflowFieldsManager = () => {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [selectedLang, setSelectedLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const fetchAll = async (bumpRefresh = false) => {
    try {
      const [langsRes, fieldsRes] = await Promise.all([
        api.get('/languages'),
        api.get('/field-definitions', { params: { entityType: 'workflow' } }),
      ]);
      setLanguages(langsRes.data);
      setFieldDefs(fieldsRes.data);
      if (bumpRefresh) setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Failed to load workflow fields', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) {
    return (
      <div className="fd-loading">
        <div className="fd-spinner" />
        <span>{t('loading_custom_fields')}</span>
      </div>
    );
  }

  const systemCount = fieldDefs.filter(f => f.isSystem).length;
  const customCount = fieldDefs.filter(f => !f.isSystem).length;

  return (
    <div className="fd-page">
      <div className="fd-page-header">
        <div className="fd-page-header-content">
          <h2 className="fd-page-title">Workflow Fields Manager</h2>
          <p className="fd-page-subtitle">
            {t('editing_language')}: <strong>{selectedLang.toUpperCase()}</strong>
            {' · '}
            {systemCount} built-in · {customCount} custom
          </p>
        </div>
        <div className="fd-header-badge wfm-badge">
          <span className="fd-header-badge-dot" />
          Workflow
        </div>
      </div>

      <div className="fd-body">
        <aside className="fd-sidebar-wrapper">
          <FieldDefinitionsSidebar
            selectedLang={selectedLang}
            entityType="workflow"
            onFieldAdded={() => fetchAll(true)}
          />
        </aside>

        <main className="fd-main-content">
          <div className="wfm-system-banner">
            🔒 Fields marked with a lock are <strong>built-in</strong> and cannot be removed. You can still translate their labels below.
          </div>

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

          <FieldTranslationGrid
            targetLang={selectedLang}
            fieldDefs={fieldDefs}
            refreshKey={refreshKey}
            translationType="workflow_fields"
            entityType="workflow"
            onDirtyChange={setIsDirty}
          />
        </main>
      </div>
    </div>
  );
};
