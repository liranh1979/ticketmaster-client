import { useEffect, useState } from 'react';
import { Plus, X, GripVertical, Clock, ArrowUpRight } from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { UserPickerControl } from '../../../components/UserPickerControl/UserPickerControl';
import api from '../../../api';

export interface ApprovalLevel {
  approverType: 'specific_user' | 'group';
  approverUserId: number | null;
  approverGroupId: number | null;
  timeoutHours: number | null;
  escalateToUserId: number | null;
}

interface GroupOption { id: number; display_name: string; }

export function makeDefaultLevel(): ApprovalLevel {
  return {
    approverType: 'specific_user',
    approverUserId: null,
    approverGroupId: null,
    timeoutHours: 24,
    escalateToUserId: null,
  };
}

function LevelRow({
  level, index, groups, onChange, onRemove,
}: {
  level: ApprovalLevel;
  index: number;
  groups: GroupOption[];
  onChange: (updated: ApprovalLevel) => void;
  onRemove: () => void;
}) {
  const sortId = `level-${index}`;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sortId });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="ale-row">
      <div className="ale-row-top">
        <span className="ale-grip" {...attributes} {...listeners}><GripVertical size={13} /></span>
        <span className="ale-order">Level {index + 1}</span>
        <button className="ale-rm-btn" onClick={onRemove}><X size={12} /></button>
      </div>

      <div className="ale-row-body">
        <select
          className="wfd-sel"
          value={level.approverType}
          onChange={e => onChange(e.target.value === 'group'
            ? { ...level, approverType: 'group', approverUserId: null }
            : { ...level, approverType: 'specific_user', approverGroupId: null })}
        >
          <option value="specific_user">Approver: Specific user</option>
          <option value="group">Approver: Group (any member)</option>
        </select>

        {level.approverType === 'specific_user' ? (
          <UserPickerControl
            mode="all"
            value={level.approverUserId?.toString() ?? ''}
            onChange={v => onChange({ ...level, approverUserId: v ? Number(v) : null })}
            compact
          />
        ) : (
          <select
            className="wfd-sel"
            value={level.approverGroupId ?? ''}
            onChange={e => onChange({ ...level, approverGroupId: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">— Select group —</option>
            {groups.map(g => <option key={g.id} value={g.id}>{g.display_name}</option>)}
          </select>
        )}

        <div className="ale-timeout-row">
          <span className="ale-timeout-lbl"><Clock size={10} /> Timeout</span>
          <input
            className="wfd-inp ale-timeout-inp"
            type="number" min={0} step={1}
            value={level.timeoutHours ?? ''}
            onChange={e => onChange({ ...level, timeoutHours: e.target.value ? Number(e.target.value) : null })}
            placeholder="hrs"
          />
          <span className="ale-timeout-unit">hours</span>
        </div>

        <div className="ale-escalate-row">
          <span className="ale-timeout-lbl"><ArrowUpRight size={10} /> Escalate to (on timeout)</span>
          <UserPickerControl
            mode="all"
            value={level.escalateToUserId?.toString() ?? ''}
            onChange={v => onChange({ ...level, escalateToUserId: v ? Number(v) : null })}
            compact
          />
        </div>
      </div>
    </div>
  );
}

export const ApprovalLevelsEditor = ({
  levels, onChange,
}: {
  levels: ApprovalLevel[];
  onChange: (levels: ApprovalLevel[]) => void;
}) => {
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    api.get('/groups').then(r => setGroups(r.data)).catch(() => {});
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = levels.map((_, i) => `level-${i}`);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    onChange(arrayMove(levels, oldIdx, newIdx));
  };

  const updateLevel = (i: number, updated: ApprovalLevel) =>
    onChange(levels.map((l, idx) => idx === i ? updated : l));

  const removeLevel = (i: number) =>
    onChange(levels.filter((_, idx) => idx !== i));

  const addLevel = () => onChange([...levels, makeDefaultLevel()]);

  return (
    <div className="ale-wrap">
      {levels.length === 0 ? (
        <p className="wfd-empty-txt">No approval levels yet — add one to require a decision before this item completes.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={levels.map((_, i) => `level-${i}`)} strategy={verticalListSortingStrategy}>
            {levels.map((level, i) => (
              <LevelRow
                key={`level-${i}`}
                level={level}
                index={i}
                groups={groups}
                onChange={updated => updateLevel(i, updated)}
                onRemove={() => removeLevel(i)}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <button className="wfd-add-flow-btn ale-add-btn" onClick={addLevel}>
        <Plus size={10} /> Add level
      </button>
    </div>
  );
};
