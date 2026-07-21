import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Loader2 } from 'lucide-react';
import api from '../../../api';
import { getFieldType } from '../FieldDefinitions/fieldTypes';

export interface WorkflowFieldSuggestion {
  suggestedFieldKey: string;
  suggestedLabel: string;
  suggestedFieldType: string;
}

// AI-drafted "this.<key>" references with no existing Workflow Fields Manager match — mirrors
// LDAP import's missingFields suggestion pattern, but resolved inline in this wizard's own
// review step instead of a page-navigation detour, since this page already owns the workflow
// field catalog fetch. Creating a field here is a plain POST /field-definitions — the same
// single field-creation path FieldDefinitionsSidebar.tsx uses — so nothing about the draft
// needs to change afterward: the mapping already references "this.<key>", it just becomes a
// real, resolvable field once created (see ExternalApiActionExecutor/McpActionExecutor, which
// never validate this.<key> against field_definitions at runtime).
export const WorkflowFieldSuggestions = ({
  suggestions, usedBy, onCreated,
}: {
  suggestions: WorkflowFieldSuggestion[];
  usedBy: (key: string) => string[];
  onCreated: (key: string) => void;
}) => {
  const { t } = useTranslation();
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  const handleCreate = async (s: WorkflowFieldSuggestion) => {
    const key = s.suggestedFieldKey.trim().toLowerCase().replace(/\s+/g, '_');
    setErrorKey(null);
    setCreatingKey(s.suggestedFieldKey);
    try {
      await api.post('/field-definitions', {
        entityType: 'workflow',
        fieldKey: key,
        fieldType: s.suggestedFieldType,
        label: s.suggestedLabel,
      });
      onCreated(s.suggestedFieldKey);
    } catch {
      setErrorKey(s.suggestedFieldKey);
    } finally {
      setCreatingKey(null);
    }
  };

  return (
    <div className="awb-suggestions">
      <label className="awb-label">
        {t('awb_missing_fields_heading', { defaultValue: 'Suggested new Workflow Fields' })}
      </label>
      <p className="awb-hint">
        {t('awb_missing_fields_hint', { defaultValue: "No existing workflow field was a good name/type match for these — create them so the mappings below resolve to real fields." })}
      </p>
      <div className="awb-suggestion-list">
        {suggestions.map(s => {
          const type = getFieldType(s.suggestedFieldType);
          const locations = usedBy(s.suggestedFieldKey);
          return (
            <div key={s.suggestedFieldKey} className="awb-suggestion-row">
              <span className="awb-suggestion-type-badge" style={{ background: type.color, color: type.text }}>
                {type.symbol}
              </span>
              <div className="awb-suggestion-body">
                <span className="awb-suggestion-label">{s.suggestedLabel}</span>
                <code className="awb-suggestion-key">this.{s.suggestedFieldKey}</code>
                {locations.length > 0 && (
                  <span className="awb-suggestion-usedby">
                    {t('awb_missing_field_used_by', { defaultValue: 'used by: {{locations}}', locations: locations.join(', ') })}
                  </span>
                )}
                {errorKey === s.suggestedFieldKey && (
                  <span className="awb-error">{t('awb_missing_field_create_failed', { defaultValue: 'Could not create this field — it may already exist. Try again.' })}</span>
                )}
              </div>
              <button
                className="wfd-btn-ghost awb-suggestion-create-btn"
                disabled={creatingKey === s.suggestedFieldKey}
                onClick={() => handleCreate(s)}
              >
                {creatingKey === s.suggestedFieldKey
                  ? <Loader2 size={13} className="awb-spin" />
                  : <Plus size={13} />}
                {t('awb_missing_field_create_btn', { defaultValue: 'Create field' })}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
