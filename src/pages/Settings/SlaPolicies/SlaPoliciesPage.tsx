import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Timer, Plus, Trash2, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../../../api';
import { SlaEscalationLadderEditor } from './SlaEscalationLadderEditor';
import type { SlaEscalationStep } from './SlaEscalationLadderEditor';
import './SlaPoliciesPage.css';

interface SlaPolicy {
  id: number;
  priority: string;
  templateId: number | null;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHours: boolean;
  isActive: boolean;
  steps: SlaEscalationStep[];
}

interface AssignableOption { id: number; displayName: string; }

const PRIORITIES = ['critical', 'high', 'medium', 'low'];

function formatMinutes(mins: number): string {
  if (mins % 1440 === 0) return `${mins / 1440}d`;
  if (mins % 60 === 0) return `${mins / 60}h`;
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

export const SlaPoliciesPage = () => {
  const { t } = useTranslation();

  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignableUsers, setAssignableUsers] = useState<AssignableOption[]>([]);
  const [assignableGroups, setAssignableGroups] = useState<AssignableOption[]>([]);

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<SlaPolicy | null>(null);

  const [formPriority, setFormPriority] = useState('critical');
  const [formFirstResponse, setFormFirstResponse] = useState(60);
  const [formResolution, setFormResolution] = useState(240);
  const [formBusinessHours, setFormBusinessHours] = useState(true);
  const [formActive, setFormActive] = useState(true);
  const [formSteps, setFormSteps] = useState<SlaEscalationStep[]>([]);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const fetchPolicies = async () => {
    try {
      const res = await api.get<SlaPolicy[]>('/sla-policies');
      setPolicies(res.data);
    } catch { /* silent */ } finally { setLoading(false); }
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

  useEffect(() => { fetchPolicies(); fetchAssignables(); }, []);

  const describeStep = (step?: SlaEscalationStep): string => {
    if (!step) return '—';
    if (step.targetUserId != null) {
      return assignableUsers.find(u => u.id === step.targetUserId)?.displayName ?? t('sla_target_user_fallback', { defaultValue: 'Assigned user' });
    }
    if (step.targetGroupId != null) {
      return assignableGroups.find(g => g.id === step.targetGroupId)?.displayName ?? t('sla_target_group_fallback', { defaultValue: 'Assigned group' });
    }
    return t('sla_target_default_fallback', { defaultValue: 'Assigned agent' });
  };

  const describeTrigger = (step?: SlaEscalationStep): string => {
    if (!step) return '—';
    if (step.triggerType === 'AT_BREACH') return t('sla_trigger_at_breach', { defaultValue: 'At breach' });
    if (step.triggerType === 'AFTER_BREACH_MINUTES') return t('sla_trigger_after_breach', { defaultValue: `${step.triggerValue ?? 0}m after breach` });
    return `${step.triggerValue ?? 0}%`;
  };

  const openCreate = () => {
    setEditing(null);
    setFormPriority('critical');
    setFormFirstResponse(60);
    setFormResolution(240);
    setFormBusinessHours(true);
    setFormActive(true);
    setFormSteps([]);
    setView('form');
  };

  const openEdit = (policy: SlaPolicy) => {
    setEditing(policy);
    setFormPriority(policy.priority);
    setFormFirstResponse(policy.firstResponseMinutes);
    setFormResolution(policy.resolutionMinutes);
    setFormBusinessHours(policy.businessHours);
    setFormActive(policy.isActive);
    setFormSteps(policy.steps ?? []);
    setView('form');
  };

  const backToList = () => { setView('list'); fetchPolicies(); };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      priority: formPriority,
      templateId: null,
      firstResponseMinutes: formFirstResponse,
      resolutionMinutes: formResolution,
      businessHours: formBusinessHours,
      isActive: formActive,
      steps: formSteps,
    };
    try {
      if (editing) {
        await api.put(`/sla-policies/${editing.id}`, payload);
      } else {
        await api.post('/sla-policies', payload);
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      backToList();
    } catch (err: any) {
      alert('Save failed: ' + (err.response?.data?.message ?? err.message));
    } finally { setSaving(false); }
  };

  const handleDelete = async (policy: SlaPolicy) => {
    if (!window.confirm(t('sla_delete_confirm', { defaultValue: `Deactivate the ${policy.priority} SLA policy?` }))) return;
    await api.delete(`/sla-policies/${policy.id}`);
    fetchPolicies();
  };

  const handleActivate = async (policy: SlaPolicy) => {
    await api.put(`/sla-policies/${policy.id}`, { ...policy, isActive: true });
    fetchPolicies();
  };

  if (view === 'form') {
    return (
      <div className="slap-page">
        <button className="slap-back-btn" onClick={backToList}>
          <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
        </button>

        <div className="slap-form-card">
          <div className="slap-field-group">
            <label className="slap-label">{t('sla_col_priority', { defaultValue: 'Priority' })}</label>
            <select className="slap-select" value={formPriority} disabled={!!editing}
                    onChange={e => setFormPriority(e.target.value)}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>

          <div className="slap-row-inline">
            <div className="slap-field-group">
              <label className="slap-label">{t('sla_col_first_response', { defaultValue: 'First Response' })} ({t('sla_minutes_unit', { defaultValue: 'minutes' })})</label>
              <input className="slap-input" type="number" min={1}
                     value={formFirstResponse} onChange={e => setFormFirstResponse(+e.target.value)} />
            </div>
            <div className="slap-field-group">
              <label className="slap-label">{t('sla_col_resolution', { defaultValue: 'Resolution Time' })} ({t('sla_minutes_unit', { defaultValue: 'minutes' })})</label>
              <input className="slap-input" type="number" min={1}
                     value={formResolution} onChange={e => setFormResolution(+e.target.value)} />
            </div>
          </div>

          <div className="slap-row-inline">
            <div className="slap-toggle-wrap">
              <label className="slap-label">{t('sla_col_business_hours', { defaultValue: 'Business Hours' })}</label>
              <button className={`slap-toggle${formBusinessHours ? ' slap-toggle--on' : ''}`}
                      onClick={() => setFormBusinessHours(v => !v)} />
            </div>
            <div className="slap-toggle-wrap">
              <label className="slap-label">{t('active_label', { defaultValue: 'Active' })}</label>
              <button className={`slap-toggle${formActive ? ' slap-toggle--on' : ''}`}
                      onClick={() => setFormActive(v => !v)} />
            </div>
          </div>

          <div className="slap-section">
            <div className="slap-section-header">
              <span className="slap-section-title">{t('sla_escalation_ladder_title', { defaultValue: 'Escalation Ladder' })}</span>
            </div>
            <SlaEscalationLadderEditor
              steps={formSteps}
              onChange={setFormSteps}
              assignableUsers={assignableUsers}
              assignableGroups={assignableGroups}
            />
          </div>

          <div className="slap-form-actions">
            <div className="slap-form-actions__right">
              {savedMsg && <span className="slap-saved-msg"><CheckCircle size={13} /> Saved</span>}
              <button className="slap-cancel-btn" onClick={backToList}>{t('cancel_btn', { defaultValue: 'Cancel' })}</button>
              <button className="slap-save-btn" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 size={13} className="icon-spin" /> : null}
                {t('save_btn', { defaultValue: 'Save' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="slap-page">
      <div className="slap-header">
        <div className="slap-header-left">
          <Timer size={20} className="slap-header-icon" />
          <div>
            <h2 className="slap-title">{t('sla_policies_title', { defaultValue: 'SLA Policies' })}</h2>
            <p className="slap-subtitle">{t('sla_auto_pause_note', { defaultValue: 'SLA auto-pauses when status = Waiting' })}</p>
          </div>
        </div>
        <button className="slap-new-btn" onClick={openCreate}>
          <Plus size={14} /> {t('sla_add_policy_btn', { defaultValue: '+ Add SLA Policy' })}
        </button>
      </div>

      <div className="slap-table-wrap">
        {loading ? (
          <div className="slap-loading"><Loader2 size={18} className="icon-spin" /></div>
        ) : policies.length === 0 ? (
          <div className="slap-empty">{t('sla_list_empty', { defaultValue: 'No SLA policies configured.' })}</div>
        ) : (
          <table className="slap-table">
            <thead>
              <tr>
                <th className="slap-th">{t('sla_col_priority', { defaultValue: 'Priority' })}</th>
                <th className="slap-th">{t('sla_col_first_response', { defaultValue: 'First Response' })}</th>
                <th className="slap-th">{t('sla_col_resolution', { defaultValue: 'Resolution Time' })}</th>
                <th className="slap-th">{t('sla_col_business_hours', { defaultValue: 'Business Hours' })}</th>
                <th className="slap-th">{t('sla_col_escalate_to', { defaultValue: 'Escalate To' })}</th>
                <th className="slap-th">{t('sla_col_notify_at', { defaultValue: 'Notify At' })}</th>
                <th className="slap-th">{t('active_label', { defaultValue: 'Active' })}</th>
                <th className="slap-th"></th>
              </tr>
            </thead>
            <tbody>
              {policies.map(p => (
                <tr key={p.id} className={`slap-table-row${p.isActive ? '' : ' slap-table-row--inactive'}`}>
                  <td className="slap-td slap-td--priority">
                    <span className={`slap-priority-chip slap-priority-chip--${p.priority}`}>{p.priority}</span>
                  </td>
                  <td className="slap-td">{formatMinutes(p.firstResponseMinutes)}</td>
                  <td className="slap-td">{formatMinutes(p.resolutionMinutes)}</td>
                  <td className="slap-td">{p.businessHours ? t('sla_business_hours_yes', { defaultValue: 'Business hours' }) : t('sla_business_hours_no', { defaultValue: '24×7' })}</td>
                  <td className="slap-td">{describeStep(p.steps?.[0])}</td>
                  <td className="slap-td">{describeTrigger(p.steps?.[0])}</td>
                  <td className="slap-td">
                    <span className={`slap-status-dot${p.isActive ? ' slap-status-dot--on' : ''}`} />
                  </td>
                  <td className="slap-td slap-td--actions">
                    <button className="slap-action-btn" onClick={() => openEdit(p)}>{t('edit_btn', { defaultValue: 'Edit' })}</button>
                    {p.isActive ? (
                      <button className="slap-action-btn slap-action-btn--del" onClick={() => handleDelete(p)}>
                        <Trash2 size={12} />
                      </button>
                    ) : (
                      <button className="slap-action-btn" onClick={() => handleActivate(p)}>{t('sla_activate_btn', { defaultValue: 'Activate' })}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
