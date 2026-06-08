import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Lock } from 'lucide-react';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { UserPickerControl } from '../UserPickerControl/UserPickerControl';
import { LabelPickerControl } from '../LabelPickerControl/LabelPickerControl';
import { AttachmentsControl } from '../AttachmentsControl/AttachmentsControl';
import { ActivityLogControl } from '../ActivityLogControl/ActivityLogControl';
import type { TemplateLayoutField, TemplateTab } from '../../pages/Tickets/ticketTypes';
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
  nodelist:     '≡',
};

const STATUS_OPTIONS = ['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];

interface Props {
  tabs: TemplateTab[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  isAdmin?: boolean;
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

const NodeListControl = ({ value, onChange, readOnly }: { value: any; onChange: (v: string[]) => void; readOnly: boolean }) => {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const items: string[] = Array.isArray(value) ? value : [];

  const update = (i: number, text: string) => {
    const next = [...items];
    next[i] = text;
    onChange(next);
  };

  const remove = (i: number) => onChange(items.filter((_, j) => j !== i));

  const add = () => {
    const val = draft.trim();
    if (!val) return;
    onChange([...items, val]);
    setDraft('');
  };

  return (
    <div className="tfr-nodelist">
      {items.length === 0 && readOnly && (
        <span className="tfr-nodelist-empty">{t('nodelist_empty', { defaultValue: 'No nodes yet' })}</span>
      )}
      {items.map((item, i) => (
        <div key={i} className="tfr-node-row">
          <input
            className="tfr-input tfr-node-input"
            value={item}
            onChange={e => update(i, e.target.value)}
            readOnly={readOnly}
          />
          {!readOnly && (
            <button className="tfr-node-remove" onClick={() => remove(i)}>×</button>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="tfr-node-add-row">
          <input
            className="tfr-input tfr-node-add-input"
            placeholder={t('nodelist_add_placeholder', { defaultValue: 'Add a node…' })}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button className="tfr-node-add-btn" onClick={add} disabled={!draft.trim()}>+</button>
        </div>
      )}
    </div>
  );
};

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

      if (field.fieldType === 'nodelist') {
        return (
          <NodeListControl
            value={value}
            onChange={(v) => onChange(field.fieldKey, v)}
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

const FieldCards = ({
  fields, values, onChange, aiFilledFields, readOnly, entityId, t,
}: {
  fields: TemplateLayoutField[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  aiFilledFields: string[];
  readOnly: boolean;
  entityId?: number;
  t: (key: string, opts?: any) => string;
}) => (
  <>
    {fields.map((field) => {
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
            {field.isAdminOnly && (
              <span className="tfr-admin-badge">
                <Lock size={10} /> Admin
              </span>
            )}
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
  </>
);

export const TicketFormRenderer = ({
  tabs,
  values,
  onChange,
  isAdmin = false,
  aiFilledFields = [],
  readOnly = false,
  entityId,
}: Props) => {
  const { t } = useTranslation();
  const [activeTabKey, setActiveTabKey] = useState<string>(() => tabs[0]?.tabKey ?? '');

  // Build visible tabs (filter admin-only fields; drop tabs that become empty)
  const visibleTabs = tabs.map(tab => ({
    ...tab,
    fields: isAdmin ? tab.fields : tab.fields.filter(f => !f.isAdminOnly),
  })).filter(tab => tab.fields.length > 0);

  const showTabs = visibleTabs.length > 1;
  const activeTab = visibleTabs.find(t => t.tabKey === activeTabKey) ?? visibleTabs[0];

  if (!activeTab) return null;

  return (
    <div className="tfr-root">
      {showTabs && (
        <div className="tfr-tab-bar">
          {visibleTabs.map(tab => (
            <button
              key={tab.tabKey}
              className={`tfr-tab-btn${tab.tabKey === activeTab.tabKey ? ' tfr-tab-active' : ''}`}
              onClick={() => setActiveTabKey(tab.tabKey)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
      <div className="tfr-form">
        <FieldCards
          fields={activeTab.fields}
          values={values}
          onChange={onChange}
          aiFilledFields={aiFilledFields}
          readOnly={readOnly}
          entityId={entityId}
          t={t}
        />
      </div>
    </div>
  );
};
