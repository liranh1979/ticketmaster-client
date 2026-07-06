import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Plus, Trash2, Play, AlertCircle, GripVertical,
  ArrowLeft, CheckCircle, Loader2, Zap, X,
} from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../../../api';
import './AccelerationRulesPage.css';

// ── Types ────────────────────────────────────────────────────────────────────

interface AccelerationRule {
  id: number;
  name: string;
  description?: string;
  executionOrder: number;
  triggerConditions: string;
  actions: string;
  generatedScript?: string;
  isActive: boolean;
  lastError?: string;
}

interface LeafCondition {
  field: string;
  fieldType: string;
  isCustom: boolean;
  operator: string;
  value?: string | number | boolean;
  valueUnit?: string;
}

interface ConditionGroup {
  combinator: 'AND' | 'OR';
  conditions: ConditionNode[];
}

type ConditionNode = LeafCondition | ConditionGroup;

interface AvailableField {
  key: string;
  label: string;
  fieldType: string;
  isCustom: boolean;
  fieldOptions: string[] | null;
}

interface Action          { type: string; value?: string | number; }
interface AssignableOption { id: number; displayName: string; }
interface DiffEntry        { from: any; to: any; }

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];

const ACTION_TYPES = [
  { value: 'set_acceleration', valueType: 'number',        labelKey: 'acceleration_action_set_acceleration' },
  { value: 'set_status',       valueType: 'status-select', labelKey: 'acceleration_action_set_status' },
  { value: 'assign_to_user',   valueType: 'user-select',   labelKey: 'acceleration_action_assign_user' },
  { value: 'assign_to_group',  valueType: 'group-select',  labelKey: 'acceleration_action_assign_group' },
];

