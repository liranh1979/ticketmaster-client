import { useTranslation } from 'react-i18next';
import { Plus, X, GripVertical } from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface SlaEscalationStep {
  id?: number;
  stepOrder: number;
  triggerType: string;
  triggerValue: number | null;
  actionType: string;
  targetUserId: number | null;
  targetGroupId: number | null;
  webhookUrl: string | null;
}

interface AssignableOption { id: number; displayName: string; }

const TRIGGER_TYPES = [
  { value: 'PERCENT_OF_RESPONSE', labelKey: 'sla_trigger_percent_response' },
  { value: 'PERCENT_OF_RESOLUTION', labelKey: 'sla_trigger_percent_resolution' },
  { value: 'AT_BREACH', labelKey: 'sla_trigger_at_breach' },
  { value: 'AFTER_BREACH_MINUTES', labelKey: 'sla_trigger_after_breach_minutes' },
];

const ACTION_TYPES = [
  { value: 'NOTIFY_EMAIL', labelKey: 'sla_action_notify_email' },
  { value: 'NOTIFY_INAPP', labelKey: 'sla_action_notify_inapp' },
  { value: 'REASSIGN', labelKey: 'sla_action_reassign' },
  { value: 'WEBHOOK', labelKey: 'sla_action_webhook' },
];

function makeDefaultStep(order: number): SlaEscalationStep {
  return {
    stepOrder: order,
    triggerType: 'PERCENT_OF_RESOLUTION',
    triggerValue: 80,
    actionType: 'NOTIFY_EMAIL',
    targetUserId: null,
    targetGroupId: null,
    webhookUrl: null,
  };
}

function StepRow({
  step, index, assignableUsers, assignableGroups, onChange, onRemove,
}: {
  step: SlaEscalationStep;
  index: number;
  assignableUsers: AssignableOption[];
  assignableGroups: AssignableOption[];
  onChange: (updated: SlaEscalationStep) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const sortId = step.id ?? `new-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const targetKind = step.targetGroupId != null ? 'group' : 'user';

  return (
    <div ref={setNodeRef} style={style} className="slap-ladder-row">
      <span className="slap-ladder-grip" {...attributes} {...listeners}><GripVertical size={14} /></span>
      <span className="slap-ladder-order">{index + 1}</span>

      <select className="slap-select slap-select--sm" value={step.triggerType}
              onChange={e => onChange({ ...step, triggerType: e.target.value })}>
        {TRIGGER_TYPES.map(tt => (
          <option key={tt.value} value={tt.value}>{t(tt.labelKey, { defaultValue: tt.value })}</option>
        ))}
      </select>

      {step.triggerType !== 'AT_BREACH' && (
        <input className="slap-input slap-input--narrow" type="number" min={0}
               value={step.triggerValue ?? 0}
               onChange={e => onChange({ ...step, triggerValue: +e.target.value })} />
      )}
      {(step.triggerType === 'PERCENT_OF_RESPONSE' || step.triggerType === 'PERCENT_OF_RESOLUTION') && <span className="slap-ladder-unit">%</span>}
      {step.triggerType === 'AFTER_BREACH_MINUTES' && <span className="slap-ladder-unit">{t('sla_minutes_unit', { defaultValue: 'minutes' })}</span>}

      <span className="slap-ladder-arrow">→</span>

      <select className="slap-select slap-select--sm" value={step.actionType}
              onChange={e => onChange({ ...step, actionType: e.target.value })}>
        {ACTION_TYPES.map(a => (
          <option key={a.value} value={a.value}>{t(a.labelKey, { defaultValue: a.value })}</option>
        ))}
      </select>

      {step.actionType === 'WEBHOOK' ? (
        <input className="slap-input" type="url" placeholder="https://…"
               value={step.webhookUrl ?? ''}
               onChange={e => onChange({ ...step, webhookUrl: e.target.value, targetUserId: null, targetGroupId: null })} />
      ) : (
        <>
          <select className="slap-select slap-select--sm" value={targetKind}
                  onChange={e => onChange(e.target.value === 'group'
                    ? { ...step, targetGroupId: assignableGroups[0]?.id ?? null, targetUserId: null }
                    : { ...step, targetUserId: assignableUsers[0]?.id ?? null, targetGroupId: null })}>
            <option value="user">{t('sla_target_user_option', { defaultValue: 'User' })}</option>
            <option value="group">{t('sla_target_group_option', { defaultValue: 'Group' })}</option>
          </select>
          {targetKind === 'user' ? (
            <select className="slap-select slap-select--sm"
                    value={String(step.targetUserId ?? '')}
                    onChange={e => onChange({ ...step, targetUserId: e.target.value ? +e.target.value : null, targetGroupId: null })}>
              <option value="">{t('sla_target_default_fallback', { defaultValue: 'Assigned agent' })}</option>
              {assignableUsers.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}
            </select>
          ) : (
            <select className="slap-select slap-select--sm"
                    value={String(step.targetGroupId ?? '')}
                    onChange={e => onChange({ ...step, targetGroupId: e.target.value ? +e.target.value : null, targetUserId: null })}>
              <option value="">{t('sla_target_default_fallback', { defaultValue: 'Assigned agent' })}</option>
              {assignableGroups.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
            </select>
          )}
        </>
      )}

      <button className="slap-remove-btn" onClick={onRemove}><X size={13} /></button>
    </div>
  );
}

export const SlaEscalationLadderEditor = ({
  steps, onChange, assignableUsers, assignableGroups,
}: {
  steps: SlaEscalationStep[];
  onChange: (steps: SlaEscalationStep[]) => void;
  assignableUsers: AssignableOption[];
  assignableGroups: AssignableOption[];
}) => {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = steps.map((s, i) => s.id ?? `new-${i}`);
    const oldIdx = ids.indexOf(active.id as number | string);
    const newIdx = ids.indexOf(over.id as number | string);
    onChange(arrayMove(steps, oldIdx, newIdx).map((s, i) => ({ ...s, stepOrder: i })));
  };

  const updateStep = (i: number, updated: SlaEscalationStep) =>
    onChange(steps.map((s, idx) => idx === i ? updated : s));

  const removeStep = (i: number) =>
    onChange(steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, stepOrder: idx })));

  const addStep = () => onChange([...steps, makeDefaultStep(steps.length)]);

  return (
    <div className="slap-ladder">
      {steps.length === 0 ? (
        <p className="slap-steps-empty">{t('sla_no_steps_note', { defaultValue: 'No escalation steps configured yet.' })}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={steps.map((s, i) => s.id ?? `new-${i}`)} strategy={verticalListSortingStrategy}>
            {steps.map((step, i) => (
              <StepRow
                key={step.id ?? `new-${i}`}
                step={step}
                index={i}
                assignableUsers={assignableUsers}
                assignableGroups={assignableGroups}
                onChange={updated => updateStep(i, updated)}
                onRemove={() => removeStep(i)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <button className="slap-add-btn" onClick={addStep}>
        <Plus size={12} /> {t('sla_add_step_btn', { defaultValue: '+ Add Step' })}
      </button>
    </div>
  );
};
