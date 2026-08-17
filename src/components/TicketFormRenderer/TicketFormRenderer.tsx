import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Lock, GitBranch, ClipboardCopy } from 'lucide-react';
import api from '../../api';
import { WorkflowTreePanel } from '../WorkflowTreePanel/WorkflowTreePanel';
import '../WorkflowTreePanel/WorkflowTreePanel.css';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { UserPickerControl } from '../UserPickerControl/UserPickerControl';
import { LabelPickerControl } from '../LabelPickerControl/LabelPickerControl';
import { AttachmentsControl } from '../AttachmentsControl/AttachmentsControl';
import { ActivityLogControl } from '../ActivityLogControl/ActivityLogControl';
import { TimerFieldControl } from '../TimerFieldControl/TimerFieldControl';
import { TicketRelationsPanel } from '../TicketRelationsPanel/TicketRelationsPanel';
import '../TicketRelationsPanel/TicketRelationsPanel.css';
import { SlaCountdownWidget } from '../SlaCountdownWidget/SlaCountdownWidget';
import '../SlaCountdownWidget/SlaCountdownWidget.css';
import type { TemplateLayoutField, TemplateTab, FieldVisibility, SlaState } from '../../pages/Tickets/ticketTypes';
import './TicketFormRenderer.css';
import '../TimerFieldControl/TimerFieldControl.css';

const FIELD_BAR_COLORS: Record<string, string> = {
  title:        '#3b82f6',
  description:  '#8b5cf6',
  status:       '#f59e0b',
  priority:     '#ef4444',
  request_user: '#3b82f6',
  responsible:  '#3b82f6',
  labels:       '#06b6d4',
  attachments:  '#f97316',
  activity_log: '#10b981',
  emails:       '#ec4899',
  approval_flow:'#4f46e5',
  ticket_relations: '#8b5cf6',
  sla: '#ef4444',
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
  workflow:     '⚙',
  ticket_relations: '🔗',
  sla: '⏱',
};

