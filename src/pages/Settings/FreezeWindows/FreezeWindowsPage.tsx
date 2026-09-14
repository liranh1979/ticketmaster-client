import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, Plus, Trash2, Loader2, ArrowLeft, CheckCircle } from 'lucide-react';
import api from '../../../api';
import './FreezeWindowsPage.css';

// Change Management: small CRUD screen for change_freeze_windows, gated by
// MANAGE_CHANGE_FREEZE_WINDOWS (checked by SettingsPage.tsx before rendering this at all — the
// backend also independently enforces it on every /change-freeze-windows call). Deliberately not
// visually elaborate — same shape as every other settings CRUD page in this app. See
// V2/Change Management/03-freeze-windows-calendar.html and 04-relationships-permissions.html.

interface FreezeWindow {
  id: number;
  startDatetime: string;
  endDatetime: string;
  reason: string;
  allowEmergency: boolean;
  createdByName: string | null;
  createdAt: string;
}

const toLocalInput = (iso: string) => (iso ? iso.slice(0, 16) : '');

export const FreezeWindowsPage = () => {
  const { t } = useTranslation();

  const [windows, setWindows] = useState<FreezeWindow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<FreezeWindow | null>(null);

  const [formStart, setFormStart] = useState('');
  const [formEnd, setFormEnd] = useState('');
  const [formReason, setFormReason] = useState('');
  const [formAllowEmergency, setFormAllowEmergency] = useState(true);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWindows = async () => {
    try {
      const res = await api.get<FreezeWindow[]>('/change-freeze-windows');
      setWindows(res.data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchWindows(); }, []);

  const openCreate = () => {
    setEditing(null);
    setFormStart('');
    setFormEnd('');
    setFormReason('');
    setFormAllowEmergency(true);
    setError(null);
    setView('form');
  };

  const openEdit = (w: FreezeWindow) => {
    setEditing(w);
    setFormStart(toLocalInput(w.startDatetime));
    setFormEnd(toLocalInput(w.endDatetime));
    setFormReason(w.reason);
    setFormAllowEmergency(w.allowEmergency);
    setError(null);
    setView('form');
  };

  const backToList = () => { setView('list'); fetchWindows(); };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const payload = {
      startDatetime: formStart,
      endDatetime: formEnd,
      reason: formReason,
      allowEmergency: formAllowEmergency,
    };
    try {
      if (editing) {
        await api.put(`/change-freeze-windows/${editing.id}`, payload);
      } else {
        await api.post('/change-freeze-windows', payload);
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      backToList();
    } catch (err: any) {
      setError(err.response?.data?.message ?? err.message);
    } finally { setSaving(false); }
  };

  const handleDelete = async (w: FreezeWindow) => {
    if (!window.confirm(t('freeze_windows_delete_confirm', { defaultValue: 'Delete this freeze window?' }))) return;
    await api.delete(`/change-freeze-windows/${w.id}`);
    fetchWindows();
  };

  if (view === 'form') {
    return (
      <div className="fw-page">
        <button className="fw-back-btn" onClick={backToList}>
          <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
        </button>

        <div className="fw-form-card">
          <h3 className="fw-form-title">
            {editing
              ? t('freeze_windows_form_title_edit', { defaultValue: 'Edit Freeze Window' })
              : t('freeze_windows_form_title_new', { defaultValue: 'New Freeze Window' })}
          </h3>

          {error && <div className="fw-error-banner" role="alert" aria-live="assertive">{error}</div>}

          <div className="fw-field-group">
            <label className="fw-label">{t('freeze_windows_form_reason_label', { defaultValue: 'Reason' })}</label>
            <input className="fw-input" value={formReason} onChange={e => setFormReason(e.target.value)} />
          </div>

          <div className="fw-field-row">
            <div className="fw-field-group">
              <label className="fw-label">{t('freeze_windows_form_start_label', { defaultValue: 'Start' })}</label>
              <input type="datetime-local" className="fw-input" value={formStart} onChange={e => setFormStart(e.target.value)} />
            </div>
            <div className="fw-field-group">
              <label className="fw-label">{t('freeze_windows_form_end_label', { defaultValue: 'End' })}</label>
              <input type="datetime-local" className="fw-input" value={formEnd} onChange={e => setFormEnd(e.target.value)} />
            </div>
          </div>

          <div className="fw-field-group">
            <label className="fw-checkbox-row">
              <input type="checkbox" checked={formAllowEmergency} onChange={e => setFormAllowEmergency(e.target.checked)} />
              {t('freeze_windows_form_emergency_label', { defaultValue: 'Allow Emergency changes to bypass this window' })}
            </label>
          </div>

          <div className="fw-form-actions">
            <div className="fw-form-actions-right">
              {savedMsg && <span className="fw-saved-msg"><CheckCircle size={13} /> Saved</span>}
              <button className="fw-cancel-btn" onClick={backToList}>{t('cancel_btn', { defaultValue: 'Cancel' })}</button>
              <button className="fw-save-btn" onClick={handleSave} disabled={saving || !formStart || !formEnd || !formReason}>
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
    <div className="fw-page">
      <div className="fw-header">
        <div className="fw-header-left">
          <Lock size={20} className="fw-header-icon" />
          <h2 className="fw-title">{t('freeze_windows_page_title', { defaultValue: 'Change Freeze Windows' })}</h2>
        </div>
        <button className="fw-new-btn" onClick={openCreate}>
          <Plus size={14} /> {t('freeze_windows_add_btn', { defaultValue: '+ New Freeze Window' })}
        </button>
      </div>

      <div className="fw-table-wrap">
        {loading ? (
          <div className="fw-loading"><Loader2 size={18} className="icon-spin" /></div>
        ) : windows.length === 0 ? (
          <div className="fw-empty">{t('freeze_windows_list_empty', { defaultValue: 'No freeze windows configured.' })}</div>
        ) : (
          <table className="fw-table">
            <thead>
              <tr>
                <th className="fw-th">{t('freeze_windows_col_reason', { defaultValue: 'Reason' })}</th>
                <th className="fw-th">{t('freeze_windows_col_start', { defaultValue: 'Start' })}</th>
                <th className="fw-th">{t('freeze_windows_col_end', { defaultValue: 'End' })}</th>
                <th className="fw-th">{t('freeze_windows_col_emergency', { defaultValue: 'Allows Emergency' })}</th>
                <th className="fw-th"></th>
              </tr>
            </thead>
            <tbody>
              {windows.map(w => (
                <tr key={w.id} className="fw-table-row">
                  <td className="fw-td">{w.reason}</td>
                  <td className="fw-td">{new Date(w.startDatetime).toLocaleString()}</td>
                  <td className="fw-td">{new Date(w.endDatetime).toLocaleString()}</td>
                  <td className="fw-td">
                    <span className={`fw-emergency-chip${w.allowEmergency ? ' fw-emergency-yes' : ' fw-emergency-no'}`}>
                      {w.allowEmergency ? '✓' : '✕'}
                    </span>
                  </td>
                  <td className="fw-td fw-td-actions">
                    <button className="fw-action-btn" onClick={() => openEdit(w)}>{t('edit_btn', { defaultValue: 'Edit' })}</button>
                    <button className="fw-action-btn fw-action-btn-del" onClick={() => handleDelete(w)}>
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
