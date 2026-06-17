import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical, Lock, X, Plus, Sparkles, Save, Check, Columns, AlignJustify,
  Type, FileText, List, Calendar, Paperclip, MessageSquare, Mail, Tag, User,
  ChevronRight, ArrowLeft, GitBranch,
} from 'lucide-react';
import { WorkflowDesignerModal, type WorkflowFieldConfig } from './WorkflowDesignerModal';
import api from '../../../api';
import { RichTextEditor } from '../../../components/RichTextEditor/RichTextEditor';
import { AttachmentsControl } from '../../../components/AttachmentsControl/AttachmentsControl';
import { UserPickerControl } from '../../../components/UserPickerControl/UserPickerControl';
import { ActivityLogControl } from '../../../components/ActivityLogControl/ActivityLogControl';
import { LabelPickerControl } from '../../../components/LabelPickerControl/LabelPickerControl';
import './TemplateBuilderPage.css';

/* ── Types ── */
type FieldVisibility = 'admin_only' | 'all' | 'user_view_admin_edit';

export interface LayoutField {
  fieldKey: string;
  fieldType: string;
  isSystem: boolean;
  displayOrder: number;
  defaultValue: string;
  width: 'full' | 'half';
  fieldOptions?: string[];
  label?: string;
  fieldVisibility?: FieldVisibility;
  fieldConfig?: WorkflowFieldConfig;
}

export interface TabData {
  tabKey: string;
  label: string;
  fields: LayoutField[];
}

export interface TemplateLayout {
  tabs: TabData[];
}

interface FieldDefinition {
  id: number;
  fieldKey: string;
  fieldType: string;
  isSystem: boolean;
  fieldOptions?: string[];
  fieldVisibility?: string;
}

interface Props {
  templateId: number;
  onBack: () => void;
}

/* ── Field type config ── */
interface FieldConfig {
  icon: typeof Type;
  color: string;
  label: string;
}

const FIELD_TYPE_CONFIG: Record<string, FieldConfig> = {
  text:         { icon: Type,          color: '#64748b', label: 'Text'         },
  'rich-text':  { icon: FileText,      color: '#8b5cf6', label: 'Rich Text'    },
  combobox:     { icon: List,          color: '#f59e0b', label: 'Select'       },
  date:         { icon: Calendar,      color: '#10b981', label: 'Date'         },
  attachments:  { icon: Paperclip,     color: '#f97316', label: 'File Upload'  },
  activity_log: { icon: MessageSquare, color: '#06b6d4', label: 'Activity Log' },
  emails:       { icon: Mail,          color: '#06b6d4', label: 'Email'        },
  labels:       { icon: Tag,           color: '#3b82f6', label: 'Labels'       },
  workflow:     { icon: GitBranch,     color: '#4f46e5', label: 'Workflow'     },
};

const FIELD_KEY_CONFIG: Record<string, FieldConfig> = {
  activity:     { icon: MessageSquare, color: '#06b6d4', label: 'Activity Log' },
  request_user: { icon: User,          color: '#3b82f6', label: 'User Picker'  },
  responsible:  { icon: User,          color: '#8b5cf6', label: 'User Picker'  },
  attachments:  { icon: Paperclip,     color: '#f97316', label: 'File Upload'  },
  status:       { icon: Tag,           color: '#f59e0b', label: 'Status'       },
  title:        { icon: Type,          color: '#3b82f6', label: 'Title'        },
  description:  { icon: FileText,      color: '#8b5cf6', label: 'Rich Text'    },
  emails:       { icon: Mail,          color: '#06b6d4', label: 'Email'        },
  labels:       { icon: Tag,           color: '#3b82f6', label: 'Labels'       },
};

const getFieldConfig = (fieldKey: string, fieldType: string): FieldConfig =>
  FIELD_KEY_CONFIG[fieldKey] ??
  FIELD_TYPE_CONFIG[fieldType] ??
  FIELD_TYPE_CONFIG.text;

/* ── Status badge config ── */
const STATUS_STYLE: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  new:       { bg: '#1e3a5f', text: '#60a5fa', border: '#1d4ed8', dot: '#3b82f6' },
  open:      { bg: '#14532d', text: '#4ade80', border: '#16a34a', dot: '#22c55e' },
  completed: { bg: '#134e4a', text: '#2dd4bf', border: '#0f766e', dot: '#14b8a6' },
  closed:    { bg: '#1e293b', text: '#94a3b8', border: '#475569', dot: '#64748b' },
  rejected:  { bg: '#450a0a', text: '#f87171', border: '#dc2626', dot: '#ef4444' },
  pending:   { bg: '#451a03', text: '#fb923c', border: '#c2410c', dot: '#f97316' },
  blocked:   { bg: '#431407', text: '#fca5a5', border: '#ef4444', dot: '#f87171' },
};