const OPERATORS_BY_FIELD_TYPE: Record<string, { value: string; labelKey: string }[]> = {
  text:          [{ value:'equals', labelKey:'acceleration_op_equals' }, { value:'not_equals', labelKey:'acceleration_op_not_equals' }, { value:'contains', labelKey:'acceleration_op_contains' }, { value:'not_contains', labelKey:'acceleration_op_not_contains' }],
  email:         [{ value:'equals', labelKey:'acceleration_op_equals' }, { value:'not_equals', labelKey:'acceleration_op_not_equals' }, { value:'contains', labelKey:'acceleration_op_contains' }, { value:'not_contains', labelKey:'acceleration_op_not_contains' }],
  phone:         [{ value:'equals', labelKey:'acceleration_op_equals' }, { value:'not_equals', labelKey:'acceleration_op_not_equals' }, { value:'contains', labelKey:'acceleration_op_contains' }, { value:'not_contains', labelKey:'acceleration_op_not_contains' }],
  url:           [{ value:'equals', labelKey:'acceleration_op_equals' }, { value:'not_equals', labelKey:'acceleration_op_not_equals' }, { value:'contains', labelKey:'acceleration_op_contains' }, { value:'not_contains', labelKey:'acceleration_op_not_contains' }],
  number:        [{ value:'equals', labelKey:'acceleration_op_equals' }, { value:'not_equals', labelKey:'acceleration_op_not_equals' }, { value:'lt', labelKey:'acceleration_op_lt' }, { value:'gt', labelKey:'acceleration_op_gt' }],
  date:          [{ value:'older_than', labelKey:'acceleration_op_older_than' }, { value:'newer_than', labelKey:'acceleration_op_newer_than' }],
  combobox:      [{ value:'equals', labelKey:'acceleration_op_equals' }, { value:'not_equals', labelKey:'acceleration_op_not_equals' }],
  'multi-select':[{ value:'contains', labelKey:'acceleration_op_contains' }, { value:'not_contains', labelKey:'acceleration_op_not_contains' }],
  multi_select:  [{ value:'contains', labelKey:'acceleration_op_contains' }, { value:'not_contains', labelKey:'acceleration_op_not_contains' }],
  checkbox:      [{ value:'is_true', labelKey:'acceleration_op_is_true' }, { value:'is_false', labelKey:'acceleration_op_is_false' }],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDefaultLeaf(field: AvailableField): LeafCondition {
  const ops = OPERATORS_BY_FIELD_TYPE[field.fieldType] ?? OPERATORS_BY_FIELD_TYPE.text;
  return {
    field: field.key,
    fieldType: field.fieldType,
    isCustom: field.isCustom,
    operator: ops[0].value,
    value: field.fieldType === 'checkbox' ? undefined
         : field.fieldType === 'number'   ? 0
         : field.fieldType === 'date'     ? 24
         : (field.fieldOptions?.[0] ?? ''),
    valueUnit: field.fieldType === 'date' ? 'hours' : undefined,
  };
}

function convertLegacyCondition(cond: any): LeafCondition {
  switch (cond.type) {
    case 'status':
      return { field:'status', fieldType:'combobox', isCustom:false, operator: cond.operator ?? 'equals', value: cond.value ?? 'open' };
    case 'created_before_hours':
      return { field:'createdAt', fieldType:'date', isCustom:false, operator:'older_than', value: cond.value ?? 24, valueUnit:'hours' };
    case 'acceleration_less_than':
      return { field:'acceleration', fieldType:'number', isCustom:false, operator:'lt', value: cond.value ?? 5 };
    case 'has_no_assignee':
      return { field:'responsibleUserId', fieldType:'number', isCustom:false, operator:'equals', value:0 };
    default:
      return { field:'status', fieldType:'combobox', isCustom:false, operator:'equals', value:'open' };
  }
}

// ── LeafRow ───────────────────────────────────────────────────────────────────

function LeafRow({
  leaf, availableFields, onChange, onRemove,
}: {
  leaf: LeafCondition;
  availableFields: AvailableField[];
  onChange: (updated: LeafCondition) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const systemFields = availableFields.filter(f => !f.isCustom);
  const customFields  = availableFields.filter(f => f.isCustom);
  const operators = OPERATORS_BY_FIELD_TYPE[leaf.fieldType] ?? OPERATORS_BY_FIELD_TYPE.text;
  const fieldMeta = availableFields.find(f => f.key === leaf.field);

  const handleFieldChange = (newKey: string) => {
    const nf = availableFields.find(f => f.key === newKey);
    if (!nf) return;
    onChange(makeDefaultLeaf(nf));
  };

  const renderValueInput = () => {
    const ft = leaf.fieldType;
    if (ft === 'checkbox') return null;
    if (ft === 'date') return (
      <>
        <input className="ar-input ar-input--narrow" type="number" min={1}
               value={String(leaf.value ?? 24)}
               onChange={e => onChange({ ...leaf, value: +e.target.value })} />
        <select className="ar-select ar-select--sm"
                value={leaf.valueUnit ?? 'hours'}
                onChange={e => onChange({ ...leaf, valueUnit: e.target.value })}>
          <option value="minutes">{t('acceleration_unit_minutes', { defaultValue: 'Minutes' })}</option>
          <option value="hours">{t('acceleration_unit_hours', { defaultValue: 'Hours' })}</option>
          <option value="days">{t('acceleration_unit_days', { defaultValue: 'Days' })}</option>
        </select>
      </>
    );
    if (ft === 'number') return (
      <input className="ar-input ar-input--narrow" type="number"
             value={String(leaf.value ?? 0)}
             onChange={e => onChange({ ...leaf, value: +e.target.value })} />
    );
    if (ft === 'combobox' || ft === 'multi-select' || ft === 'multi_select') {
      const opts = fieldMeta?.fieldOptions ?? [];
      return (
        <select className="ar-select ar-select--sm"
                value={String(leaf.value ?? '')}
                onChange={e => onChange({ ...leaf, value: e.target.value })}>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    return (
      <input className="ar-input ar-input--value" type="text"
             value={String(leaf.value ?? '')}
             onChange={e => onChange({ ...leaf, value: e.target.value })} />
    );
  };

  return (
    <div className="ar-builder-row">
      <button className="ar-remove-btn" onClick={onRemove}><X size={13} /></button>
      <select className="ar-select ar-select--sm"
              value={leaf.field}
              onChange={e => handleFieldChange(e.target.value)}>
        {systemFields.length > 0 && (
          <optgroup label={t('acceleration_system_fields_group', { defaultValue: 'System Fields' })}>
            {systemFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </optgroup>
        )}
        {customFields.length > 0 && (
          <optgroup label={t('acceleration_custom_fields_group', { defaultValue: 'Custom Fields' })}>
            {customFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
          </optgroup>
        )}
      </select>
      <select className="ar-select ar-select--sm"
              value={leaf.operator}
              onChange={e => onChange({ ...leaf, operator: e.target.value })}>
        {operators.map(op => (
          <option key={op.value} value={op.value}>
            {t(op.labelKey, { defaultValue: op.value })}
          </option>
        ))}
      </select>
      {renderValueInput()}
    </div>
  );
}

// ── RuleGroupEditor ───────────────────────────────────────────────────────────

function RuleGroupEditor({
  group, depth, availableFields, onChange, onRemove,
}: {
  group: ConditionGroup;
  depth: number;
  availableFields: AvailableField[];
  onChange: (updated: ConditionGroup) => void;
  onRemove?: () => void;
}) {
  const { t } = useTranslation();

  const addLeaf = () => {
    if (availableFields.length === 0) return;
    onChange({ ...group, conditions: [...group.conditions, makeDefaultLeaf(availableFields[0])] });
  };

  const addSubGroup = () => {
    const sub: ConditionGroup = { combinator: 'AND', conditions: [] };
    onChange({ ...group, conditions: [...group.conditions, sub] });
  };

  const removeChild = (i: number) =>
    onChange({ ...group, conditions: group.conditions.filter((_, idx) => idx !== i) });

  const updateChild = (i: number, updated: ConditionNode) =>
    onChange({ ...group, conditions: group.conditions.map((c, idx) => idx === i ? updated : c) });

  return (
    <div className={depth > 0 ? 'ar-group' : undefined}>
      <div className="ar-group-header">
        <span className="ar-combinator-label">{t('acceleration_combinator_label', { defaultValue: 'Match' })}</span>
        <div className="ar-combinator-toggle">
          <button
            className={`ar-toggle-btn${group.combinator === 'AND' ? ' active' : ''}`}
            onClick={() => onChange({ ...group, combinator: 'AND' })}
          >
            {t('acceleration_combinator_and', { defaultValue: 'ALL (AND)' })}
          </button>
          <button
            className={`ar-toggle-btn${group.combinator === 'OR' ? ' active' : ''}`}
            onClick={() => onChange({ ...group, combinator: 'OR' })}
          >
            {t('acceleration_combinator_or', { defaultValue: 'ANY (OR)' })}
          </button>
        </div>
        {onRemove && (
          <button className="ar-remove-btn ar-group-remove" onClick={onRemove} title="Remove group">
            <X size={13} />
          </button>
        )}
      </div>

      {group.conditions.map((child, i) => {
        if ('combinator' in child) {
          return (
            <RuleGroupEditor
              key={i}
              group={child as ConditionGroup}
              depth={depth + 1}
              availableFields={availableFields}
              onChange={updated => updateChild(i, updated)}
              onRemove={() => removeChild(i)}
            />
          );
        }
        return (
          <LeafRow
            key={i}
            leaf={child as LeafCondition}
            availableFields={availableFields}
            onChange={updated => updateChild(i, updated)}
            onRemove={() => removeChild(i)}
          />
        );
      })}

      <div className="ar-group-actions">
        <button className="ar-add-btn" onClick={addLeaf}>
          <Plus size={12} /> {t('acceleration_add_condition')}
        </button>
        <button className="ar-add-btn" onClick={addSubGroup}>
          <Plus size={12} /> {t('acceleration_add_group_btn', { defaultValue: 'Add Group' })}
        </button>
      </div>
    </div>
  );
}

// ── Sortable row ─────────────────────────────────────────────────────────────

function SortableRuleRow({
  rule, onEdit, onDelete, onToggle, onRunNow,
}: {
  rule: AccelerationRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  onRunNow: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: rule.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <tr ref={setNodeRef} style={style} className="ar-table-row">
      <td className="ar-td ar-td--grip">
        <span className="ar-grip" {...attributes} {...listeners}><GripVertical size={14} /></span>
      </td>
      <td className="ar-td ar-td--order">{rule.executionOrder}</td>
      <td className="ar-td ar-td--name">{rule.name}</td>
      <td className="ar-td ar-td--desc">
        <span className="ar-desc-cell">{rule.description || '—'}</span>
      </td>
      <td className="ar-td ar-td--active">
        <button
          className={`ar-toggle${rule.isActive ? ' ar-toggle--on' : ''}`}
          onClick={onToggle}
          title={rule.isActive ? 'Active' : 'Inactive'}
        />
      </td>
      <td className="ar-td ar-td--error">
        {rule.lastError
          ? <span title={rule.lastError}><AlertCircle size={15} className="ar-error-icon" /></span>
          : <span className="ar-fg-subtle">—</span>}
      </td>
      <td className="ar-td ar-td--actions">
        <button className="ar-action-btn" onClick={onEdit} title="Edit">Edit</button>
        <button className="ar-action-btn ar-action-btn--run" onClick={onRunNow} title={t('acceleration_run_now_btn')}>
          <Play size={12} />
        </button>
        <button className="ar-action-btn ar-action-btn--del" onClick={onDelete} title="Delete">
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export const AccelerationRulesPage = () => {
  const { t } = useTranslation();

  // List state
  const [rules, setRules]     = useState<AccelerationRule[]>([]);
  const [loading, setLoading] = useState(true);

  // View: 'list' or 'form'
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingRule, setEditingRule] = useState<AccelerationRule | null>(null);

  // Form basic info
  const [formName, setFormName]     = useState('');
  const [formDesc, setFormDesc]     = useState('');
  const [formOrder, setFormOrder]   = useState(0);
  const [formActive, setFormActive] = useState(true);

  // Condition builder (V2)
  const [availableFields, setAvailableFields]   = useState<AvailableField[]>([]);
  const [conditionsRoot, setConditionsRoot]     = useState<ConditionGroup>({ combinator: 'AND', conditions: [] });

  // Assignable users / groups for action dropdowns
  const [assignableUsers, setAssignableUsers]   = useState<AssignableOption[]>([]);
  const [assignableGroups, setAssignableGroups] = useState<AssignableOption[]>([]);

  // Actions
  const [actions, setActions] = useState<Action[]>([]);

  // Groovy preview (live)
  const [generatedScript, setGenScript] = useState('');
  const [scriptLoading, setScriptLoading] = useState(false);

  // Form feedback
  const [saving, setSaving]   = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Dry run
  const [dryRunTicketId, setDryRunTicketId] = useState('');
  const [dryRunning, setDryRunning]         = useState(false);
  const [dryRunResult, setDryRunResult]     = useState<{ mutated: boolean; diff: Record<string, DiffEntry> } | null>(null);
  const [dryRunError, setDryRunError]       = useState('');

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor));

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchRules = async () => {
    try {
      const res = await api.get<AccelerationRule[]>('/acceleration-rules');
      setRules(res.data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const fetchAvailableFields = async () => {
    try {
      const res = await api.get<AvailableField[]>('/acceleration-rules/available-fields');
      setAvailableFields(res.data);
    } catch { /* silent */ }
  };

  const fetchAssignables = async () => {
    try {
      const [usersRes, groupsRes] = await Promise.all([
        api.get<AssignableOption[]>('/acceleration-rules/assignable-users'),
        api.get<AssignableOption[]>('/acceleration-rules/assignable-groups'),
      ]);
      setAssignableUsers(usersRes.data);
      setAssignableGroups(groupsRes.data);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchRules(); fetchAvailableFields(); fetchAssignables(); }, []);

  // ── Live Groovy preview (debounced 300 ms) ─────────────────────────────────

  useEffect(() => {
    if (view !== 'form') return;
    if (conditionsRoot.conditions.length === 0 && actions.length === 0) {
      setGenScript('');
      return;
    }
    setScriptLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.post('/acceleration-rules/generate', {
          triggerConditions: JSON.stringify(conditionsRoot),
          actions: JSON.stringify(actions),
        });
        setGenScript(res.data.script ?? '');
      } catch { /* keep previous */ } finally {
        setScriptLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [conditionsRoot, actions, view]);

  // ── List view handlers ─────────────────────────────────────────────────────

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = rules.findIndex(r => r.id === active.id);
    const newIdx = rules.findIndex(r => r.id === over.id);
    const reordered = arrayMove(rules, oldIdx, newIdx).map((r, i) => ({ ...r, executionOrder: i }));
    setRules(reordered);
    await Promise.allSettled(
      reordered.map(r => api.put(`/acceleration-rules/${r.id}`, { executionOrder: r.executionOrder }))
    );
  };

  const handleToggle = async (rule: AccelerationRule) => {
    const updated = { ...rule, isActive: !rule.isActive };
    setRules(prev => prev.map(r => r.id === rule.id ? updated : r));
    await api.put(`/acceleration-rules/${rule.id}`, { isActive: updated.isActive });
  };

  const handleDelete = async (rule: AccelerationRule) => {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    await api.delete(`/acceleration-rules/${rule.id}`);
    setRules(prev => prev.filter(r => r.id !== rule.id));
  };

  const handleRunNow = async (rule: AccelerationRule) => {
    if (!window.confirm(t('acceleration_run_now_confirm'))) return;
    await api.post(`/acceleration-rules/${rule.id}/run-now`);
  };

  // ── Form navigation ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditingRule(null);
    setFormName(''); setFormDesc(''); setFormOrder(rules.length); setFormActive(true);
    setConditionsRoot({ combinator: 'AND', conditions: [] });
    setActions([]);
    setGenScript('');
    setDryRunResult(null); setDryRunError('');
    setView('form');
  };

  const openEdit = (rule: AccelerationRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormDesc(rule.description ?? '');
    setFormOrder(rule.executionOrder);
    setFormActive(rule.isActive);

    // Parse conditions with backward-compat
    try {
      const parsed = JSON.parse(rule.triggerConditions ?? '{}');
      if (Array.isArray(parsed)) {
        setConditionsRoot({ combinator: 'AND', conditions: parsed.map(convertLegacyCondition) });
      } else if (parsed?.combinator) {
        setConditionsRoot(parsed as ConditionGroup);
      } else {
        setConditionsRoot({ combinator: 'AND', conditions: [] });
      }
    } catch { setConditionsRoot({ combinator: 'AND', conditions: [] }); }

    try { setActions(JSON.parse(rule.actions) ?? []); } catch { setActions([]); }

    setGenScript(rule.generatedScript ?? '');
    setDryRunResult(null); setDryRunError('');
    setView('form');
  };

  const backToList = () => { setView('list'); fetchRules(); };

  // ── Action builder ─────────────────────────────────────────────────────────

  const addAction = () =>
    setActions(prev => [...prev, { type: 'set_acceleration', value: 1 }]);

  const removeAction = (i: number) =>
    setActions(prev => prev.filter((_, idx) => idx !== i));

  const updateAction = (i: number, patch: Partial<Action>) =>
    setActions(prev => prev.map((a, idx) => idx === i ? { ...a, ...patch } : a));

  // ── Save ───────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!formName.trim()) { alert('Rule name is required.'); return; }
    setSaving(true);
    const payload = {
      name: formName.trim(),
      description: formDesc.trim() || null,
      executionOrder: formOrder,
      isActive: formActive,
      triggerConditions: JSON.stringify(conditionsRoot),
      actions: JSON.stringify(actions),
      generatedScript: generatedScript || null,
    };
    try {
      if (editingRule) {
        const res = await api.put<AccelerationRule>(`/acceleration-rules/${editingRule.id}`, payload);
        setEditingRule(res.data);
        setGenScript(res.data.generatedScript ?? '');
      } else {
        const res = await api.post<AccelerationRule>('/acceleration-rules', payload);
        setEditingRule(res.data);
        setGenScript(res.data.generatedScript ?? '');
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 3000);
    } catch (err: any) {
      alert('Save failed: ' + (err.response?.data?.message ?? err.message));
    } finally { setSaving(false); }
  };

  // ── Dry run ────────────────────────────────────────────────────────────────

  const handleDryRun = async () => {
    if (!editingRule?.id || !dryRunTicketId) return;
    setDryRunning(true); setDryRunResult(null); setDryRunError('');
    try {
      const res = await api.post(`/acceleration-rules/${editingRule.id}/test-run`, {
        ticketId: parseInt(dryRunTicketId, 10),
      });
      setDryRunResult(res.data);
    } catch (err: any) {
      setDryRunError(err.response?.data?.message ?? err.message ?? 'Unknown error');
    } finally { setDryRunning(false); }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (view === 'form') {
    return (
      <div className="ar-page">
        <button className="ar-back-btn" onClick={backToList}>
          <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
        </button>

        <div className="ar-form-card">
          {/* Basic info */}
          <div className="ar-section">
            <div className="ar-field-group">
              <label className="ar-label">{t('acceleration_form_name_label')}</label>
              <input className="ar-input" value={formName} onChange={e => setFormName(e.target.value)} />
            </div>
            <div className="ar-field-group">
              <label className="ar-label">{t('acceleration_form_desc_label')}</label>
              <textarea className="ar-textarea" rows={2} value={formDesc}
                        onChange={e => setFormDesc(e.target.value)} />
            </div>
            <div className="ar-row-inline">
              <div className="ar-field-group">
                <label className="ar-label">{t('acceleration_form_order_label')}</label>
                <input className="ar-input ar-input--narrow" type="number" min={0}
                       value={formOrder} onChange={e => setFormOrder(+e.target.value)} />
              </div>
              <div className="ar-toggle-wrap">
                <label className="ar-label">{t('acceleration_form_active_label')}</label>
                <button
                  className={`ar-toggle ar-toggle--lg${formActive ? ' ar-toggle--on' : ''}`}
                  onClick={() => setFormActive(v => !v)}
                />
              </div>
            </div>
          </div>

          {/* Condition builder (V2 nested groups) */}
          <div className="ar-section">
            <div className="ar-section-header">
              <span className="ar-section-title">{t('acceleration_conditions_title')}</span>
            </div>
            <RuleGroupEditor
              group={conditionsRoot}
              depth={0}
              availableFields={availableFields}
              onChange={setConditionsRoot}
            />
          </div>

          {/* Action builder */}
          <div className="ar-section">
            <div className="ar-section-header">
              <span className="ar-section-title">{t('acceleration_actions_title')}</span>
              <p className="ar-section-hint">{t('acceleration_actions_hint')}</p>
            </div>
            {actions.map((action, i) => {
              const meta = ACTION_TYPES.find(a => a.value === action.type);
              return (
                <div key={i} className="ar-builder-row">
                  <button className="ar-remove-btn" onClick={() => removeAction(i)}><X size={13} /></button>
                  <select className="ar-select ar-select--sm"
                          value={action.type}
                          onChange={e => {
                            const defaults: Record<string, string | number> = {
                              set_acceleration: 1,
                              set_status: 'new',
                              assign_to_user:  assignableUsers[0]?.id ?? 0,
                              assign_to_group: assignableGroups[0]?.id ?? 0,
                            };
                            updateAction(i, { type: e.target.value, value: defaults[e.target.value] ?? '' });
                          }}>
                    {ACTION_TYPES.map(a => (
                      <option key={a.value} value={a.value}>{t(a.labelKey, { defaultValue: a.value })}</option>
                    ))}
                  </select>

                  {meta?.valueType === 'status-select' && (
                    <select className="ar-select ar-select--sm"
                            value={String(action.value ?? 'new')}
                            onChange={e => updateAction(i, { value: e.target.value })}>
                      {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}

                  {action.type === 'assign_to_user' && (
                    <select className="ar-select ar-select--sm"
                            value={String(action.value ?? assignableUsers[0]?.id ?? '')}
                            onChange={e => updateAction(i, { value: +e.target.value })}>
                      {assignableUsers.length === 0
                        ? <option value="">— no users —</option>
                        : assignableUsers.map(u => (
                            <option key={u.id} value={u.id}>{u.displayName}</option>
                          ))}
                    </select>
                  )}

                  {action.type === 'assign_to_group' && (
                    <select className="ar-select ar-select--sm"
                            value={String(action.value ?? assignableGroups[0]?.id ?? '')}
                            onChange={e => updateAction(i, { value: +e.target.value })}>
                      {assignableGroups.length === 0
                        ? <option value="">— no groups —</option>
                        : assignableGroups.map(g => (
                            <option key={g.id} value={g.id}>{g.displayName}</option>
                          ))}
                    </select>
                  )}

                  {action.type === 'set_acceleration' && (
                    <input className="ar-input ar-input--narrow" type="number" min={0}
                           value={String(action.value ?? 0)}
                           onChange={e => updateAction(i, { value: +e.target.value })} />
                  )}
                </div>
              );
            })}
            <button className="ar-add-btn" onClick={addAction}>
              <Plus size={12} /> {t('acceleration_add_action')}
            </button>
          </div>

          {/* Live Groovy preview */}
          <div className="ar-section">
            <div className="ar-section-header">
              <span className="ar-section-title">{t('acceleration_script_title')}</span>
              {scriptLoading && <Loader2 size={13} className="icon-spin ar-script-spinner" />}
            </div>
            <p className="ar-section-hint">{t('acceleration_script_hint')}</p>
            <div className="ar-groovy-wrap">
              <pre className={`ar-groovy-viewer${scriptLoading ? ' ar-groovy-viewer--loading' : ''}`}>
                {generatedScript || '-- build conditions above --'}
              </pre>
            </div>
          </div>

          {/* Dry run (only for saved rules) */}
          {editingRule?.id && (
            <div className="ar-section">
              <div className="ar-section-header">
                <span className="ar-section-title">{t('acceleration_dryrun_title')}</span>
              </div>
              <p className="ar-section-hint">{t('acceleration_dryrun_hint')}</p>
              <div className="ar-dryrun-row">
                <label className="ar-label">{t('acceleration_dryrun_ticket_id_label')}</label>
                <input className="ar-input ar-input--narrow" type="number" min={1}
                       value={dryRunTicketId}
                       onChange={e => setDryRunTicketId(e.target.value)} placeholder="ID" />
                <button className="ar-run-btn" onClick={handleDryRun}
                        disabled={dryRunning || !dryRunTicketId}>
                  {dryRunning ? <Loader2 size={13} className="icon-spin" /> : <Play size={13} />}
                  {t('acceleration_dryrun_run_btn')}
                </button>
              </div>
              {dryRunError && (
                <div className="ar-dryrun-error"><AlertCircle size={14} /> {dryRunError}</div>
              )}
              {dryRunResult && !dryRunError && (
                <div className="ar-dryrun-result">
                  {Object.keys(dryRunResult.diff).length === 0 ? (
                    <p className="ar-dryrun-no-change">{t('acceleration_dryrun_no_change')}</p>
                  ) : (
                    <>
                      <p className="ar-dryrun-result__label">{t('acceleration_dryrun_would_change')}</p>
                      <table className="ar-diff-table">
                        <thead>
                          <tr>
                            <th className="ar-diff-table__key">{t('acceleration_dryrun_field_col')}</th>
                            <th className="ar-diff-table__from">{t('acceleration_dryrun_from_col')}</th>
                            <th className="ar-diff-table__arrow"></th>
                            <th className="ar-diff-table__to">{t('acceleration_dryrun_to_col')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(dryRunResult.diff).map(([field, entry]) => (
                            <tr key={field}>
                              <td className="ar-diff-table__key">{field}</td>
                              <td className="ar-diff-table__from">{String(entry.from ?? '—')}</td>
                              <td className="ar-diff-table__arrow">→</td>
                              <td className="ar-diff-table__to">{String(entry.to ?? '—')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Last error */}
          {editingRule?.lastError && (
            <div className="ar-last-error-card">
              <AlertCircle size={14} />
              <span>{t('acceleration_last_error_label')}: {editingRule.lastError}</span>
            </div>
          )}

          {/* Form actions */}
          <div className="ar-form-actions">
            {editingRule?.id && (
              <button className="ar-delete-btn" onClick={() => handleDelete(editingRule!).then(backToList)}>
                <Trash2 size={13} /> Delete
              </button>
            )}
            <div className="ar-form-actions__right">
              {savedMsg && (
                <span className="ar-saved-msg"><CheckCircle size={13} /> Saved</span>
              )}
              <button className="ar-cancel-btn" onClick={backToList}>Cancel</button>
              <button className="ar-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={13} className="icon-spin" /> : null}
                {t('save_btn', { defaultValue: 'Save' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // List view
  return (
    <div className="ar-page">
      <div className="ar-header">
        <div className="ar-header-left">
          <Zap size={20} className="ar-header-icon" />
          <div>
            <h2 className="ar-title">{t('acceleration_page_title')}</h2>
            <p className="ar-subtitle">{t('acceleration_page_subtitle')}</p>
          </div>
        </div>
        <button className="ar-new-btn" onClick={openCreate}>
          <Plus size={14} /> {t('acceleration_add_rule_btn')}
        </button>
      </div>

      <div className="ar-table-wrap">
        {loading ? (
          <div className="ar-loading"><Loader2 size={18} className="icon-spin" /></div>
        ) : rules.length === 0 ? (
          <div className="ar-empty">{t('acceleration_list_empty')}</div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={rules.map(r => r.id)} strategy={verticalListSortingStrategy}>
              <table className="ar-table">
                <thead>
                  <tr>
                    <th className="ar-th ar-th--grip"></th>
                    <th className="ar-th">{t('acceleration_list_order_col')}</th>
                    <th className="ar-th">{t('acceleration_list_name_col')}</th>
                    <th className="ar-th">{t('acceleration_form_desc_label')}</th>
                    <th className="ar-th">{t('acceleration_list_status_col')}</th>
                    <th className="ar-th">{t('acceleration_list_error_col')}</th>
                    <th className="ar-th">{t('acceleration_list_actions_col')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map(rule => (
                    <SortableRuleRow
                      key={rule.id}
                      rule={rule}
                      onEdit={() => openEdit(rule)}
                      onDelete={() => handleDelete(rule)}
                      onToggle={() => handleToggle(rule)}
                      onRunNow={() => handleRunNow(rule)}
                    />
                  ))}
                </tbody>
              </table>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};
