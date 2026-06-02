import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CloudCog, Plus, RefreshCw } from 'lucide-react';
import { AzureWizard } from './AzureWizard';
import type { AzureMissingField } from './AzureWizard';
import { SsoLoginWizard } from './SsoLoginWizard';
import api from '../../../api';
import '../LdapManager/LdapPage.css';
import './AzurePage.css';

interface AzureConfig {
  id: number;
  display_name: string;
  tenant_id: string;
  is_active: boolean;
  last_synced_at: string | null;
  sso_enabled: boolean;
  sso_display_name: string | null;
  saml_sp_entity_id: string | null;
}

interface AzurePageProps {
  currentUser?: any;
  retriggerConfigId?: number;
  onMissingFields?: (configId: number, suggestions: AzureMissingField[]) => void;
  onRetriggerConsumed?: () => void;
}

export const AzurePage = ({ currentUser: _currentUser, retriggerConfigId, onMissingFields, onRetriggerConsumed }: AzurePageProps) => {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<AzureConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardConfigId, setWizardConfigId] = useState<number | undefined | null>(null);
  const [wizardInitialStep, setWizardInitialStep] = useState<number | undefined>(undefined);
  const [ssoWizardConfig, setSsoWizardConfig] = useState<AzureConfig | null>(null);
  const [syncing, setSyncing] = useState<number | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; msg: string }>>({});

  const fetchConfigs = async () => {
    try {
      const res = await api.get('/azure/configs');
      setConfigs(res.data);
    } catch (err) {
      console.error('Failed to load Azure configs', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  useEffect(() => {
    if (retriggerConfigId) {
      setWizardConfigId(retriggerConfigId);
      setWizardInitialStep(3);
      onRetriggerConsumed?.();
    }
  }, [retriggerConfigId]); // eslint-disable-line

  const handleDelete = async (cfg: AzureConfig) => {
    if (!window.confirm(t('azure_delete_confirm'))) return;
    try {
      await api.delete(`/azure/configs/${cfg.id}`);
      setConfigs(prev => prev.filter(c => c.id !== cfg.id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  };

  const handleTest = async (cfg: AzureConfig) => {
    setTesting(cfg.id);
    setTestResults(prev => ({ ...prev, [cfg.id]: { ok: false, msg: '…' } }));
    try {
      const res = await api.post(`/azure/configs/${cfg.id}/test`);
      setTestResults(prev => ({ ...prev, [cfg.id]: { ok: res.data.success, msg: res.data.message } }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [cfg.id]: { ok: false, msg: err.response?.data?.message || t('azure_connection_failed') } }));
    } finally {
      setTesting(null);
      setTimeout(() => setTestResults(prev => { const n = { ...prev }; delete n[cfg.id]; return n; }), 5000);
    }
  };

  const handleSync = async (cfg: AzureConfig) => {
    setSyncing(cfg.id);
    try {
      await api.post(`/azure/configs/${cfg.id}/sync`);
    } catch (err) {
      console.error('Sync failed', err);
    } finally {
      setSyncing(null);
      fetchConfigs();
    }
  };

  const formatDate = (dt: string | null) =>
    dt ? new Date(dt).toLocaleString() : t('azure_never_synced');

  if (loading) {
    return (
      <div className="ldap-loading">
        <div className="up-spinner" />
        {t('azure_configs_title')}…
      </div>
    );
  }

  return (
    <div className="ldap-page">
      <div className="azure-header">
        <div className="azure-header-left">
          <div className="azure-header-icon"><CloudCog size={22} /></div>
          <div>
            <h2 className="azure-title">{t('azure_configs_title')}</h2>
            <p className="azure-subtitle">{t('settings_azure_manager')}</p>
          </div>
        </div>
        <div className="azure-header-actions">
          <button className="ldap-btn ldap-btn-primary" onClick={() => setWizardConfigId(undefined)}>
            <Plus size={16} /> {t('azure_new_config_btn')}
          </button>
        </div>
      </div>

      <div className="ldap-table-wrap">
        {configs.length === 0 ? (
          <div className="ldap-empty">{t('azure_no_configs')}</div>
        ) : (
          <table className="ldap-table">
            <thead>
              <tr>
                <th>{t('azure_col_name')}</th>
                <th>{t('azure_col_tenant')}</th>
                <th>{t('azure_col_status')}</th>
                <th>{t('azure_sso_col')}</th>
                <th>{t('azure_col_last_synced')}</th>
                <th>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {configs.map(cfg => (
                <tr key={cfg.id}>
                  <td style={{ fontWeight: 600 }}>{cfg.display_name}</td>
                  <td style={{ color: '#64748b', fontFamily: 'monospace', fontSize: '0.83rem' }}>
                    {cfg.tenant_id}
                  </td>
                  <td>
                    <span className={`ldap-badge ${cfg.is_active ? 'ldap-badge-active' : 'ldap-badge-inactive'}`}>
                      {cfg.is_active ? t('azure_status_active') : t('azure_status_inactive')}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`ldap-badge ${cfg.sso_enabled ? 'ldap-badge-active' : 'ldap-badge-inactive'}`}>
                        {cfg.sso_enabled ? t('azure_sso_enabled') : t('azure_sso_disabled')}
                      </span>
                      <button
                        className="ldap-action-btn ldap-action-btn-edit"
                        onClick={() => setSsoWizardConfig(cfg)}
                      >
                        {t('azure_sso_setup_btn')}
                      </button>
                    </div>
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
                        {t('azure_test_connection_btn')}
                      </button>
                      <button className="ldap-action-btn ldap-action-btn-sync"
                        onClick={() => handleSync(cfg)}
                        disabled={syncing === cfg.id}>
                        <RefreshCw size={13} className={syncing === cfg.id ? 'spin' : ''} />
                        {t('azure_sync_now_btn')}
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

      {wizardConfigId !== null && (
        <AzureWizard
          configId={wizardConfigId}
          initialStep={wizardInitialStep}
          onMissingFields={onMissingFields}
          onClose={() => { setWizardConfigId(null); setWizardInitialStep(undefined); }}
          onSaved={() => { setWizardConfigId(null); setWizardInitialStep(undefined); fetchConfigs(); }}
        />
      )}

      {ssoWizardConfig !== null && (
        <SsoLoginWizard
          config={ssoWizardConfig}
          onClose={() => { setSsoWizardConfig(null); fetchConfigs(); }}
        />
      )}
    </div>
  );
};
