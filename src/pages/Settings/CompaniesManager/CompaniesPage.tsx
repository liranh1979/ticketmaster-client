import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { HoursOfOperationEditor } from '../../../components/HoursOfOperationEditor/HoursOfOperationEditor';
import api from '../../../api';
import './CompaniesPage.css';

interface Company {
  id: number;
  name: string;
  description: string | null;
  timezone: string;
  user_count: number;
  group_count: number;
}

const TIMEZONES = [
  'UTC','America/New_York','America/Chicago','America/Denver','America/Los_Angeles',
  'America/Sao_Paulo','Europe/London','Europe/Paris','Europe/Berlin','Europe/Madrid',
  'Europe/Rome','Europe/Istanbul','Asia/Jerusalem','Asia/Dubai','Asia/Kolkata',
  'Asia/Bangkok','Asia/Tokyo','Asia/Shanghai','Australia/Sydney','Pacific/Auckland',
];

type DrawerMode = 'none' | 'form' | 'hours' | 'global-hours';

export const CompaniesPage = () => {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [drawer, setDrawer]       = useState<DrawerMode>('none');
  const [editing, setEditing]     = useState<Company | null>(null);
  const [form, setForm]           = useState({ name: '', description: '', timezone: 'UTC' });
  const [saving, setSaving]       = useState(false);

  const load = () =>
    api.get<Company[]>('/companies').then(r => setCompanies(r.data)).catch(() => {});

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', timezone: 'UTC' });
    setDrawer('form');
  };

  const openEdit = (c: Company) => {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? '', timezone: c.timezone });
    setDrawer('form');
  };

  const openHours = (c: Company) => { setEditing(c); setDrawer('hours'); };

  const handleDelete = async (id: number) => {
    if (!confirm(t('delete_company') + '?')) return;
    await api.delete(`/companies/${id}`).catch(() => {});
    load();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) await api.patch(`/companies/${editing.id}`, form);
      else          await api.post('/companies', form);
      setDrawer('none');
      load();
    } catch { /* ignore */ }
    finally { setSaving(false); }
  };

  return (
    <div className="cp-page">
      <div className="cp-header">
        <h1 className="cp-title">{t('companies_title')}</h1>
        <div className="cp-header-actions">
          <button className="cp-btn cp-btn--secondary" onClick={() => setDrawer('global-hours')}>
            🌐 {t('company_global_hours_btn')}
          </button>
          <button className="cp-btn" onClick={openNew}>+ {t('add_company')}</button>
        </div>
      </div>

      {companies.length === 0 ? (
        <div className="cp-empty">{t('companies_empty')}</div>
      ) : (
        <div className="cp-table-wrap">
          <table className="cp-table">
            <thead>
              <tr>
                <th>{t('company_col_name')}</th>
                <th>{t('company_col_users')}</th>
                <th>{t('company_col_groups')}</th>
                <th>{t('company_col_timezone')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {companies.map(c => (
                <tr key={c.id}>
                  <td><strong style={{ color: '#f1f5f9' }}>{c.name}</strong>
                    {c.description && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 2 }}>{c.description}</div>}
                  </td>
                  <td><span className="cp-count-badge">{c.user_count}</span></td>
                  <td><span className="cp-count-badge">{c.group_count}</span></td>
                  <td><span className="cp-tz-pill">{c.timezone}</span></td>
                  <td>
                    <div className="cp-actions">
                      <button className="cp-icon-btn" onClick={() => openHours(c)}>⏰</button>
                      <button className="cp-icon-btn" onClick={() => openEdit(c)}>{t('edit_btn')}</button>
                      <button className="cp-icon-btn cp-icon-btn--danger" onClick={() => handleDelete(c.id)}>{t('delete_btn')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form drawer */}
      {drawer === 'form' && (
        <div className="cp-overlay" onClick={() => setDrawer('none')}>
          <div className="cp-drawer" onClick={e => e.stopPropagation()}>
            <h2 className="cp-drawer-title">{editing ? t('edit_company') : t('add_company')}</h2>

            <div className="cp-field">
              <label className="cp-label">{t('company_name_label')} *</label>
              <input className="cp-input" value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="cp-field">
              <label className="cp-label">{t('company_desc_label')}</label>
              <textarea className="cp-textarea" value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="cp-field">
              <label className="cp-label">{t('company_timezone_label')}</label>
              <select className="cp-select" value={form.timezone}
                onChange={e => setForm(p => ({ ...p, timezone: e.target.value }))}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>

            <div className="cp-drawer-actions">
              <button className="cp-btn" onClick={handleSave} disabled={saving || !form.name.trim()}>
                {t('company_save_btn')}
              </button>
              <button className="cp-btn cp-btn--secondary" onClick={() => setDrawer('none')}>
                {t('back_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hours drawer */}
      {drawer === 'hours' && editing && (
        <div className="cp-overlay" onClick={() => setDrawer('none')}>
          <div className="cp-drawer" onClick={e => e.stopPropagation()}>
            <h2 className="cp-drawer-title">⏰ {t('hoo_title')} — {editing.name}</h2>
            <HoursOfOperationEditor companyId={editing.id} timezone={editing.timezone}
              onSaved={() => { load(); setDrawer('none'); }} />
          </div>
        </div>
      )}

      {/* Global hours drawer */}
      {drawer === 'global-hours' && (
        <div className="cp-overlay" onClick={() => setDrawer('none')}>
          <div className="cp-drawer" onClick={e => e.stopPropagation()}>
            <h2 className="cp-drawer-title">🌐 {t('hoo_global_title')}</h2>
            <p style={{ color: '#64748b', fontSize: '0.85rem', marginBottom: 20 }}>{t('hoo_global_desc')}</p>
            <HoursOfOperationEditor companyId={null} onSaved={() => setDrawer('none')} />
          </div>
        </div>
      )}
    </div>
  );
};
