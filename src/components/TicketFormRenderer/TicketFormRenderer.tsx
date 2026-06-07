import { useTranslation } from 'react-i18next';
import { Sparkles, Lock } from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { UserPickerControl } from '../UserPickerControl/UserPickerControl';
import { LabelPickerControl } from '../LabelPickerControl/LabelPickerControl';
import { AttachmentsControl } from '../AttachmentsControl/AttachmentsControl';
import { ActivityLogControl } from '../ActivityLogControl/ActivityLogControl';
import type { TemplateLayoutField } from '../../pages/Tickets/ticketTypes';
import './TicketFormRenderer.css';

const FIELD_BAR_COLORS: Record<string, string> = {
  title:        '#3b82f6',
  description:  '#8b5cf6',
  status:       '#f59e0b',
  request_user: '#3b82f6',
  responsible:  '#3b82f6',
  labels:       '#06b6d4',
  attachments:  '#f97316',
  activity_log: '#10b981',
  emails:       '#ec4899',
};

const FIELD_TYPE_ICONS: Record<string, string> = {
  text:         'Aa',
  'rich-text':  '📝',
  combobox:     '▾',
  date:         '📅',
  number:       '#',
  checkbox:     '☑',
  labels:       '🏷',
  attachments:  '📎',
  activity_log: '📋',
};

const STATUS_OPTIONS = ['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];

interface Props {
  layout: TemplateLayoutField[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  aiFilledFields?: string[];
  readOnly?: boolean;
  entityId?: number;
}

interface FieldControlProps {
  field: TemplateLayoutField;
  value: any;
  onChange: (key: string, value: any) => void;
  readOnly: boolean;
  entityId?: number;
}

// Proper React component — hooks are allowed here
const FieldControl = ({ field, value, onChange, readOnly, entityId }: FieldControlProps) => {
  const { t } = useTranslation();

  switch (field.fieldKey) {
    case 'title':
      return (
        <input
          type="text"
          className="tfr-title-input"
          value={value ?? ''}
          onChange={(e) => onChange(field.fieldKey, e.target.value)}
          readOnly={readOnly}
          placeholder={t('ticket_title_col')}
        />
      );

    case 'description':
      return (
        <RichTextEditor
          content={value ?? ''}
          onChange={(html) => onChange(field.fieldKey, html)}
          editable={!readOnly}
        />
      );

    case 'request_user':
      return (
        <UserPickerControl
          mode="all"
          value={value}
          onChange={(v) => onChange(field.fieldKey, v)}
          readonly={readOnly}
        />
      );

    case 'responsible':
      return (
        <UserPickerControl
          mode="managers"
          value={value}
          onChange={(v) => onChange(field.fieldKey, v)}
          readonly={readOnly}
        />
      );

    case 'labels':
      return (
        <LabelPickerControl
          value={Array.isArray(value) ? value : []}
          onChange={(v) => onChange(field.fieldKey, v)}
          readonly={readOnly}
        />
      );

    case 'attachments':
      return entityId != null ? (
        <AttachmentsControl
          entityType="ticket"
          entityId={entityId}
          readonly={readOnly}
        />
      ) : (
        <div className="tfr-activity-placeholder">Attachments available after ticket is saved.</div>
      );

    case 'activity_log':
      return <ActivityLogControl readonly={readOnly} />;

    default:
      if (field.fieldType === 'combobox') {
        const options = field.fieldOptions?.length
          ? field.fieldOptions
          : field.fieldKey === 'status' ? STATUS_OPTIONS : [];
        return (
          <select
            className="tfr-select"
            value={value ?? ''}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            disabled={readOnly}
          >
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        );
      }

      if (field.fieldType === 'date') {
        return (
          <input
            type="date"
            className="tfr-input"
            value={value ?? ''}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            readOnly={readOnly}
          />
        );
      }

      if (field.fieldType === 'number') {
        return (
          <input
            type="number"
            className="tfr-input"
            value={value ?? ''}
            onChange={(e) => onChange(field.fieldKey, e.target.value)}
            readOnly={readOnly}
          />
        );
      }

      return (
        <input
          type="text"
          className="tfr-input"
          value={value ?? ''}
          onChange={(e) => onChange(field.fieldKey, e.target.value)}
          readOnly={readOnly}
        />
      );
  }
};

export const TicketFormRenderer = ({
  layout,
  values,
  onChange,
  aiFilledFields = [],
  readOnly = false,
  entityId,
}: Props) => {
  const { t } = useTranslation();

  return (
    <div className="tfr-form">
      {layout.map((field) => {
        const isAiFilled = aiFilledFields.includes(field.fieldKey);
        const barColor   = FIELD_BAR_COLORS[field.fieldKey] ?? '#64748b';
        const value      = values[field.fieldKey] ?? field.defaultValue ?? '';

        return (
          <div
            key={field.fieldKey}
            className={`tfr-field-card${field.width === 'half' ? ' tfr-half' : ''}`}
            style={{ borderLeftColor: barColor }}
          >
            <div className="tfr-field-header">
              <div className="tfr-field-meta">
                <span className="tfr-field-type-badge">
                  {FIELD_TYPE_ICONS[field.fieldType] ?? 'Aa'} {field.fieldType}
                </span>
                {field.isSystem && (
                  <span className="tfr-system-badge">
                    <Lock size={10} /> {t('template_mandatory_badge')}
                  </span>
                )}
              </div>
              <div className="tfr-field-title">
                {t(field.fieldKey, { defaultValue: field.fieldKey.replace(/_/g, ' ') })}
              </div>
              {isAiFilled && (
                <span className="tfr-ai-badge">
                  <Sparkles size={11} /> AI
                </span>
              )}
            </div>

            <div className="tfr-field-control">
              <FieldControl
                field={field}
                value={value}
                onChange={onChange}
                readOnly={readOnly}
                entityId={entityId}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
