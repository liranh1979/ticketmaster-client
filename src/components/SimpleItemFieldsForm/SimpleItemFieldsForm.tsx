import { useTranslation } from 'react-i18next';
import type { SimpleItemField } from '../../pages/Settings/TicketsTemplates/SimpleItemFieldsEditor';
import './SimpleItemFieldsForm.css';

// Renders the actual input controls for a Simple action item's own mini-fields (defined via
// SimpleItemFieldsEditor), bound to that item's WorkflowItemEntity.fieldValues. Used by both the
// end-user ActionItemPage and the admin WorkflowTreePanel — same fields, same values, two audiences.
export const SimpleItemFieldsForm = ({
  fields, values, onChange, disabled,
}: {
  fields: SimpleItemField[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  disabled?: boolean;
}) => {
  const { t } = useTranslation();

  if (fields.length === 0) return null;

  return (
    <div className="sitf-wrap">
      {fields.map(field => (
        <div key={field.key} className="sitf-field">
          <label className="sitf-label">{field.label}</label>
          {field.fieldType === 'checkbox' ? (
            <input
              type="checkbox"
              checked={!!values[field.key]}
              onChange={e => onChange(field.key, e.target.checked)}
              disabled={disabled}
            />
          ) : (
            <input
              className="sitf-inp"
              type={field.fieldType === 'number' ? 'number' : field.fieldType === 'date' ? 'date' : 'text'}
              value={values[field.key] ?? ''}
              onChange={e => onChange(field.key, field.fieldType === 'number' ? e.target.valueAsNumber : e.target.value)}
              disabled={disabled}
              placeholder={t('simple_item_field_value_placeholder', { defaultValue: 'Enter {{label}}', label: field.label }) as string}
            />
          )}
        </div>
      ))}
    </div>
  );
};
