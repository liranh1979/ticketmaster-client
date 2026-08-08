import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Repeat, Plus, Trash2, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../../../api';
import { buildCronExpression, previewTitle, type FrequencyType } from './recurringCron';
import './RecurringTicketsPage.css';

interface RecurringSchedule {
  id: number;
  name: string;
  templateId: number;
  templateName: string | null;
  cronExpression: string;
  frequencyType: FrequencyType;
  titleTemplate: string;
  assignGroupId: number | null;
  assignGroupName: string | null;
  priority: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
}

interface TemplateOption { id: number; name: string; }
interface GroupOption { id: number; displayName: string; }

const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const FREQUENCIES: FrequencyType[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'CUSTOM'];
const DAY_KEYS = ['recurring_day_mon', 'recurring_day_tue', 'recurring_day_wed', 'recurring_day_thu', 'recurring_day_fri', 'recurring_day_sat', 'recurring_day_sun'];
const DAY_LABELS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function freqBadgeText(t: (k: string, o?: any) => string, s: RecurringSchedule): string {
  switch (s.frequencyType) {
    case 'DAILY': return t('recurring_freq_daily', { defaultValue: 'Daily' });
    case 'WEEKLY': return t('recurring_freq_weekly', { defaultValue: 'Weekly' });
    case 'MONTHLY': return t('recurring_freq_monthly', { defaultValue: 'Monthly' });
    case 'QUARTERLY': return t('recurring_freq_quarterly', { defaultValue: 'Quarterly' });
    default: return t('recurring_freq_custom', { defaultValue: 'Custom (cron)' });
  }
}

