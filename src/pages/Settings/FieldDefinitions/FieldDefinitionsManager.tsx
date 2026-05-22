import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldDefinitionsSidebar } from './FieldDefinitionsSidebar';
import { FieldTranslationGrid } from './FieldTranslationGrid';
import './FieldDefinitionsManager.css';
import api from '../../../api';

interface Language { code: string; name: string; }
interface FieldDef { id: number; fieldKey: string; fieldType: string; }

export const FieldDefinitionsManager = () => {
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
        api.get('/field-definitions'),
      ]);
      setLanguages(langsRes.data);
      setFieldDefs(fieldsRes.data);
      if (bumpRefresh) setRefreshKey(k => k + 1);
    } catch (err) {
      console.error('Failed to load data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  if (loading) {
    return (
      <div className="fd-loading">
        <div className="fd-spinner" />
        <span>Loading Custom Fields...</span>
      </div>
    );
  }

  return (
    <div className="fd-page">
      {/* Page Header */}
      <div className="fd-page-header">
        <div className="fd-page-header-content">
          <h2 className="fd-page-title">{t('manage_custom_fields')}</h2>
          <p className="fd-page-subtitle">
            {t('editing_language')}: <strong>{selectedLang.toUpperCase()}</strong>
            {' · '}
            {fieldDefs.length} field{fieldDefs.length !== 1 ? 's' : ''} defined
          </p>
        </div>
        <div className="fd-header-badge">
          <span className="fd-header-badge-dot" />
          Custom Fields
        </div>
      </div>

      {/* Body */}
      <div className="fd-body">
        <aside className="fd-sidebar-wrapper">
          <FieldDefinitionsSidebar
            languages={languages}
            selectedLang={selectedLang}
            onSelect={(code) => {
                if (isDirty && !window.confirm('You have unsaved changes. Switch language and discard them?')) return;
                setSelectedLang(code);
              }}
            onFieldAdded={() => fetchAll(true)}
          />
        </aside>

        <main className="fd-main-content">
          <FieldTranslationGrid
            targetLang={selectedLang}
            fieldDefs={fieldDefs}
            refreshKey={refreshKey}
            onDirtyChange={setIsDirty}
          />
        </main>
      </div>
    </div>
  );
};