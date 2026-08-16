import { useTranslation } from 'react-i18next';
import type { ConditionGroup, ConditionLeaf, ReportField } from './reportTypes';
import { isLeaf, operatorsForFieldType } from './reportTypes';

interface Props {
  fields: ReportField[];
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
}

/**
 * Flat single-level AND/OR condition editor — deliberately not a fully recursive nested-group
 * UI (the backend's ReportQueryCompiler supports arbitrary nesting, but a v1 manual builder only
 * needs to edit what the mocks show: one AND/OR group of leaf conditions). If the AI proposes a
 * nested sub-group, it's kept intact (not dropped) but only removable as a whole, not editable —
 * avoids either crashing on AI output or promising deep-editing that isn't built yet.
 *
 * A dedicated new component rather than extracting AccelerationRulesPage's inline RuleGroupEditor
 * — that editor is tightly coupled to Acceleration-specific concerns (assignable options, legacy
 * condition conversion) and extracting it safely was out of scope for this pass.
 */
export const ReportConditionEditor = ({ fields, group, onChange }: Props) => {
  const { t } = useTranslation();
  const leaves = group.conditions.filter(isLeaf);
  const nestedGroups = group.conditions.filter(c => !isLeaf(c));
  const fieldByKey = (key: string) => fields.find(f => f.fieldKey === key);

  const replaceLeaves = (nextLeaves: ConditionLeaf[]) => {
    onChange({ ...group, conditions: [...nextLeaves, ...nestedGroups] });
  };

  const updateLeaf = (index: number, patch: Partial<ConditionLeaf>) => {
    const next = leaves.map((l, i) => (i === index ? { ...l, ...patch } : l));
    replaceLeaves(next);
  };

  const addLeaf = () => {
    const f = fields[0];
    if (!f) return;
    const ops = operatorsForFieldType(f.fieldType);
    const newLeaf: ConditionLeaf = { field: f.fieldKey, fieldType: f.fieldType, operator: ops[0], value: '', isCustom: f.custom };
    replaceLeaves([...leaves, newLeaf]);
  };

  const removeLeaf = (index: number) => {
    replaceLeaves(leaves.filter((_, i) => i !== index));
  };

  const removeNestedGroup = (index: number) => {
    const next = nestedGroups.filter((_, i) => i !== index);
    onChange({ ...group, conditions: [...leaves, ...next] });
  };

  return (
    <div className="rp-cond-group">
      <div className="rp-cond-group-label">
        <span>{t('reports_match_label', { defaultValue: 'Match' })}</span>
        <div className="rp-combinator-toggle">
          <button
            type="button"
            className={`rp-toggle-btn${group.combinator === 'AND' ? ' active' : ''}`}
            onClick={() => onChange({ ...group, combinator: 'AND' })}
          >
            {t('reports_combinator_and', { defaultValue: 'ALL (AND)' })}
          </button>
          <button
            type="button"
            className={`rp-toggle-btn${group.combinator === 'OR' ? ' active' : ''}`}
            onClick={() => onChange({ ...group, combinator: 'OR' })}
          >
            {t('reports_combinator_or', { defaultValue: 'ANY (OR)' })}
          </button>
        </div>
      </div>

      {leaves.map((leaf, i) => {
        const fieldDef = fieldByKey(leaf.field);
        const ops = operatorsForFieldType(leaf.fieldType);
        return (
          <div className="rp-cond-row" key={i}>
            <select
              value={leaf.field}
              onChange={e => {
                const f = fieldByKey(e.target.value);
                if (!f) return;
                const newOps = operatorsForFieldType(f.fieldType);
                updateLeaf(i, { field: f.fieldKey, fieldType: f.fieldType, isCustom: f.custom, operator: newOps[0] });
              }}
            >
              {fields.map(f => (
                <option key={f.fieldKey} value={f.fieldKey}>{f.label}{f.custom ? ' *' : ''}</option>
              ))}
            </select>
            <select value={leaf.operator} onChange={e => updateLeaf(i, { operator: e.target.value })}>
              {ops.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <input
              value={leaf.value ?? ''}
              onChange={e => updateLeaf(i, { value: e.target.value })}
              placeholder={fieldDef?.fieldType === 'date' ? 'YYYY-MM-DD' : ''}
            />
            <span className="rp-cond-rm" onClick={() => removeLeaf(i)}>✕</span>
          </div>
        );
      })}

      {nestedGroups.length > 0 && (
        <div className="rp-cond-nested-note">
          {t('reports_nested_groups_note', {
            defaultValue: '{{count}} nested condition group(s) proposed by AI — not editable here, remove to simplify.',
            count: nestedGroups.length,
          })}
          <span className="rp-cond-rm" onClick={() => removeNestedGroup(0)}>✕</span>
        </div>
      )}

      <span className="rp-add-row-btn" onClick={addLeaf}>
        {t('reports_add_condition_btn', { defaultValue: '+ Add condition' })}
      </span>
    </div>
  );
};
