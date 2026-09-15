import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import api from '../../../api';
import './RoutingRulesPage.css';

// Agent Queue Management: ordered IF/THEN rule list + builder. First match wins (no stacking).
// Gated by MANAGE_ROUTING_RULES (checked by SettingsPage.tsx before rendering this at all — the
// backend also independently enforces it). Condition vocabulary (templateId/priority/
// requesterGroupId/labelId) mirrors acceleration_rules' existing shape for a familiar authoring
// model. See V2/Agent Queue Management/04-mockup-routing-rules.html.

interface Condition { field: string; operator: string; value: any; }
interface Action { type: string; [key: string]: any; }
interface Rule {
  id: number;
  name: string;
  executionOrder: number;
  triggerConditions: Condition[];
  actions: Action[];
  isActive: boolean;
  lastError: string | null;
}

const emptyCondition = (): Condition => ({ field: 'priority', operator: 'equals', value: '' });
const emptyAction = (): Action => ({ type: 'assign_group', groupId: '' });

export const RoutingRulesPage = () => {
  const { t } = useTranslation();
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Rule | null>(null);

  const [name, setName] = useState('');
  const [executionOrder, setExecutionOrder] = useState(0);
  const [conditions, setConditions] = useState<Condition[]>([emptyCondition()]);
  const [actions, setActions] = useState<Action[]>([emptyAction()]);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const res = await api.get<Rule[]>('/routing-rules');
      setRules(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchRules(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName(''); setExecutionOrder(rules.length);
    setConditions([emptyCondition()]);
    setActions([emptyAction()]);
    setView('form');
  };

  const openEdit = (r: Rule) => {
    setEditing(r);
    setName(r.name); setExecutionOrder(r.executionOrder);
    setConditions(r.triggerConditions.length ? r.triggerConditions : [emptyCondition()]);
    setActions(r.actions.length ? r.actions : [emptyAction()]);
    setView('form');
  };

  const backToList = () => { setView('list'); fetchRules(); };

  const save = async () => {
    const payload = { name, executionOrder, triggerConditions: conditions, actions, isActive: true };
    if (editing) await api.put(`/routing-rules/${editing.id}`, payload);
    else await api.post('/routing-rules', payload);
    backToList();
  };

  const toggleActive = async (r: Rule) => {
    await api.put(`/routing-rules/${r.id}`, { ...r, isActive: !r.isActive });
    fetchRules();
  };

  const remove = async (r: Rule) => {
    if (!window.confirm('Delete this routing rule?')) return;
    await api.delete(`/routing-rules/${r.id}`);
    fetchRules();
  };

  if (view === 'form') {
    return (
      <div className="rr-page">
        <div className="rr-builder">
          <div className="rr-builder-h">{editing ? 'Edit Routing Rule' : 'New Routing Rule'}</div>
          <input className="rr-input" style={{ width: '100%', marginBottom: '1rem' }} placeholder="Rule name"
                 value={name} onChange={e => setName(e.target.value)} />
          <div className="rr-field-row">
            <label className="rr-label">Execution order</label>
            <input className="rr-input" type="number" style={{ width: 80 }} value={executionOrder}
                   onChange={e => setExecutionOrder(Number(e.target.value))} />
          </div>

          <div className="rr-section-label">IF (all conditions must match)</div>
          {conditions.map((c, i) => (
            <div className="rr-cond-row" key={i}>
              <select className="rr-sel" value={c.field} onChange={e => {
                const next = [...conditions]; next[i] = { ...c, field: e.target.value }; setConditions(next);
              }}>
                <option value="templateId">Template ID</option>
                <option value="priority">Priority</option>
                <option value="requesterGroupId">Requester Group ID</option>
                <option value="labelId">Label ID</option>
              </select>
              <select className="rr-sel" value={c.operator} onChange={e => {
                const next = [...conditions]; next[i] = { ...c, operator: e.target.value }; setConditions(next);
              }}>
                <option value="equals">equals</option>
                <option value="not_equals">not equals</option>
                <option value="is_one_of">is one of</option>
              </select>
              <input className="rr-input" placeholder="value" value={c.value}
                     onChange={e => { const next = [...conditions]; next[i] = { ...c, value: e.target.value }; setConditions(next); }} />
              <button className="rr-icon-btn" onClick={() => setConditions(conditions.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
            </div>
          ))}
          <div className="rr-add-link" onClick={() => setConditions([...conditions, emptyCondition()])}>+ Add condition</div>

          <div className="rr-divider" />

          <div className="rr-section-label">THEN (actions applied in order)</div>
          {actions.map((a, i) => (
            <div className="rr-cond-row" key={i}>
              <select className="rr-sel" value={a.type} onChange={e => {
                const next = [...actions]; next[i] = { type: e.target.value }; setActions(next);
              }}>
                <option value="assign_user">Assign to Agent</option>
                <option value="assign_group">Assign to Group</option>
                <option value="round_robin_group">Round-robin in Group</option>
                <option value="least_loaded_group">Least-loaded in Group</option>
                <option value="set_priority">Set Priority</option>
              </select>
              {(a.type === 'assign_user') && (
                <input className="rr-input" placeholder="User ID" value={a.userId || ''}
                       onChange={e => { const next = [...actions]; next[i] = { ...a, userId: e.target.value }; setActions(next); }} />
              )}
              {(a.type === 'assign_group' || a.type === 'round_robin_group' || a.type === 'least_loaded_group') && (
                <input className="rr-input" placeholder="Group ID" value={a.groupId || ''}
                       onChange={e => { const next = [...actions]; next[i] = { ...a, groupId: e.target.value }; setActions(next); }} />
              )}
              {a.type === 'set_priority' && (
                <select className="rr-sel" value={a.priority || ''} onChange={e => {
                  const next = [...actions]; next[i] = { ...a, priority: e.target.value }; setActions(next);
                }}>
                  <option value="">—</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              )}
              <button className="rr-icon-btn" onClick={() => setActions(actions.filter((_, j) => j !== i))}><Trash2 size={12} /></button>
            </div>
          ))}
          <div className="rr-add-link" onClick={() => setActions([...actions, emptyAction()])}>+ Add another action</div>

          <div className="rr-fallback-note">
            <b>If no rule matches</b>, the ticket isn't left to chance — the AI Smart-Router proposes an assignee for a human to confirm.
          </div>

          <div className="rr-builder-actions">
            <button className="rr-btn rr-btn-ghost" onClick={backToList}>{t('cancel_btn', { defaultValue: 'Cancel' })}</button>
            <button className="rr-btn rr-btn-primary" onClick={save} disabled={!name}>{t('save_btn', { defaultValue: 'Save Rule' })}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rr-page">
      <div className="rr-header">
        <h2 className="rr-title">{t('aq_routing_rules_nav_item', { defaultValue: 'Routing Rules' })}</h2>
        <button className="rr-btn rr-btn-primary" onClick={openCreate}><Plus size={14} /> {t('aq_new_routing_rule_btn', { defaultValue: '+ New Routing Rule' })}</button>
      </div>
      {loading ? <div className="rr-loading"><Loader2 size={18} className="icon-spin" /></div> : rules.length === 0 ? (
        <div className="rr-empty">No routing rules yet.</div>
      ) : (
        rules.map(r => (
          <div className="rr-rule-card" key={r.id} style={{ opacity: r.isActive ? 1 : 0.55 }}>
            <div className="rr-rule-order">{r.executionOrder}</div>
            <div className="rr-rule-body">
              <div className="rr-rule-if">IF {r.triggerConditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join(' AND ')}</div>
              <div className="rr-rule-then">→ {r.actions.map((a) => a.type).join(', ')}</div>
              {r.lastError && <div className="rr-rule-error">⚠ {r.lastError}</div>}
            </div>
            <div className="rr-rule-actions">
              <button className="rr-icon-btn" onClick={() => toggleActive(r)}>{r.isActive ? 'Active' : 'Inactive'}</button>
              <button className="rr-icon-btn" onClick={() => openEdit(r)}>Edit</button>
              <button className="rr-icon-btn" onClick={() => remove(r)}><Trash2 size={12} /></button>
            </div>
          </div>
        ))
      )}
    </div>
  );
};
