import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ShieldCheck, Copy, Check, CheckCircle2, AlertCircle, RefreshCw, Info } from 'lucide-react';
import api from '../../../api';
import '../UsersManager/UsersPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface AzureConfig {
  id: number;
  display_name: string;
  sso_enabled: boolean;
  sso_display_name: string | null;
  saml_sp_entity_id: string | null;
}

interface SsoLoginWizardProps {
  config: AzureConfig;
  onClose: () => void;
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

const stepCircle = (n: number, color: string) => (
  <span style={{
    width: 22, height: 22, borderRadius: '50%',
    background: color, color: '#fff', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '0.7rem', fontWeight: 700,
  }}>{n}</span>
);

const stepBox = (children: React.ReactNode, noBorder?: boolean) => (
  <div style={{
    background: '#f8fafc',
    border: noBorder ? 'none' : '1px solid #e2e8f0',
    borderRadius: 10, overflow: 'hidden',
  }}>
    {children}
  </div>
);

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useTranslation();
  const handle = () => navigator.clipboard.writeText(value).then(() => {
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ minWidth: 190, fontSize: '0.78rem', fontWeight: 600, color: '#475569', flexShrink: 0 }}>
        {label}
      </span>
      <input readOnly value={value} style={{
        flex: 1, padding: '6px 10px', borderRadius: 6, minWidth: 0,
        border: '1px solid #e2e8f0', fontSize: '0.78rem',
        backgroundColor: '#f1f5f9', color: '#334155',
        fontFamily: 'monospace', outline: 'none',
      }} />
      <button onClick={handle} title={copied ? t('saml_copied') : t('saml_copy_btn')} style={{
        padding: '6px 10px', borderRadius: 6, flexShrink: 0,
        border: '1px solid #e2e8f0', background: copied ? '#ecfdf5' : '#fff',
        color: copied ? '#059669' : '#64748b', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem',
        transition: 'all 0.15s',
      }}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? t('saml_copied') : t('saml_copy_btn')}
      </button>
    </div>
  );
}