/* ── Sortable field card ── */
function SortableFieldCard({
  field,
  translations,
  onRemove,
  onDefaultChange,
  onWidthToggle,
  onVisibilityChange,
  onOpenDesigner,
}: {
  field: LayoutField;
  translations: Record<string, string>;
  onRemove: (key: string) => void;
  onDefaultChange: (key: string, value: string) => void;
  onWidthToggle: (key: string) => void;
  onVisibilityChange: (key: string, vis: FieldVisibility) => void;
  onOpenDesigner?: (key: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.fieldKey });
  const { t } = useTranslation();
  const cfg = getFieldConfig(field.fieldKey, field.fieldType);
  const FieldIcon = cfg.icon;
  const label = translations[field.fieldKey] || field.fieldKey;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    borderLeftColor: cfg.color,
    borderLeftWidth: '3px' as const,
  };

  const renderDefaultControl = () => {
    if (field.fieldKey === 'attachments' || field.fieldType === 'attachments') {
      return (
        <div className="tb-field-sys-note">
          <Paperclip size={12} />
          Users upload files when submitting the ticket
        </div>
      );
    }
    if (field.fieldKey === 'activity') {
      return (
        <div className="tb-field-sys-note">
          <MessageSquare size={12} />
          Activity entries are created automatically as the ticket is updated
        </div>
      );
    }
    if (field.fieldKey === 'labels' || field.fieldType === 'labels') {
      return (
        <div className="tb-field-sys-note">
          <Tag size={12} />
          Labels are selected from your label library — manage them in Settings → Labels
        </div>
      );
    }
    if (field.fieldKey === 'request_user') {
      return (
        <UserPickerControl
          mode="all"
          value={field.defaultValue}
          onChange={val => onDefaultChange(field.fieldKey, val)}
          compact
        />
      );
    }
    if (field.fieldKey === 'responsible') {
      return (
        <UserPickerControl
          mode="managers"
          value={field.defaultValue}
          onChange={val => onDefaultChange(field.fieldKey, val)}
          compact
        />
      );
    }
    if (field.fieldType === 'rich-text') {
      return (
        <RichTextEditor
          content={field.defaultValue}
          onChange={html => onDefaultChange(field.fieldKey, html)}
          compact
        />
      );
    }
    if (field.fieldType === 'combobox' && field.fieldOptions?.length) {
      return (
        <select
          value={field.defaultValue}
          onChange={e => onDefaultChange(field.fieldKey, e.target.value)}
          className="tb-default-select"
        >
          <option value="">— No default —</option>
          {field.fieldOptions.map(opt => (
            <option key={opt} value={opt}>
              {translations[`${field.fieldKey}_opt_${opt}`] || opt}
            </option>
          ))}
        </select>
      );
    }
    if (field.fieldType === 'timer') {
      let parsed: { duration_value?: number; duration_unit?: string } = {};
      try { parsed = JSON.parse(field.defaultValue || '{}'); } catch {}
      const dv = parsed.duration_value ?? 1;
      const du = parsed.duration_unit ?? 'hours';
      const update = (nextDv: number, nextDu: string) =>
        onDefaultChange(field.fieldKey, JSON.stringify({ duration_value: nextDv, duration_unit: nextDu }));
      return (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="number"
            min={1}
            value={dv}
            onChange={e => update(Math.max(1, parseInt(e.target.value) || 1), du)}
            className="tb-default-input"
            style={{ width: 72 }}
          />
          <select
            value={du}
            onChange={e => update(dv, e.target.value)}
            className="tb-default-select"
          >
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      );
    }
    if (field.fieldType === 'workflow') {
      const nodeCount = field.fieldConfig?.nodes?.length ?? 0;
      return (
        <button className="tb-design-workflow-btn" onClick={() => onOpenDesigner?.(field.fieldKey)}>
          <GitBranch size={12} />
          {nodeCount > 0 ? `${nodeCount} node${nodeCount === 1 ? '' : 's'} designed` : 'Design Workflow'}
        </button>
      );
    }
    if (field.fieldType === 'date') {
      return (
        <div className="tb-date-wrap">
          <Calendar size={12} className="tb-date-icon" />
          <input
            type="date"
            value={field.defaultValue}
            onChange={e => onDefaultChange(field.fieldKey, e.target.value)}
            className="tb-default-input"
          />
        </div>
      );
    }
    return (
      <input
        type="text"
        value={field.defaultValue}
        onChange={e => onDefaultChange(field.fieldKey, e.target.value)}
        className="tb-default-input"
        placeholder="No default value"
      />
    );
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`tb-field-card ${isDragging ? 'dragging' : ''}`}
    >
      {/* Card header row */}
      <div className="tb-field-header">
        <span className="tb-drag-handle" {...attributes} {...listeners}>
          <GripVertical size={14} />
        </span>

        <span className="tb-type-icon" style={{ color: cfg.color }}>
          <FieldIcon size={15} />
        </span>

        <div className="tb-field-identity">
          <span className="tb-field-label">{label}</span>
          <div className="tb-field-chips">
            <span className="tb-type-chip">{cfg.label}</span>
            {field.isSystem && <span className="tb-sys-chip">System</span>}
            <span className={`tb-width-chip ${field.width}`}>
              {field.width === 'full' ? 'Full width' : 'Half width'}
            </span>
          </div>
        </div>

        <div className="tb-field-actions">
          <select
            className="tb-visibility-select"
            value={field.fieldVisibility ?? 'all'}
            onChange={e => onVisibilityChange(field.fieldKey, e.target.value as FieldVisibility)}
            title="Who can see / edit this field"
          >
            <option value="all">👥 All</option>
            <option value="user_view_admin_edit">👁 View / Admin edits</option>
            <option value="admin_only">🔒 Admin only</option>
          </select>

          <button
            className={`tb-width-btn ${field.width}`}
            onClick={() => onWidthToggle(field.fieldKey)}
            title={field.width === 'full' ? 'Switch to half-width' : 'Switch to full-width'}
          >
            {field.width === 'full' ? <Columns size={12} /> : <AlignJustify size={12} />}
          </button>

          {field.isSystem ? (
            <span className="tb-lock" title={t('template_mandatory_badge')}>
              <Lock size={13} />
            </span>
          ) : (
            <button
              className="tb-remove-btn"
              onClick={() => onRemove(field.fieldKey)}
              title="Remove from template"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Card body — default value */}
      <div className="tb-field-body">
        <span className="tb-default-label">{t('template_default_value_label')}</span>
        <div className="tb-default-control">
          {renderDefaultControl()}
        </div>
      </div>
    </div>
  );
}