export const RecurringTicketsPage = () => {
  const { t } = useTranslation();

  const [schedules, setSchedules] = useState<RecurringSchedule[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<RecurringSchedule | null>(null);

  const [formName, setFormName] = useState('');
  const [formTemplateId, setFormTemplateId] = useState<number | null>(null);
  const [formFrequency, setFormFrequency] = useState<FrequencyType>('MONTHLY');
  const [formDayOfWeek, setFormDayOfWeek] = useState(1);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [formHour, setFormHour] = useState(6);
  const [formMinute, setFormMinute] = useState(0);
  const [formCustomCron, setFormCustomCron] = useState('0 0 6 1 * ?');
  const [formAssignGroupId, setFormAssignGroupId] = useState<number | null>(null);
  const [formPriority, setFormPriority] = useState('medium');
  const [formTitleTemplate, setFormTitleTemplate] = useState('');
  const [formActive, setFormActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const fetchSchedules = async () => {
    try {
      const res = await api.get<RecurringSchedule[]>('/recurring-schedules');
      setSchedules(res.data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const fetchOptions = async () => {
    try {
      const [templatesRes, groupsRes] = await Promise.all([
        api.get<TemplateOption[]>('/templates'),
        api.get<GroupOption[]>('/recurring-schedules/groups'),
      ]);
      setTemplates(templatesRes.data);
      setGroups(groupsRes.data);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchSchedules(); fetchOptions(); }, []);

  const cronExpression = buildCronExpression({
    frequency: formFrequency,
    dayOfWeek: formDayOfWeek,
    dayOfMonth: formDayOfMonth,
    hour: formHour,
    minute: formMinute,
    customCron: formCustomCron,
  });

  const previewNow = new Date();
  const previewedTitle = previewTitle(formTitleTemplate, previewNow);

  const openCreate = () => {
    setEditing(null);
    setFormName('');
    setFormTemplateId(templates[0]?.id ?? null);
    setFormFrequency('MONTHLY');
    setFormDayOfWeek(1);
    setFormDayOfMonth(1);
    setFormHour(6);
    setFormMinute(0);
    setFormCustomCron('0 0 6 1 * ?');
    setFormAssignGroupId(groups[0]?.id ?? null);
    setFormPriority('medium');
    setFormTitleTemplate('');
    setFormActive(true);
    setView('form');
  };

  const openEdit = (s: RecurringSchedule) => {
    setEditing(s);
    setFormName(s.name);
    setFormTemplateId(s.templateId);
    setFormFrequency(s.frequencyType);
    setFormDayOfMonth(1);
    setFormDayOfWeek(1);
    setFormHour(6);
    setFormMinute(0);
    setFormCustomCron(s.frequencyType === 'CUSTOM' ? s.cronExpression : '0 0 6 1 * ?');
    setFormAssignGroupId(s.assignGroupId);
    setFormPriority(s.priority);
    setFormTitleTemplate(s.titleTemplate);
    setFormActive(s.isActive);
    setView('form');
  };

  const backToList = () => { setView('list'); fetchSchedules(); };

  const handleSave = async () => {
    if (!formTemplateId) return;
    setSaving(true);
    const payload = {
      name: formName,
      templateId: formTemplateId,
      cronExpression,
      frequencyType: formFrequency,
      titleTemplate: formTitleTemplate,
      assignGroupId: formAssignGroupId,
      priority: formPriority,
      isActive: formActive,
    };
    try {
      if (editing) {
        await api.put(`/recurring-schedules/${editing.id}`, payload);
      } else {
        await api.post('/recurring-schedules', payload);
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      backToList();
    } catch (err: any) {
      alert('Save failed: ' + (err.response?.data?.message ?? err.message));
    } finally { setSaving(false); }
  };

  const handleDelete = async (s: RecurringSchedule) => {
    if (!window.confirm(t('recurring_delete_confirm', { defaultValue: 'Delete this recurring schedule? This cannot be undone.' }))) return;
    await api.delete(`/recurring-schedules/${s.id}`);
    fetchSchedules();
  };

  const handleTogglePause = async (s: RecurringSchedule) => {
    await api.patch(`/recurring-schedules/${s.id}/active`, null, { params: { active: !s.isActive } });
    fetchSchedules();
  };

  if (view === 'form') {
    return (
      <div className="rt-page">
        <button className="rt-back-btn" onClick={backToList}>
          <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
        </button>

        <div className="rt-form-card">
          <h3 className="rt-form-title">
            {editing
              ? t('recurring_form_title_edit', { defaultValue: 'Edit Recurring Ticket Schedule' })
              : t('recurring_form_title_new', { defaultValue: 'New Recurring Ticket Schedule' })}
          </h3>

          <div className="rt-field-group">
            <label className="rt-label">{t('recurring_form_name_label', { defaultValue: 'Schedule Name' })}</label>
            <input className="rt-input" value={formName} onChange={e => setFormName(e.target.value)} />
          </div>

          <div className="rt-field-group">
            <label className="rt-label">{t('recurring_form_template_label', { defaultValue: 'Template' })}</label>
            <select className="rt-select" value={formTemplateId ?? ''} onChange={e => setFormTemplateId(+e.target.value)}>
              {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
            </select>
          </div>

          <div className="rt-field-group">
            <label className="rt-label">{t('recurring_form_frequency_label', { defaultValue: 'Frequency' })}</label>
            <div className="rt-freq-group">
              {FREQUENCIES.map(f => (
                <button
                  key={f}
                  className={`rt-freq-btn${formFrequency === f ? ' rt-freq-btn-active' : ''}`}
                  onClick={() => setFormFrequency(f)}
                  type="button"
                >
                  {f === 'DAILY' && t('recurring_freq_daily', { defaultValue: 'Daily' })}
                  {f === 'WEEKLY' && t('recurring_freq_weekly', { defaultValue: 'Weekly' })}
                  {f === 'MONTHLY' && t('recurring_freq_monthly', { defaultValue: 'Monthly' })}
                  {f === 'QUARTERLY' && t('recurring_freq_quarterly', { defaultValue: 'Quarterly' })}
                  {f === 'CUSTOM' && t('recurring_freq_custom', { defaultValue: 'Custom (cron)' })}
                </button>
              ))}
            </div>
          </div>

          <div className="rt-row-inline">
            {formFrequency === 'WEEKLY' && (
              <div className="rt-field-group">
                <label className="rt-label">{t('recurring_form_day_of_week_label', { defaultValue: 'Day of Week' })}</label>
                <select className="rt-select" value={formDayOfWeek} onChange={e => setFormDayOfWeek(+e.target.value)}>
                  {DAY_KEYS.map((key, i) => (
                    <option key={key} value={i + 1}>{t(key, { defaultValue: DAY_LABELS[i] })}</option>
                  ))}
                </select>
              </div>
            )}
            {(formFrequency === 'MONTHLY' || formFrequency === 'QUARTERLY') && (
              <div className="rt-field-group">
                <label className="rt-label">{t('recurring_form_day_of_month_label', { defaultValue: 'Day of Month' })}</label>
                <input className="rt-input" type="number" min={1} max={28}
                       value={formDayOfMonth} onChange={e => setFormDayOfMonth(+e.target.value)} />
              </div>
            )}
            {formFrequency === 'CUSTOM' ? (
              <div className="rt-field-group">
                <label className="rt-label">{t('recurring_form_cron_label', { defaultValue: 'Cron Expression' })}</label>
                <input className="rt-input rt-input-mono" value={formCustomCron} onChange={e => setFormCustomCron(e.target.value)} />
                <span className="rt-hint">{t('recurring_form_cron_hint', { defaultValue: 'Standard 6-field cron: sec min hour day-of-month month day-of-week' })}</span>
              </div>
            ) : (
              <div className="rt-field-group">
                <label className="rt-label">{t('recurring_form_time_label', { defaultValue: 'Create At (Time)' })}</label>
                <div className="rt-time-inputs">
                  <input className="rt-input rt-input-narrow" type="number" min={0} max={23}
                         value={formHour} onChange={e => setFormHour(+e.target.value)} />
                  <span>:</span>
                  <input className="rt-input rt-input-narrow" type="number" min={0} max={59}
                         value={formMinute} onChange={e => setFormMinute(+e.target.value)} />
                </div>
                <span className="rt-hint">{t('recurring_form_time_hint', { defaultValue: 'Local server time' })}</span>
              </div>
            )}
          </div>

          <div className="rt-row-inline">
            <div className="rt-field-group">
              <label className="rt-label">{t('recurring_form_assign_group_label', { defaultValue: 'Assign to Group' })}</label>
              <select className="rt-select" value={formAssignGroupId ?? ''} onChange={e => setFormAssignGroupId(e.target.value ? +e.target.value : null)}>
                {groups.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
              </select>
            </div>
            <div className="rt-field-group">
              <label className="rt-label">{t('recurring_form_priority_label', { defaultValue: 'Priority' })}</label>
              <select className="rt-select" value={formPriority} onChange={e => setFormPriority(e.target.value)}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>

          <div className="rt-field-group">
            <label className="rt-label">{t('recurring_form_title_template_label', { defaultValue: 'Title Template' })}</label>
            <input className="rt-input" value={formTitleTemplate} onChange={e => setFormTitleTemplate(e.target.value)} />
            <span className="rt-hint">
              {t('recurring_form_title_template_hint', { defaultValue: 'Use {{month}}, {{year}}, {{week}}, {{quarter}} — substituted when the ticket is created' })}
            </span>
          </div>

          <div className="rt-preview-box">
            {t('recurring_next_occurrence_label', { defaultValue: 'Next occurrence' })}: <strong>{previewNow.toLocaleString()}</strong>
            {formTitleTemplate && (
              <> · {t('recurring_next_occurrence_title_will_be', { defaultValue: 'Title will be' })}: "<strong>{previewedTitle}</strong>"</>
            )}
          </div>

          <div className="rt-toggle-wrap">
            <label className="rt-label">{t('recurring_form_active_label', { defaultValue: 'Active' })}</label>
            <button className={`rt-toggle${formActive ? ' rt-toggle-on' : ''}`} onClick={() => setFormActive(v => !v)} type="button" />
          </div>

          <div className="rt-form-actions">
            <div className="rt-form-actions-right">
              {savedMsg && <span className="rt-saved-msg"><CheckCircle size={13} /> Saved</span>}
              <button className="rt-cancel-btn" onClick={backToList}>{t('cancel_btn', { defaultValue: 'Cancel' })}</button>
              <button className="rt-save-btn" onClick={handleSave} disabled={saving || !formTemplateId}>
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
    <div className="rt-page">
      <div className="rt-header">
        <div className="rt-header-left">
          <Repeat size={20} className="rt-header-icon" />
          <h2 className="rt-title">{t('recurring_page_title', { defaultValue: 'Recurring Ticket Schedules' })}</h2>
        </div>
        <button className="rt-new-btn" onClick={openCreate}>
          <Plus size={14} /> {t('recurring_add_btn', { defaultValue: '+ New Schedule' })}
        </button>
      </div>

      <div className="rt-table-wrap">
        {loading ? (
          <div className="rt-loading"><Loader2 size={18} className="icon-spin" /></div>
        ) : schedules.length === 0 ? (
          <div className="rt-empty">{t('recurring_list_empty', { defaultValue: 'No recurring schedules configured.' })}</div>
        ) : (
          <table className="rt-table">
            <thead>
              <tr>
                <th className="rt-th">{t('recurring_col_name', { defaultValue: 'Schedule Name' })}</th>
                <th className="rt-th">{t('recurring_col_frequency', { defaultValue: 'Frequency' })}</th>
                <th className="rt-th">{t('recurring_col_next_run', { defaultValue: 'Next Run' })}</th>
                <th className="rt-th">{t('recurring_col_assign_to', { defaultValue: 'Assign To' })}</th>
                <th className="rt-th">{t('recurring_col_status', { defaultValue: 'Status' })}</th>
                <th className="rt-th"></th>
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} className={`rt-table-row${s.isActive ? '' : ' rt-table-row-inactive'}`}>
                  <td className="rt-td">{s.name}</td>
                  <td className="rt-td">
                    <span className={`rt-freq-badge rt-freq-badge--${s.frequencyType.toLowerCase()}`}>{freqBadgeText(t, s)}</span>
                  </td>
                  <td className="rt-td">{new Date(s.nextRunAt).toLocaleString()}</td>
                  <td className="rt-td">{s.assignGroupName ?? '—'}</td>
                  <td className="rt-td">
                    <span className={`rt-status-badge${s.isActive ? ' rt-status-badge-active' : ''}`}>
                      {s.isActive
                        ? t('recurring_status_active', { defaultValue: 'Active' })
                        : t('recurring_status_paused', { defaultValue: 'Paused' })}
                    </span>
                  </td>
                  <td className="rt-td rt-td-actions">
                    <button className="rt-action-btn" onClick={() => openEdit(s)}>{t('edit_btn', { defaultValue: 'Edit' })}</button>
                    <button className="rt-action-btn" onClick={() => handleTogglePause(s)}>
                      {s.isActive
                        ? t('recurring_pause_btn', { defaultValue: 'Pause' })
                        : t('recurring_resume_btn', { defaultValue: 'Resume' })}
                    </button>
                    <button className="rt-action-btn rt-action-btn-del" onClick={() => handleDelete(s)}>
                      <Trash2 size={12} />
                    </button>
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
