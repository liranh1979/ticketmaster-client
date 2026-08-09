import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Plus, Trash2, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../../../api';
import './AnnouncementsPage.css';

interface Announcement {
  id: number;
  severity: string;
  title: string;
  message: string;
  showOnPortal: boolean;
  showOnTicketCreate: boolean;
  showOnAgentDashboard: boolean;
  isActive: boolean;
  broadcastEmail: boolean;
  broadcastTarget: string | null;
  broadcastGroupId: number | null;
  broadcastGroupName: string | null;
  createdByName: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

interface AlertType { id: number; typeKey: string; color: string; icon: string | null; isSystem: boolean; }
interface Group { id: number; display_name: string; }

export const AnnouncementsPage = () => {
  const { t } = useTranslation();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [alertTypes, setAlertTypes] = useState<AlertType[]>([]);
  const [alertLabels, setAlertLabels] = useState<Record<string, string>>({});
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<Announcement | null>(null);

  const [formSeverity, setFormSeverity] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [formShowPortal, setFormShowPortal] = useState(true);
  const [formShowTicketCreate, setFormShowTicketCreate] = useState(true);
  const [formShowAgentDashboard, setFormShowAgentDashboard] = useState(false);
  const [formBroadcastEmail, setFormBroadcastEmail] = useState(false);
  const [formBroadcastTarget, setFormBroadcastTarget] = useState<'all' | 'group'>('all');
  const [formBroadcastGroupId, setFormBroadcastGroupId] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const fetchAnnouncements = async () => {
    try {
      const res = await api.get<Announcement[]>('/announcements');
      setAnnouncements(res.data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  const fetchOptions = async () => {
    try {
      const [alertTypesRes, groupsRes, labelsRes] = await Promise.all([
        api.get<AlertType[]>('/alert-types'),
        api.get<Group[]>('/groups'),
        api.get<Record<string, string>>('/field-definitions/translations/en', { params: { translationType: 'alert_types' } }),
      ]);
      setAlertTypes(alertTypesRes.data);
      setGroups(groupsRes.data);
      setAlertLabels(labelsRes.data);
    } catch { /* silent */ }
  };

  useEffect(() => { fetchAnnouncements(); fetchOptions(); }, []);

  const selectableAlertTypes = alertTypes.filter(a => a.typeKey !== 'resolved');

  const openCreate = () => {
    setEditing(null);
    setFormSeverity(selectableAlertTypes[0]?.typeKey ?? '');
    setFormTitle('');
    setFormMessage('');
    setFormShowPortal(true);
    setFormShowTicketCreate(true);
    setFormShowAgentDashboard(false);
    setFormBroadcastEmail(false);
    setFormBroadcastTarget('all');
    setFormBroadcastGroupId(groups[0]?.id ?? null);
    setView('form');
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setFormSeverity(a.severity);
    setFormTitle(a.title);
    setFormMessage(a.message);
    setFormShowPortal(a.showOnPortal);
    setFormShowTicketCreate(a.showOnTicketCreate);
    setFormShowAgentDashboard(a.showOnAgentDashboard);
    setFormBroadcastEmail(a.broadcastEmail);
    setFormBroadcastTarget((a.broadcastTarget as 'all' | 'group') ?? 'all');
    setFormBroadcastGroupId(a.broadcastGroupId);
    setView('form');
  };

  const backToList = () => { setView('list'); fetchAnnouncements(); };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      severity: formSeverity,
      title: formTitle,
      message: formMessage,
      showOnPortal: formShowPortal,
      showOnTicketCreate: formShowTicketCreate,
      showOnAgentDashboard: formShowAgentDashboard,
      broadcastEmail: formBroadcastEmail,
      broadcastTarget: formBroadcastEmail ? formBroadcastTarget : null,
      broadcastGroupId: formBroadcastEmail && formBroadcastTarget === 'group' ? formBroadcastGroupId : null,
    };
    try {
      if (editing) {
        await api.put(`/announcements/${editing.id}`, payload);
      } else {
        await api.post('/announcements', payload);
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      backToList();
    } catch (err: any) {
      alert('Save failed: ' + (err.response?.data?.message ?? err.message));
    } finally { setSaving(false); }
  };

  const handleResolve = async (a: Announcement) => {
    await api.patch(`/announcements/${a.id}/resolve`);
    fetchAnnouncements();
  };

  const handleDelete = async (a: Announcement) => {
    if (!window.confirm(t('announcements_delete_confirm', { defaultValue: 'Delete this announcement? This cannot be undone.' }))) return;
    await api.delete(`/announcements/${a.id}`);
    fetchAnnouncements();
  };

  const alertTypeMeta = (key: string) => alertTypes.find(a => a.typeKey === key);
  const alertTypeLabel = (key: string) => alertLabels[key] ?? key;

  if (view === 'form') {
    return (
      <div className="an-page">
        <button className="an-back-btn" onClick={backToList}>
          <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
        </button>

        <div className="an-form-card">
          <h3 className="an-form-title">
            {editing
              ? t('announcements_form_title_edit', { defaultValue: 'Edit Announcement' })
              : t('announcements_form_title_new', { defaultValue: 'New Announcement' })}
          </h3>

          <div className="an-field-group">
            <label className="an-label">{t('announcements_form_severity_label', { defaultValue: 'Alert Type' })}</label>
            <div className="an-pill-group">
              {selectableAlertTypes.map(a => (
                <button
                  key={a.typeKey}
                  className={`an-pill${formSeverity === a.typeKey ? ' an-pill-active' : ''}`}
                  onClick={() => setFormSeverity(a.typeKey)}
                  type="button"
                >
                  {a.icon} {alertTypeLabel(a.typeKey)}
                </button>
              ))}
            </div>
          </div>

          <div className="an-field-group">
            <label className="an-label">{t('announcements_form_title_label', { defaultValue: 'Title' })}</label>
            <input className="an-input" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
          </div>

          <div className="an-field-group">
            <label className="an-label">{t('announcements_form_message_label', { defaultValue: 'Message' })}</label>
            <textarea className="an-textarea" value={formMessage} onChange={e => setFormMessage(e.target.value)} rows={4} />
          </div>

          <div className="an-field-group">
            <label className="an-label">{t('announcements_form_show_on_label', { defaultValue: 'Show On' })}</label>
            <label className="an-checkbox-row">
              <input type="checkbox" checked={formShowPortal} onChange={e => setFormShowPortal(e.target.checked)} />
              {t('announcements_show_on_portal', { defaultValue: 'End-User Portal banner' })}
            </label>
            <label className="an-checkbox-row">
              <input type="checkbox" checked={formShowTicketCreate} onChange={e => setFormShowTicketCreate(e.target.checked)} />
              {t('announcements_show_on_ticket_create', { defaultValue: 'Ticket creation page' })}
            </label>
            <label className="an-checkbox-row">
              <input type="checkbox" checked={formShowAgentDashboard} onChange={e => setFormShowAgentDashboard(e.target.checked)} />
              {t('announcements_show_on_agent_dashboard', { defaultValue: 'Agent dashboard' })}
            </label>
          </div>

          <div className="an-field-group">
            <label className="an-checkbox-row">
              <input type="checkbox" checked={formBroadcastEmail} onChange={e => setFormBroadcastEmail(e.target.checked)} />
              {t('announcements_form_broadcast_label', { defaultValue: 'Send Email Broadcast To' })}
            </label>
            {formBroadcastEmail && (
              <div className="an-broadcast-options">
                <label className="an-checkbox-row">
                  <input type="radio" name="broadcast-target" checked={formBroadcastTarget === 'all'}
                         onChange={() => setFormBroadcastTarget('all')} />
                  {t('announcements_broadcast_all', { defaultValue: 'All users' })}
                </label>
                <label className="an-checkbox-row">
                  <input type="radio" name="broadcast-target" checked={formBroadcastTarget === 'group'}
                         onChange={() => setFormBroadcastTarget('group')} />
                  {t('announcements_broadcast_group', { defaultValue: 'Specific group' })}
                </label>
                {formBroadcastTarget === 'group' && (
                  <select className="an-select" value={formBroadcastGroupId ?? ''}
                          onChange={e => setFormBroadcastGroupId(e.target.value ? +e.target.value : null)}>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.display_name}</option>)}
                  </select>
                )}
              </div>
            )}
          </div>

          <div className="an-form-actions">
            <div className="an-form-actions-right">
              {savedMsg && <span className="an-saved-msg"><CheckCircle size={13} /> Saved</span>}
              <button className="an-cancel-btn" onClick={backToList}>{t('cancel_btn', { defaultValue: 'Cancel' })}</button>
              <button className="an-save-btn" onClick={handleSave} disabled={saving || !formTitle || !formSeverity}>
                {saving ? <Loader2 size={13} className="icon-spin" /> : null}
                {t('announcements_post_btn', { defaultValue: 'Post Announcement' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="an-page">
      <div className="an-header">
        <div className="an-header-left">
          <Megaphone size={20} className="an-header-icon" />
          <h2 className="an-title">{t('announcements_page_title', { defaultValue: 'Announcements' })}</h2>
        </div>
        <button className="an-new-btn" onClick={openCreate}>
          <Plus size={14} /> {t('announcements_add_btn', { defaultValue: '+ New Announcement' })}
        </button>
      </div>

      <div className="an-table-wrap">
        {loading ? (
          <div className="an-loading"><Loader2 size={18} className="icon-spin" /></div>
        ) : announcements.length === 0 ? (
          <div className="an-empty">{t('announcements_list_empty', { defaultValue: 'No announcements yet.' })}</div>
        ) : (
          <table className="an-table">
            <thead>
              <tr>
                <th className="an-th">{t('announcements_col_severity', { defaultValue: 'Alert Type' })}</th>
                <th className="an-th">{t('announcements_col_title', { defaultValue: 'Title' })}</th>
                <th className="an-th">{t('announcements_col_status', { defaultValue: 'Status' })}</th>
                <th className="an-th">{t('announcements_col_created', { defaultValue: 'Posted' })}</th>
                <th className="an-th"></th>
              </tr>
            </thead>
            <tbody>
              {announcements.map(a => {
                const meta = alertTypeMeta(a.severity);
                return (
                  <tr key={a.id} className={`an-table-row${a.isActive ? '' : ' an-table-row-inactive'}`}>
                    <td className="an-td">
                      <span className={`an-severity-chip an-severity-${meta?.color ?? 'neutral'}`}>
                        {meta?.icon} {alertTypeLabel(a.severity)}
                      </span>
                    </td>
                    <td className="an-td">{a.title}</td>
                    <td className="an-td">{a.isActive ? (a.severity === 'resolved' ? t('announcement_severity_resolved', { defaultValue: 'Resolved' }) : t('log_monitor_status_active', { defaultValue: 'Active' })) : t('log_monitor_status_paused', { defaultValue: 'Paused' })}</td>
                    <td className="an-td">{new Date(a.createdAt).toLocaleString()}</td>
                    <td className="an-td an-td-actions">
                      <button className="an-action-btn" onClick={() => openEdit(a)}>{t('edit_btn', { defaultValue: 'Edit' })}</button>
                      {a.severity !== 'resolved' && (
                        <button className="an-action-btn" onClick={() => handleResolve(a)}>{t('announcements_resolve_btn', { defaultValue: 'Mark Resolved' })}</button>
                      )}
                      <button className="an-action-btn an-action-btn-del" onClick={() => handleDelete(a)}>
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