/* ── Preview field ── */
function PreviewField({
  field,
  translations,
  parentId,
}: {
  field: LayoutField;
  translations: Record<string, string>;
  parentId?: number;
}) {
  const label = translations[field.fieldKey] || field.fieldKey;

  const renderControl = () => {
    /* Activity log */
    if (field.fieldKey === 'activity') {
      return <ActivityLogControl previewMode readonly />;
    }

    /* Attachments */
    if (field.fieldKey === 'attachments' || field.fieldType === 'attachments') {
      return parentId !== undefined
        ? <AttachmentsControl entityType="template_preview" entityId={parentId} />
        : <div className="tb-preview-placeholder">No attachments</div>;
    }

    /* User pickers */
    if (field.fieldKey === 'request_user') {
      return <UserPickerControl mode="all" value={field.defaultValue} readonly />;
    }
    if (field.fieldKey === 'responsible') {
      return <UserPickerControl mode="managers" value={field.defaultValue} readonly />;
    }

    /* Title — large input */
    if (field.fieldKey === 'title') {
      return (
        <input
          type="text"
          className="tb-preview-title"
          defaultValue={field.defaultValue}
          placeholder="Enter ticket title…"
          disabled
        />
      );
    }

    /* Status — colored badge pills */
    if (field.fieldKey === 'status' && field.fieldType === 'combobox' && field.fieldOptions?.length) {
      const selected = field.defaultValue || field.fieldOptions[0] || '';
      return (
        <div className="tb-status-options">
          {field.fieldOptions.map(opt => {
            const isSelected = opt === selected;
            const s = STATUS_STYLE[opt];
            return (
              <div
                key={opt}
                className={`tb-status-opt ${isSelected ? 'active' : ''}`}
                style={isSelected && s
                  ? { background: s.bg, color: s.text, borderColor: s.border }
                  : undefined}
              >
                <span
                  className="tb-status-dot"
                  style={{ background: isSelected && s ? s.dot : '#334155' }}
                />
                {translations[`status_opt_${opt}`] || opt}
              </div>
            );
          })}
        </div>
      );
    }

    /* Labels */
    if (field.fieldKey === 'labels' || field.fieldType === 'labels') {
      return <LabelPickerControl previewMode readonly />;
    }

    switch (field.fieldType) {
      case 'rich-text':
        return <RichTextEditor content={field.defaultValue || ''} editable={false} />;
      case 'combobox':
        return (
          <select className="tb-preview-select" defaultValue={field.defaultValue} disabled>
            {(field.fieldOptions || []).map(opt => (
              <option key={opt} value={opt}>
                {translations[`${field.fieldKey}_opt_${opt}`] || opt}
              </option>
            ))}
          </select>
        );
      case 'date':
        return (
          <div className="tb-preview-date-wrap">
            <Calendar size={13} className="tb-preview-date-icon" />
            <input
              type="date"
              className="tb-preview-input"
              defaultValue={field.defaultValue}
              disabled
            />
          </div>
        );
      case 'emails':
        return <div className="tb-preview-placeholder">No emails linked</div>;
      default:
        return (
          <input
            type="text"
            className="tb-preview-input"
            defaultValue={field.defaultValue}
            placeholder="—"
            disabled
          />
        );
    }
  };

  return (
    <div className={`tb-preview-field ${field.width}`}>
      <label className="tb-preview-label">{label}</label>
      {renderControl()}
    </div>
  );
}