export const SsoLoginWizard = ({ config, onClose }: SsoLoginWizardProps) => {
  const { t } = useTranslation();
  const [ssoEnabled, setSsoEnabled]       = useState(config.sso_enabled);
  const [ssoDisplayName, setSsoDisplayName] = useState(config.sso_display_name ?? '');
  const [samlSpEntityId, setSamlSpEntityId] = useState(config.saml_sp_entity_id ?? '');
  const [saving, setSaving]               = useState(false);
  const [testStatus, setTestStatus]       = useState<TestStatus>('idle');
  const [testError, setTestError]         = useState('');

  const effectiveEntityId = samlSpEntityId.trim() || `urn:turbotikects:azure:${config.id}`;
  const acsUrl       = `${API_BASE}/saml2/sso/${config.id}`;
  const loginUrl     = `${API_BASE}/saml2/login/${config.id}`;
  const metadataUrl  = `${API_BASE}/saml2/metadata/${config.id}`;

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/azure/configs/${config.id}/sso`, { ssoEnabled, ssoDisplayName, samlSpEntityId });
      onClose();
    } catch (err) {
      console.error('Failed to save SSO settings', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSaml = async () => {
    setTestStatus('testing'); setTestError('');
    try {
      const res = await api.get(`/azure/configs/${config.id}/test-saml`);
      setTestStatus(res.data.success ? 'ok' : 'error');
      if (!res.data.success) setTestError(res.data.error ?? t('saml_test_metadata_fail'));
    } catch {
      setTestStatus('error');
      setTestError(t('saml_test_metadata_fail'));
    }
  };

  return (
    <div className="ccm-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ccm-modal" style={{ width: 'min(640px, 96vw)' }}>

        {/* Header */}
        <div className="ccm-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={20} color="#6366f1" />
            <h3 className="ccm-title">{t('sso_wizard_title')}</h3>
          </div>
          <button className="ccm-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="ccm-subtitle" style={{ marginBottom: 0 }}>{config.display_name}</p>

        <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Intro */}
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <Info size={15} style={{ color: '#3b82f6', marginTop: 2, flexShrink: 0 }} />
            <p style={{ margin: 0, fontSize: '0.77rem', color: '#1e40af', lineHeight: 1.55 }}>
              {t('saml_wizard_intro')}
            </p>
          </div>

          {/* ── Step 1: Register in Azure AD ─────────────────────────────── */}
          {stepBox(
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {stepCircle(1, '#6366f1')}
                <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1e293b' }}>
                  {t('saml_guide_step1_title')}
                </span>
              </div>
              <p style={{ margin: '0 0 12px 30px', fontSize: '0.77rem', color: '#64748b', lineHeight: 1.5 }}>
                {t('saml_guide_step1_desc')}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 30 }}>
                <CopyField label={t('saml_guide_azure_identifier')} value={effectiveEntityId} />
                <CopyField label={t('saml_guide_azure_reply_url')}  value={acsUrl} />
                <CopyField label={t('saml_guide_azure_signon_url')} value={loginUrl} />
              </div>
            </div>
          )}

          {/* ── Step 2: Configure here ───────────────────────────────────── */}
          {stepBox(
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {stepCircle(2, '#0284c7')}
                <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1e293b' }}>
                  {t('saml_guide_step2_configure_title')}
                </span>
              </div>

              {/* Login Button Label */}
              <div style={{ marginLeft: 30 }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: '#475569', marginBottom: 5 }}>
                  {t('sso_display_name_label')}
                </label>
                <input
                  type="text"
                  value={ssoDisplayName}
                  onChange={e => setSsoDisplayName(e.target.value)}
                  placeholder={t('sso_display_name_hint')}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '9px 12px', borderRadius: 8,
                    border: '1px solid #e2e8f0', fontSize: '0.875rem',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8', lineHeight: 1.45 }}>
                  {t('sso_display_name_desc')}
                </p>
              </div>

              {/* Enable toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', marginLeft: 30 }}>
                <input
                  type="checkbox"
                  checked={ssoEnabled}
                  onChange={e => setSsoEnabled(e.target.checked)}
                  style={{ width: 17, height: 17, accentColor: '#6366f1', cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                  {t('sso_enable_toggle')}
                </span>
              </label>
            </div>
          )}

          {/* ── Step 3: Verify ───────────────────────────────────────────── */}
          {stepBox(
            <div style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                {stepCircle(3, '#059669')}
                <span style={{ fontSize: '0.83rem', fontWeight: 700, color: '#1e293b' }}>
                  {t('saml_guide_step3_title')}
                </span>
              </div>
              <p style={{ margin: '0 0 12px 30px', fontSize: '0.77rem', color: '#64748b', lineHeight: 1.5 }}>
                {t('saml_guide_step3_desc')}
              </p>
              <div style={{ marginLeft: 30, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={handleTestSaml}
                  disabled={testStatus === 'testing'}
                  style={{
                    padding: '7px 14px', borderRadius: 7,
                    border: '1px solid #6366f1',
                    background: testStatus === 'testing' ? '#f1f5f9' : '#eef2ff',
                    color: '#6366f1',
                    cursor: testStatus === 'testing' ? 'not-allowed' : 'pointer',
                    fontSize: '0.8rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'all 0.15s',
                  }}
                >
                  <RefreshCw size={14} style={{ animation: testStatus === 'testing' ? 'lsc-spin 1s linear infinite' : 'none' }} />
                  {testStatus === 'testing' ? t('saml_test_metadata_testing') : t('saml_test_metadata_btn')}
                </button>
                {testStatus === 'ok' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#059669', fontWeight: 600 }}>
                    <CheckCircle2 size={15} />{t('saml_test_metadata_ok')}
                  </span>
                )}
                {testStatus === 'error' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.78rem', color: '#dc2626', fontWeight: 600 }}>
                    <AlertCircle size={15} />{testError || t('saml_test_metadata_fail')}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── Advanced ─────────────────────────────────────────────────── */}
          <details style={{ fontSize: '0.82rem', color: '#64748b' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, color: '#475569', userSelect: 'none', padding: '2px 0' }}>
              {t('saml_sp_entity_id_label')} &amp; {t('saml_metadata_url_label')} (Advanced)
            </summary>
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#64748b', marginBottom: 4 }}>
                  {t('saml_sp_entity_id_label')}
                </label>
                <input
                  type="text"
                  value={samlSpEntityId}
                  onChange={e => setSamlSpEntityId(e.target.value)}
                  placeholder={effectiveEntityId}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    padding: '7px 10px', borderRadius: 7,
                    border: '1px solid #e2e8f0', fontSize: '0.8rem',
                    outline: 'none', fontFamily: 'monospace',
                  }}
                />
                <span style={{ fontSize: '0.73rem', color: '#94a3b8', marginTop: 3, display: 'block' }}>
                  {t('saml_sp_entity_id_hint')}
                </span>
              </div>
              <CopyField label={t('saml_metadata_url_label')} value={metadataUrl} />
            </div>
          </details>

        </div>

        {/* Footer */}
        <div className="ccm-footer">
          <button className="ccm-btn ccm-btn-cancel" onClick={onClose}>{t('cancel_btn')}</button>
          <button className="ccm-btn ccm-btn-save" onClick={handleSave} disabled={saving}>
            {saving ? '…' : t('sso_save_btn')}
          </button>
        </div>

      </div>
    </div>
  );
};
