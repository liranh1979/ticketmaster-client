import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldDefinitionsSidebar } from './FieldDefinitionsSidebar';
import { FieldTranslationGrid } from './FieldTranslationGrid';
import './FieldDefinitionsManager.css';
import api from '../../../api';

interface Language { code: string; name: string; }
interface FieldDef { id: number; fieldKey: string; fieldType: string; fieldOptions?: string[]; }

interface FieldDefinitionsManagerProps {
  entityType?: 'user' | 'group';
}

export const FieldDefinitionsManager = ({ entityType = 'user' }: FieldDefinitionsManagerProps) => {
  const { t } = useTranslation();
  const [languages, setLanguages] = useState<Language[]>([]);
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [selectedLang, setSelectedLang] = useState('en');
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const translationType = `${entityType}_fields`;

  const fetchAll = async (bumpRefresh = false) => {
    try {
      const [langsRes, fieldsRes] = await Promise.all([
        api.get('/languages'),
        api.get('/field-definitions', { params: { entityType } }),
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
        <span>{t('loading_custom_fields')}</span>
      </div>
    );
  }

  return (
    <div className="fd-page">
      {/* Page Header */}
      <div className="fd-page-header">
        <div className="fd-page-header-content">
          <h2 className="fd-page-title">
            {entityType === 'group' ? t('manage_group_custom_fields') : t('manage_custom_fields')}
          </h2>
          <p className="fd-page-subtitle">
            {t('editing_language')}: <strong>{selectedLang.toUpperCase()}</strong>
            {' · '}
            {t('fields_count_defined', { count: fieldDefs.length })}
          </p>
        </div>
        <div className="fd-header-badge">
          <span className="fd-header-badge-dot" />
          {entityType === 'group' ? t('field_group_groups') : t('field_group_custom')}
        </div>
      </div>

      {/* Body */}
      <div className="fd-body">
        <aside className="fd-sidebar-wrapper">
          <FieldDefinitionsSidebar
            languages={languages}
            selectedLang={selectedLang}
            entityType={entityType}
            onSelect={(code) => {
                if (isDirty && !window.confirm(t('confirm_discard_changes'))) return;
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
            translationType={translationType}
            onDirtyChange={setIsDirty}
          />
        </main>
      </div>
    </div>
  );
};