/* ── Main builder ── */
export const TemplateBuilderPage = ({ templateId, onBack }: Props) => {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor));

  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [layout, setLayout] = useState<TemplateLayout>({ tabs: [] });
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [editingTabKey, setEditingTabKey] = useState<string | null>(null);
  const [editingTabLabel, setEditingTabLabel] = useState('');
  const tabEditRef = useRef<HTMLInputElement>(null);

  const [allFields, setAllFields] = useState<FieldDefinition[]>([]);
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [templateAiPurpose, setTemplateAiPurpose] = useState('');
  const [versionNumber, setVersionNumber] = useState(1);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const [workflowDesignerKey, setWorkflowDesignerKey] = useState<string | null>(null);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<TemplateLayout | null>(null);

  /* ── Load ── */
  useEffect(() => {
    const load = async () => {
      const [tplRes, fieldsRes, transRes] = await Promise.all([
        api.get(`/templates/${templateId}`),
        api.get('/field-definitions', { params: { entityType: 'ticket' } }),
        api.get('/field-definitions/translations/en', { params: { translationType: 'ticket_fields' } }),
      ]);
      const tpl = tplRes.data;
      setTemplateName(tpl.name);
      setTemplateDesc(tpl.description || '');
      setTemplateAiPurpose(tpl.aiPurpose || '');
      setVersionNumber(tpl.currentVersionNumber);

      const fieldDefs: FieldDefinition[] = fieldsRes.data;
      const trans: Record<string, string> = transRes.data;
      setAllFields(fieldDefs);
      setTranslations(trans);

      const mergeFields = (fields: LayoutField[]): LayoutField[] =>
        fields.map(lf => {
          const def = fieldDefs.find(fd => fd.fieldKey === lf.fieldKey);
          return {
            ...lf,
            width: lf.width || 'full',
            fieldOptions: def?.fieldOptions ?? lf.fieldOptions ?? [],
            label: trans[lf.fieldKey],
          };
        });

      const rawLayout = tpl.layout;
      let tabs: TabData[];
      if (Array.isArray(rawLayout)) {
        tabs = [{ tabKey: 'main', label: 'Main', fields: mergeFields(rawLayout as LayoutField[]) }];
      } else {
        tabs = ((rawLayout?.tabs as TabData[]) || []).map(tab => ({
          ...tab,
          fields: mergeFields(tab.fields),
        }));
      }
      setLayout({ tabs });
    };
    load();
  }, [templateId]);

  useEffect(() => {
    if (editingTabKey) tabEditRef.current?.focus();
  }, [editingTabKey]);

  /* ── Derived ── */
  const safeTabIdx = Math.min(activeTabIdx, Math.max(0, layout.tabs.length - 1));
  const activeTab = layout.tabs[safeTabIdx];
  const usedKeys = new Set(layout.tabs.flatMap(t => t.fields.map(f => f.fieldKey)));
  const availableFields = allFields.filter(f => !usedKeys.has(f.fieldKey));
  const systemAvailable = availableFields.filter(f => f.isSystem);
  const customAvailable = availableFields.filter(f => !f.isSystem);

  /* ── Tab operations ── */
  const addTab = () => {
    const newTab: TabData = {
      tabKey: `tab_${Date.now().toString(36)}`,
      label: `Tab ${layout.tabs.length + 1}`,
      fields: [],
    };
    setLayout(prev => ({ tabs: [...prev.tabs, newTab] }));
    setActiveTabIdx(layout.tabs.length);
    setIsDirty(true);
  };

  const deleteTab = (idx: number) => {
    if (layout.tabs.length <= 1) return;
    setLayout(prev => ({ tabs: prev.tabs.filter((_, i) => i !== idx) }));
    setActiveTabIdx(prev => Math.min(prev, layout.tabs.length - 2));
    setIsDirty(true);
  };

  const commitTabRename = (tabKey: string) => {
    if (editingTabLabel.trim()) {
      setLayout(prev => ({
        tabs: prev.tabs.map(t =>
          t.tabKey === tabKey ? { ...t, label: editingTabLabel.trim() } : t
        ),
      }));
      setIsDirty(true);
    }
    setEditingTabKey(null);
  };

  /* ── Field operations ── */
  const addField = useCallback((field: FieldDefinition) => {
    setLayout(prev => {
      if (field.fieldType === 'workflow') {
        const alreadyHas = prev.tabs.some(t => t.fields.some(f => f.fieldType === 'workflow'));
        if (alreadyHas) return prev;
      }
      const activeTabFields = prev.tabs[safeTabIdx]?.fields ?? [];
      const newField: LayoutField = {
        fieldKey: field.fieldKey,
        fieldType: field.fieldType,
        isSystem: field.isSystem,
        displayOrder: activeTabFields.length + 1,
        defaultValue: '',
        width: 'full',
        fieldOptions: field.fieldOptions || [],
        fieldVisibility: (field.fieldVisibility as FieldVisibility) ?? 'all',
        ...(field.fieldType === 'workflow' ? { fieldConfig: { nodes: [] } } : {}),
      };
      return {
        tabs: prev.tabs.map((t, i) =>
          i === safeTabIdx ? { ...t, fields: [...t.fields, newField] } : t
        ),
      };
    });
    setIsDirty(true);
  }, [safeTabIdx]);

  const removeField = useCallback((key: string) => {
    setLayout(prev => ({
      tabs: prev.tabs.map((t, i) =>
        i === safeTabIdx ? { ...t, fields: t.fields.filter(f => f.fieldKey !== key) } : t
      ),
    }));
    setIsDirty(true);
  }, [safeTabIdx]);

  const onDefaultChange = useCallback((key: string, value: string) => {
    setLayout(prev => ({
      tabs: prev.tabs.map((t, i) =>
        i === safeTabIdx
          ? { ...t, fields: t.fields.map(f => f.fieldKey === key ? { ...f, defaultValue: value } : f) }
          : t
      ),
    }));
    setIsDirty(true);
  }, [safeTabIdx]);

  const onVisibilityChange = useCallback((key: string, vis: FieldVisibility) => {
    setLayout(prev => ({
      tabs: prev.tabs.map((t, i) =>
        i !== safeTabIdx ? t : {
          ...t,
          fields: t.fields.map(f => f.fieldKey === key ? { ...f, fieldVisibility: vis } : f),
        }
      ),
    }));
    setIsDirty(true);
  }, [safeTabIdx]);

  const onWidthToggle = useCallback((key: string) => {
    setLayout(prev => ({
      tabs: prev.tabs.map((t, i) =>
        i === safeTabIdx
          ? { ...t, fields: t.fields.map(f => f.fieldKey === key ? { ...f, width: f.width === 'full' ? 'half' : 'full' } : f) }
          : t
      ),
    }));
    setIsDirty(true);
  }, [safeTabIdx]);

  const handleWorkflowSave = useCallback((fieldKey: string, config: WorkflowFieldConfig) => {
    setLayout(prev => ({
      tabs: prev.tabs.map(t => ({
        ...t,
        fields: t.fields.map(f =>
          f.fieldKey === fieldKey ? { ...f, fieldConfig: config } : f
        ),
      })),
    }));
    setWorkflowDesignerKey(null);
    setIsDirty(true);
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setLayout(prev => ({
      tabs: prev.tabs.map((t, i) => {
        if (i !== safeTabIdx) return t;
        const oldIdx = t.fields.findIndex(f => f.fieldKey === active.id);
        const newIdx = t.fields.findIndex(f => f.fieldKey === over.id);
        return {
          ...t,
          fields: arrayMove(t.fields, oldIdx, newIdx).map((f, j) => ({ ...f, displayOrder: j + 1 })),
        };
      }),
    }));
    setIsDirty(true);
  };

  /* ── Save ── */
  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await api.put(`/templates/${templateId}`, {
        name: templateName,
        description: templateDesc,
        aiPurpose: templateAiPurpose,
        layout: {
          tabs: layout.tabs.map(tab => ({
            tabKey: tab.tabKey,
            label: tab.label,
            fields: tab.fields.map(f => ({
              fieldKey: f.fieldKey,
              fieldType: f.fieldType,
              isSystem: f.isSystem,
              displayOrder: f.displayOrder,
              defaultValue: f.defaultValue,
              width: f.width,
              fieldVisibility: f.fieldVisibility,
              ...(f.fieldConfig !== undefined ? { fieldConfig: f.fieldConfig } : {}),
            })),
          })),
        },
      });
      setVersionNumber(res.data.currentVersionNumber);
      setIsDirty(false);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setIsSaving(false);
    }
  };

  /* ── AI ── */
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    setAiSuggestion(null);
    try {
      const res = await api.post(`/templates/${templateId}/ai-suggest`, { prompt: aiPrompt });
      const raw = res.data;
      const tabs: TabData[] = ((raw?.tabs as TabData[]) || []).map(tab => ({
        tabKey: tab.tabKey,
        label: tab.label,
        fields: (tab.fields || []).map((lf: LayoutField) => {
          const def = allFields.find(fd => fd.fieldKey === lf.fieldKey);
          return {
            ...lf,
            width: lf.width || 'full',
            fieldOptions: def?.fieldOptions ?? [],
            label: translations[lf.fieldKey],
          };
        }),
      }));
      setAiSuggestion({ tabs });
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiApply = () => {
    if (!aiSuggestion) return;
    setLayout(aiSuggestion);
    setActiveTabIdx(0);
    setAiSuggestion(null);
    setIsDirty(true);
  };

  /* ── Render ── */
  return (
    <div className="tb-page">

      {/* ── Top bar ── */}
      <div className="tb-topbar">
        <div className="tb-topbar-left">
          <button className="tb-back-btn" onClick={onBack} title="Back to templates">
            <ArrowLeft size={16} />
          </button>
          <div className="tb-breadcrumb">
            <span className="tb-breadcrumb-parent" onClick={onBack}>Templates</span>
            <ChevronRight size={14} className="tb-breadcrumb-sep" />
            <input
              className="tb-name-input"
              value={templateName}
              onChange={e => { setTemplateName(e.target.value); setIsDirty(true); }}
              placeholder={t('template_name_label')}
            />
          </div>
          <span className="tb-version-badge">v{versionNumber}</span>
          {isDirty && <span className="tb-unsaved-dot" title="Unsaved changes" />}
        </div>

        <div className="tb-topbar-center">
          <div className="tb-mode-toggle">
            <button
              className={mode === 'edit' ? 'active' : ''}
              onClick={() => setMode('edit')}
            >
              {t('template_edit_mode')}
            </button>
            <button
              className={mode === 'preview' ? 'active' : ''}
              onClick={() => setMode('preview')}
            >
              {t('template_preview_mode')}
            </button>
          </div>
        </div>

        <div className="tb-topbar-right">
          <button
            className={`tb-save-btn ${savedFlash ? 'saved' : ''}`}
            onClick={handleSave}
            disabled={!isDirty || isSaving}
          >
            {savedFlash
              ? <><Check size={14} /> {t('template_saved')}</>
              : <><Save size={14} /> {t('template_save')}</>}
          </button>
        </div>
      </div>

      {/* ── Description ── */}
      <input
        className="tb-desc-input"
        value={templateDesc}
        onChange={e => { setTemplateDesc(e.target.value); setIsDirty(true); }}
        placeholder={t('template_description_label')}
      />

      {/* ── AI Purpose ── */}
      <textarea
        className="tb-ai-purpose-textarea"
        value={templateAiPurpose}
        onChange={e => { setTemplateAiPurpose(e.target.value); setIsDirty(true); }}
        placeholder="AI guidance (optional): Describe when to use this template so the AI can auto-select it. E.g. 'Use for customer service requests where the user needs a new feature. Not for incidents or outages.'"
        rows={3}
      />

      {/* ── Tab bar ── */}
      <div className="tb-tab-bar">
        {layout.tabs.map((tab, idx) => (
          <div
            key={tab.tabKey}
            className={`tb-tab ${idx === safeTabIdx ? 'active' : ''}`}
            onClick={() => setActiveTabIdx(idx)}
          >
            {editingTabKey === tab.tabKey ? (
              <input
                ref={tabEditRef}
                className="tb-tab-edit-input"
                value={editingTabLabel}
                onChange={e => setEditingTabLabel(e.target.value)}
                onBlur={() => commitTabRename(tab.tabKey)}
                onKeyDown={e => {
                  if (e.key === 'Enter') commitTabRename(tab.tabKey);
                  if (e.key === 'Escape') setEditingTabKey(null);
                }}
                onClick={e => e.stopPropagation()}
              />
            ) : (
              <span
                className="tb-tab-label"
                onDoubleClick={e => {
                  e.stopPropagation();
                  setEditingTabKey(tab.tabKey);
                  setEditingTabLabel(tab.label);
                }}
              >
                {tab.label}
              </span>
            )}
            {layout.tabs.length > 1 && (
              <button
                className="tb-tab-close"
                onClick={e => { e.stopPropagation(); deleteTab(idx); }}
                title="Remove tab"
              >
                <X size={11} />
              </button>
            )}
          </div>
        ))}
        <button className="tb-add-tab-btn" onClick={addTab} title="Add tab">
          <Plus size={12} /> Tab
        </button>
      </div>

      {/* ── Edit mode ── */}
      {mode === 'edit' && activeTab && (
        <div className="tb-edit-layout">

          {/* Left panel — available fields */}
          <div className="tb-available-panel">
            <div className="tb-panel-header">
              <span className="tb-panel-title">{t('template_available_fields')}</span>
              {availableFields.length > 0 && (
                <span className="tb-panel-count">{availableFields.length}</span>
              )}
            </div>

            {availableFields.length === 0 ? (
              <div className="tb-panel-empty">
                <Check size={16} className="tb-panel-empty-icon" />
                All fields in use
              </div>
            ) : (
              <>
                {systemAvailable.length > 0 && (
                  <div className="tb-avail-group">
                    <div className="tb-avail-group-label">System</div>
                    {systemAvailable.map(f => {
                      const fcfg = getFieldConfig(f.fieldKey, f.fieldType);
                      const FIcon = fcfg.icon;
                      return (
                        <div key={f.fieldKey} className="tb-avail-field" onClick={() => addField(f)}>
                          <span className="tb-avail-icon" style={{ color: fcfg.color }}>
                            <FIcon size={14} />
                          </span>
                          <div className="tb-avail-info">
                            <span className="tb-avail-name">{translations[f.fieldKey] || f.fieldKey}</span>
                            <span className="tb-avail-type">{fcfg.label}</span>
                          </div>
                          <Plus size={11} className="tb-avail-add" />
                        </div>
                      );
                    })}
                  </div>
                )}
                {customAvailable.length > 0 && (
                  <div className="tb-avail-group">
                    <div className="tb-avail-group-label">Custom</div>
                    {customAvailable.map(f => {
                      const fcfg = getFieldConfig(f.fieldKey, f.fieldType);
                      const FIcon = fcfg.icon;
                      return (
                        <div key={f.fieldKey} className="tb-avail-field" onClick={() => addField(f)}>
                          <span className="tb-avail-icon" style={{ color: fcfg.color }}>
                            <FIcon size={14} />
                          </span>
                          <div className="tb-avail-info">
                            <span className="tb-avail-name">{translations[f.fieldKey] || f.fieldKey}</span>
                            <span className="tb-avail-type">{fcfg.label}</span>
                          </div>
                          <Plus size={11} className="tb-avail-add" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right canvas — sortable field cards */}
          <div className="tb-canvas">
            <div className="tb-canvas-header">
              <span className="tb-panel-title">{t('template_layout_fields')}</span>
              <span className="tb-canvas-count">{activeTab.fields.length} fields</span>
            </div>

            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext
                items={activeTab.fields.map(f => f.fieldKey)}
                strategy={verticalListSortingStrategy}
              >
                <div className="tb-field-list">
                  {activeTab.fields.length === 0 && (
                    <div className="tb-canvas-empty">
                      <Plus size={20} className="tb-canvas-empty-icon" />
                      <span>Add fields from the panel on the left</span>
                    </div>
                  )}
                  {activeTab.fields.map(field => (
                    <SortableFieldCard
                      key={field.fieldKey}
                      field={field}
                      translations={translations}
                      onRemove={removeField}
                      onDefaultChange={onDefaultChange}
                      onWidthToggle={onWidthToggle}
                      onVisibilityChange={onVisibilityChange}
                      onOpenDesigner={setWorkflowDesignerKey}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            {/* AI panel */}
            <div className="tb-ai-panel">
              <div className="tb-ai-header">
                <Sparkles size={14} />
                <span>{t('template_ai_generate')}</span>
              </div>
              <div className="tb-ai-row">
                <textarea
                  className="tb-ai-textarea"
                  rows={2}
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  placeholder={t('template_ai_prompt_placeholder')}
                />
                <button
                  className="tb-ai-btn"
                  onClick={handleAiGenerate}
                  disabled={aiLoading || !aiPrompt.trim()}
                >
                  {aiLoading ? t('template_ai_generating') : t('template_ai_generate')}
                </button>
              </div>
              {aiSuggestion && (
                <div className="tb-ai-suggestion">
                  <div className="tb-ai-sug-header">
                    <span>
                      {aiSuggestion.tabs.flatMap(tab => tab.fields).length} fields suggested
                      {aiSuggestion.tabs.length > 1 ? ` across ${aiSuggestion.tabs.length} tabs` : ''}
                    </span>
                    <button className="tb-ai-apply-btn" onClick={handleAiApply}>
                      <Check size={13} /> {t('template_ai_apply')}
                    </button>
                  </div>
                  <ol className="tb-ai-sug-list">
                    {aiSuggestion.tabs.flatMap(tab => tab.fields).map(f => {
                      const fcfg = getFieldConfig(f.fieldKey, f.fieldType);
                      const FIcon = fcfg.icon;
                      return (
                        <li key={f.fieldKey}>
                          <span style={{ color: fcfg.color }}><FIcon size={11} /></span>
                          <span className="tb-ai-sug-name">{translations[f.fieldKey] || f.fieldKey}</span>
                          <span className="tb-avail-type">{fcfg.label}</span>
                          {f.isSystem && <span className="tb-sys-chip tb-sys-chip-sm">System</span>}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Workflow designer modal ── */}
      {workflowDesignerKey !== null && (() => {
        const wfField = layout.tabs.flatMap(t => t.fields).find(f => f.fieldKey === workflowDesignerKey);
        if (!wfField) return null;
        return (
          <WorkflowDesignerModal
            fieldLabel={translations[wfField.fieldKey] || wfField.fieldKey}
            fieldConfig={wfField.fieldConfig ?? { nodes: [] }}
            ticketFieldKeys={layout.tabs.flatMap(t => t.fields)
              .filter(f => f.fieldType !== 'workflow')
              .map(f => f.fieldKey)}
            onSave={config => handleWorkflowSave(workflowDesignerKey, config)}
            onClose={() => setWorkflowDesignerKey(null)}
          />
        );
      })()}

      {/* ── Preview mode ── */}
      {mode === 'preview' && (
        <div className="tb-preview-layout">
          <div className="tb-preview-form-wrapper">
            <div className="tb-preview-form-header">
              <div className="tb-preview-form-title">{templateName || 'Ticket'}</div>
              <span className="tb-preview-version-badge">v{versionNumber}</span>
            </div>

            {layout.tabs.length > 1 && (
              <div className="tb-preview-tabs">
                {layout.tabs.map((tab, idx) => (
                  <button
                    key={tab.tabKey}
                    className={`tb-preview-tab ${idx === safeTabIdx ? 'active' : ''}`}
                    onClick={() => setActiveTabIdx(idx)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}

            {activeTab && (
              <div className="tb-preview-grid">
                {activeTab.fields.map(field => (
                  <PreviewField
                    key={field.fieldKey}
                    field={field}
                    translations={translations}
                    parentId={templateId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
