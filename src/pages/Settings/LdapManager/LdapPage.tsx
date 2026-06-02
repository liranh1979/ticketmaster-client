import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Network, Plus, RefreshCw } from 'lucide-react';
import { LdapWizard } from './LdapWizard';
import type { MissingField } from './LdapWizard';
import api from '../../../api';
import './LdapPage.css';

interface LdapConfig {
  id: number;
  display_name: string;
  host: string;
  port: number;
  is_active: boolean;
  last_synced_at: string | null;
}

interface LdapPageProps {
  currentUser?: any;
  retriggerConfigId?: number;
  onMissingFields?: (configId: number, suggestions: MissingField[]) => void;
  onRetriggerConsumed?: () => void;
}

export const LdapPage = ({ currentUser: _currentUser, retriggerConfigId, onMissingFields, onRetriggerConsumed }: LdapPageProps) => {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<LdapConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardConfigId, setWizardConfigId] = useState<number | undefined | null>(null); // null = closed, undefined = new
  const [wizardInitialStep, setWizardInitialStep] = useState<number | undefined>(undefined);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; msg: string }>>({});

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/ldap/configs');
      setConfigs(res.data);
    } catch (err) {
      console.error('Failed to load LDAP configs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  // Auto-open wizard at Step 3 when returning from the missing-fields detour
  useEffect(() => {
    if (retriggerConfigId) {
      setWizardConfigId(retriggerConfigId);
      setWizardInitialStep(3);
      onRetriggerConsumed?.();
    }
  }, [retriggerConfigId]); // eslint-disable-line

  const handleDelete = async (cfg: LdapConfig) => {
    if (!window.confirm(t('ldap_delete_confirm'))) return;
    try {
      await api.delete(`/ldap/configs/${cfg.id}`);
      setConfigs(prev => prev.filter(c => c.id !== cfg.id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleTest = async (cfg: LdapConfig) => {
    setTesting(cfg.id);
    setTestResults(prev => ({ ...prev, [cfg.id]: { ok: false, msg: '…' } }));
    try {
      const res = await api.post(`/ldap/configs/${cfg.id}/test`);
      setTestResults(prev => ({ ...prev, [cfg.id]: { ok: res.data.success, msg: res.data.message } }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [cfg.id]: { ok: false, msg: err.response?.data?.message || t('ldap_connection_failed') } }));
    } finally {
      setTesting(null);
      setTimeout(() => setTestResults(prev => { const n = { ...prev }; delete n[cfg.id]; return n; }), 5000);
    }
  };

  const handleSync = async (cfg: LdapConfig) => {
    setSyncing(cfg.id);
    try {
      await api.post(`/ldap/configs/${cfg.id}/sync`);
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncing(null);
      fetchConfigs();
    }
  };

  const formatDate = (dt: string | null) =>
    dt ? new Date(dt).toLocaleString() : t('ldap_never_synced');

  if (loading) {
    return (
      <div className="ldap-loading">
        <div className="up-spinner" />
        {t('ldap_configs_title')}…
      </div>
    );
  }

  return (
    <div className="ldap-page">
      {/* Header */}
      <div className="ldap-header">
        <div className="ldap-header-left">
          <div className="ldap-header-icon"><Network size={22} /></div>
          <div>
            <h2 className="ldap-title">{t('ldap_configs_title')}</h2>
            <p className="ldap-subtitle">{t('settings_ldap_manager')}</p>
          </div>
        </div>
        <div className="ldap-header-actions">
          <button className="ldap-btn ldap-btn-primary" onClick={() => setWizardConfigId(undefined)}>
            <Plus size={16} /> {t('ldap_new_config_btn')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="ldap-table-wrap">
        {configs.length === 0 ? (
          <div className="ldap-empty">{t('ldap_no_configs')}</div>
        ) : (
          <table className="ldap-table">
            <thead>
              <tr>
                <th>{t('ldap_col_name')}</th>
                <th>{t('ldap_col_host')}</th>
                <th>{t('ldap_col_status')}</th>
                <th>{t('ldap_col_last_synced')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(cfg => (
                <tr key={cfg.id}>
                  <td style={{ fontWeight: 600 }}>{cfg.display_name}</td>
                  <td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.83rem' }}>
                    {cfg.host}:{cfg.port}
                  </td>
                  <td>
                    <span className={`ldap-badge ${cfg.is_active ? 'ldap-badge-active' : 'ldap-badge-inactive'}`}>
                      {cfg.is_active ? t('ldap_status_active') : t('ldap_status_inactive')}
                    </span>
                  </td>
                  <td style={{ color: '#64748b', fontSize: '0.83rem' }}>
                    {formatDate(cfg.last_synced_at)}
                    {testResults[cfg.id] && (
                      <div style={{ marginTop: 4, fontSize: '0.75rem', color: testResults[cfg.id].ok ? '#16a34a' : '#e11d48' }}>
                        {testResults[cfg.id].ok ? '✓ ' : '✗ '}{testResults[cfg.id].msg}
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="ldap-actions">
                      <button className="ldap-action-btn ldap-action-btn-edit"
                        onClick={() => setWizardConfigId(cfg.id)}>
                        {t('edit_btn')}
                      </button>
                      <button className="ldap-action-btn ldap-action-btn-test"
                        onClick={() => handleTest(cfg)}
                        disabled={testing === cfg.id}>
                        {t('ldap_test_connection_btn')}
                      </button>
                      <button className="ldap-action-btn ldap-action-btn-sync"
                        onClick={() => handleSync(cfg)}
                        disabled={syncing === cfg.id}>
                        <RefreshCw size={13} className={syncing === cfg.id ? 'spin' : ''} />
                        {t('ldap_sync_now_btn')}
                      </button>
                      <button className="ldap-action-btn ldap-action-btn-delete"
                        onClick={() => handleDelete(cfg)}>
                        {t('delete_btn')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Wizard */}
      {wizardConfigId !== null && (
        <LdapWizard
          configId={wizardConfigId}
          initialStep={wizardInitialStep}
          onMissingFields={onMissingFields}
          onClose={() => { setWizardConfigId(null); setWizardInitialStep(undefined); }}
          onSaved={() => { setWizardConfigId(null); setWizardInitialStep(undefined); fetchConfigs(); }}
        />
      )}
    </div>
  );
};