const STATUS_OPTIONS = ['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];

interface Props {
  tabs: TemplateTab[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  isAdmin?: boolean;
  aiFilledFields?: string[];
  readOnly?: boolean;
  entityId?: number;
  onNavigateTicket?: (id: number) => void;
  // Same type='ticket_fields' translation bundle Template Builder uses for its
  // palette/canvas labels — keeps field card titles identical in both places
  // instead of falling back to the raw fieldKey.
  fieldLabels?: Record<string, string>;
  slaState?: SlaState | null;
  currentUserId?: number;
}

interface FieldControlProps {
  field: TemplateLayoutField;
  value: any;
  onChange: (key: string, value: any) => void;
  readOnly: boolean;
  entityId?: number;
  isAdmin?: boolean;
  onNavigateTicket?: (id: number) => void;
  slaState?: SlaState | null;
  currentUserId?: number;
}

const WorkflowFieldButton = ({ entityId, isAdmin, currentUserId }: { entityId?: number; isAdmin?: boolean; currentUserId?: number }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="tfr-workflow-btn"
        onClick={() => setOpen(true)}
        disabled={!entityId}
        title={!entityId ? 'Save the ticket first to view its workflow' : 'View workflow items'}
      >
        <GitBranch size={14} />
        View Workflow
      </button>
      {open && entityId != null && (
        <WorkflowTreePanel
          ticketId={entityId}
          isAdmin={isAdmin ?? false}
          currentUserId={currentUserId}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

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
const FieldControl = ({ field, value, onChange, readOnly, entityId, isAdmin, onNavigateTicket, slaState, currentUserId }: FieldControlProps) => {
  const { t } = useTranslation();
  const [copyingAiSolution, setCopyingAiSolution] = useState(false);

  const copyAiSolution = async () => {
    if (!entityId) return;
    setCopyingAiSolution(true);
    try {
      const res = await api.get(`/tickets/${entityId}/latest-ai-solution`);
      const text: string | null = res.data?.text;
      if (!text) {
        window.alert(t('ticket_solution_no_ai_solution', { defaultValue: 'No AI Solution has been saved for this ticket yet.' }));
        return;
      }
      if (value && String(value).trim()) {
        const proceed = window.confirm(t('ticket_solution_overwrite_confirm', {
          defaultValue: 'This will replace the current Solution content with the AI Solution text. Continue?',
        }));
        if (!proceed) return;
      }
      // Path A's saved text is plain text with \n separators, not HTML — wrap it into
      // paragraphs so a multi-line AI solution displays correctly once in the rich-text field.
      const html = /<[a-z][\s\S]*>/i.test(text)
        ? text
        : text.split(/\n{2,}/).map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`).join('');
      onChange(field.fieldKey, html);
    } finally {
      setCopyingAiSolution(false);
    }
  };

  if (field.fieldType === 'workflow') {
    return <WorkflowFieldButton entityId={entityId} isAdmin={isAdmin} currentUserId={currentUserId} />;
  }

  if (field.fieldType === 'sla') {
    return entityId != null ? (
      <SlaCountdownWidget slaState={slaState ?? null} />
    ) : (
      <div className="tfr-activity-placeholder">SLA clock starts once the ticket is saved.</div>
    );
  }

  if (field.fieldType === 'ticket_relations') {
    return entityId != null ? (
      <TicketRelationsPanel
        ticketId={entityId}
        isAdmin={isAdmin ?? false}
        onNavigateTicket={onNavigateTicket}
        onMerged={(targetId) => onNavigateTicket?.(targetId)}
      />
    ) : (
      <div className="tfr-activity-placeholder">Related tickets available after ticket is saved.</div>
    );
  }

  if (field.fieldType === 'timer') {
    return (
      <TimerFieldControl
        fieldKey={field.fieldKey}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    );
  }

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

    case 'solution':
      return (
        <div className="tfr-solution-field">
          {isAdmin && !readOnly && entityId != null && (
            <button
              type="button"
              className="tfr-copy-ai-solution-btn"
              onClick={copyAiSolution}
              disabled={copyingAiSolution}
            >
              <ClipboardCopy size={13} />
              {t('ticket_solution_copy_ai_btn', { defaultValue: 'Copy from AI Solution' })}
            </button>
          )}
          <RichTextEditor
            content={value ?? ''}
            onChange={(html) => onChange(field.fieldKey, html)}
            editable={!readOnly}
            uploadContext={entityId != null ? { entityType: 'ticket', entityId } : undefined}
          />
        </div>
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
      return <ActivityLogControl ticketId={entityId} readonly={readOnly} />;

    default:
      // Problem Management: generalized from the 'solution' case above so any custom field —
      // not just hardcoded system ones — can opt into a rich-text editor with real inline
      // uploads (root_cause, workaround). See V2/Problem Management/01-data-model.html.
      if (field.fieldType === 'richtext') {
        return (
          <RichTextEditor
            content={value ?? ''}
            onChange={(html) => onChange(field.fieldKey, html)}
            editable={!readOnly}
            uploadContext={entityId != null ? { entityType: 'ticket', entityId } : undefined}
          />
        );
      }

      // Custom boolean fields (e.g. known_error) previously fell through to a plain text
      // input — field_type='boolean' had no checkbox case here at all (only ever used by the
      // unrelated user-settings 'notifications' field, which never reaches this renderer).
      if (field.fieldType === 'boolean') {
        return (
          <input
            type="checkbox"
            className="tfr-checkbox"
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(field.fieldKey, e.target.checked)}
            disabled={readOnly}
          />
        );
      }

      if (field.fieldType === 'combobox') {
        const options = field.fieldOptions?.length
          ? field.fieldOptions
          : field.fieldKey === 'status' ? STATUS_OPTIONS
          : field.fieldKey === 'priority' ? PRIORITY_OPTIONS : [];
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
  fields, values, onChange, aiFilledFields, readOnly, entityId, isAdmin, onNavigateTicket, fieldLabels, slaState, currentUserId, t,
}: {
  fields: TemplateLayoutField[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  aiFilledFields: string[];
  readOnly: boolean;
  entityId?: number;
  isAdmin?: boolean;
  onNavigateTicket?: (id: number) => void;
  fieldLabels?: Record<string, string>;
  slaState?: SlaState | null;
  currentUserId?: number;
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
              {fieldLabels?.[field.fieldKey] || t(field.fieldKey, { defaultValue: field.fieldKey.replace(/_/g, ' ') })}
            </div>
            {(field.fieldVisibility === 'admin_only' || (!field.fieldVisibility && field.isAdminOnly)) && (
              <span className="tfr-admin-badge">
                <Lock size={10} /> Admin only
              </span>
            )}
            {field.fieldVisibility === 'user_view_admin_edit' && !isAdmin && (
              <span className="tfr-admin-badge">
                👁 View only
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
              readOnly={(field as any)._effectiveReadOnly ?? readOnly}
              entityId={entityId}
              isAdmin={isAdmin}
              onNavigateTicket={onNavigateTicket}
              slaState={slaState}
              currentUserId={currentUserId}
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
  onNavigateTicket,
  fieldLabels,
  slaState,
  currentUserId,
}: Props) => {
  const { t } = useTranslation();
  const [activeTabKey, setActiveTabKey] = useState<string>(() => tabs[0]?.tabKey ?? '');

  const getVisibility = (f: TemplateLayoutField): FieldVisibility =>
    f.fieldVisibility ?? (f.isAdminOnly ? 'admin_only' : 'all');

  // Build visible tabs: filter hidden fields, compute per-field effective readOnly
  const visibleTabs = tabs.map(tab => ({
    ...tab,
    fields: tab.fields
      .filter(f => isAdmin || getVisibility(f) !== 'admin_only')
      .map(f => ({
        ...f,
        _effectiveReadOnly: readOnly || (!isAdmin && getVisibility(f) === 'user_view_admin_edit'),
      })),
  })).filter(tab => tab.fields.length > 0);

  const showTabs = visibleTabs.length > 1;
  const activeTab = visibleTabs.find(t => t.tabKey === activeTabKey) ?? visibleTabs[0];

  if (!activeTab) return null;

  // Reuse the existing full/half width metadata to place short metadata fields
  // (status, priority, assignee, …) in a sidebar rail, and content fields
  // (title, description, attachments, …) in the main column — instead of
  // stacking everything one-per-row, which wastes horizontal space on wide screens.
  const mainFields = activeTab.fields.filter(f => f.width !== 'half');
  const sideFields  = activeTab.fields.filter(f => f.width === 'half');

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
      <div className={`tfr-columns${sideFields.length === 0 ? ' tfr-columns-single' : ''}`}>
        <div className="tfr-form tfr-main-col">
          <FieldCards
            fields={mainFields}
            values={values}
            onChange={onChange}
            aiFilledFields={aiFilledFields}
            readOnly={readOnly}
            entityId={entityId}
            isAdmin={isAdmin}
            onNavigateTicket={onNavigateTicket}
            fieldLabels={fieldLabels}
            slaState={slaState}
            currentUserId={currentUserId}
            t={t}
          />
        </div>
        {sideFields.length > 0 && (
          <div className="tfr-form tfr-side-col">
            <FieldCards
              fields={sideFields}
              values={values}
              onChange={onChange}
              aiFilledFields={aiFilledFields}
              readOnly={readOnly}
              entityId={entityId}
              isAdmin={isAdmin}
              onNavigateTicket={onNavigateTicket}
              fieldLabels={fieldLabels}
              slaState={slaState}
              t={t}
            />
          </div>
        )}
      </div>
    </div>
  );
};
