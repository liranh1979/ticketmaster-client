import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import api from '../../../api';
import './SimpleItemFieldsEditor.css';

export interface SimpleItemField {
  key: string;
  label: string;
  fieldType: 'text' | 'number' | 'date' | 'checkbox';
}

// Only field types SimpleItemFieldsForm actually knows how to render as a fill-in control —
// Workflow Fields Manager supports richer types (combobox, assignee, etc.) for the item's built-in
// columns, but a Simple item's own mini-fields are deliberately kept to this small, simple set.
const RENDERABLE_TYPES = new Set(['text', 'number', 'date', 'checkbox']);

interface WorkflowFieldDef {
  fieldKey: string;
  fieldType: string;
}

// Defines a Simple action item's own small set of fields (its "mini-form") — picked from the same
// field_definitions catalog (entity_type='workflow') that Workflow Fields Manager manages, the same
// "global catalog, per-use placement" pattern TemplateBuilderPage already uses for ticket fields.
// Used both in the Action Item Library builder and, per-template, in the Workflow Designer's Task
// inspector. Filling these in on a real ticket happens later, in SimpleItemFieldsForm.
export const SimpleItemFieldsEditor = ({
  fields, onChange,
}: {
  fields: SimpleItemField[];
  onChange: (fields: SimpleItemField[]) => void;
}) => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<WorkflowFieldDef[]>([]);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [pickerValue, setPickerValue] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/field-definitions', { params: { entityType: 'workflow' } }),
      api.get('/field-definitions/translations/en', { params: { translationType: 'workflow_fields' } }),
    ]).then(([fieldsRes, transRes]) => {
      setCatalog(fieldsRes.data.filter((f: any) => RENDERABLE_TYPES.has(f.fieldType)));
      setLabels(transRes.data);
    }).catch(() => {});
  }, []);

  const usedKeys = new Set(fields.map(f => f.key));
  const availableToAdd = catalog.filter(f => !usedKeys.has(f.fieldKey));

  const addField = () => {
    const def = catalog.find(f => f.fieldKey === pickerValue);
    if (!def) return;
    onChange([...fields, {
      key: def.fieldKey,
      label: labels[def.fieldKey] ?? def.fieldKey,
      fieldType: def.fieldType as SimpleItemField['fieldType'],
    }]);
    setPickerValue('');
  };

  const removeField = (i: number) => onChange(fields.filter((_, idx) => idx !== i));

  return (
    <div className="sif-wrap">
      {fields.length === 0 ? (
        <p className="sif-empty-txt">{t('simple_item_fields_empty', { defaultValue: 'No fields yet — add one to collect information when this item is worked.' })}</p>
      ) : (
        fields.map((field, i) => (
          <div key={field.key} className="sif-row">
            <span className="sif-field-label">{field.label}</span>
            <span className="sif-field-type-badge">{t(`simple_item_field_type_${field.fieldType}`, { defaultValue: field.fieldType })}</span>
            <button className="sif-rm-btn" onClick={() => removeField(i)}><X size={12} /></button>
          </div>
        ))
      )}

      {catalog.length === 0 ? (
        <p className="sif-empty-txt">
          {t('simple_item_fields_no_catalog', { defaultValue: 'No workflow fields defined yet — add some in Settings → Fields → Workflow Fields first.' })}
        </p>
      ) : (
        <div className="sif-picker-row">
          <select className="sif-sel sif-picker-sel" value={pickerValue} onChange={e => setPickerValue(e.target.value)}>
            <option value="">{t('simple_item_field_picker_placeholder', { defaultValue: '— Select a workflow field —' })}</option>
            {availableToAdd.map(f => (
              <option key={f.fieldKey} value={f.fieldKey}>{labels[f.fieldKey] ?? f.fieldKey}</option>
            ))}
          </select>
          <button className="sif-add-btn" onClick={addField} disabled={!pickerValue}>
            <Plus size={10} /> {t('simple_item_add_field_btn', { defaultValue: 'Add field' })}
          </button>
        </div>
      )}
    </div>
  );
};
