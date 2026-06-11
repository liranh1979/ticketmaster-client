import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../../../api';
import '../LdapManager/LdapPage.css';
import './AzurePage.css';

// ── Types ─────────────────────────────────────────────────────────
interface AzureConfig {
  display_name: string;
  tenant_id: string;
  client_id: string;
  client_secret: string;
  user_filter: string;
  group_filter: string;
  is_active: boolean;
}

interface MappingRow {
  azureAttribute: string;
  sampleValue: string;
  systemFieldKey: string;
  confidence: string;
}

interface FieldOption { key: string; label: string; }

export interface AzureMissingField {
  azureAttribute: string;
  suggestedFieldKey: string;
  suggestedLabel: string;
  suggestedFieldType: string;
}

type MappingStatus = 'idle' | 'loading' | 'done' | 'error';

interface Props {
  configId?: number;
  onClose: () => void;
  onSaved: () => void;
  onMissingFields?: (configId: number, suggestions: AzureMissingField[]) => void;
  initialStep?: number;
}

// ── Constants ─────────────────────────────────────────────────────
const STEPS = [
  'azure_step_connection',
  'azure_step_sample',
  'azure_step_user_mapping',
  'azure_step_group_mapping',
  'azure_step_confirm',
];

const defaultForm = (): AzureConfig => ({
  display_name: '', tenant_id: '', client_id: '', client_secret: '',
  user_filter: '', group_filter: '', is_active: false,
});

const formatKey = (k: string) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const SKIP_OPTION: FieldOption = { key: '', label: '— skip —' };

// ── Component ─────────────────────────────────────────────────────
export const AzureWizard = ({ configId, onClose, onSaved, onMissingFields, initialStep }: Props) => {
  const { t } = useTranslation();
  const isEdit = configId != null;

  // Step 1
  const [step, setStep] = useState(initialStep ?? 1);
  const [form, setForm] = useState<AzureConfig>(defaultForm());
  const [savedId, setSavedId] = useState<number | undefined>(configId);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Step 2
  const [sampleUser, setSampleUser] = useState<Record<string, string> | null>(null);
  const [sampleGroup, setSampleGroup] = useState<Record<string, string> | null>(null);
  const [sampleUserError, setSampleUserError] = useState<string | null>(null);
  const [sampleGroupError, setSampleGroupError] = useState<string | null>(null);
  const [fetchingUser, setFetchingUser] = useState(false);
  const [fetchingGroup, setFetchingGroup] = useState(false);

  // Step 3 — User Mapping
  const [userMappings, setUserMappings] = useState<MappingRow[]>([]);
  const [missingUserFields, setMissingUserFields] = useState<AzureMissingField[]>([]);
  const [userMappingStatus, setUserMappingStatus] = useState<MappingStatus>('idle');
  const [userMappingError, setUserMappingError] = useState('');
  const [userFieldOptions, setUserFieldOptions] = useState<FieldOption[]>([]);
  const [savingUserMappings, setSavingUserMappings] = useState(false);

  // Step 4 — Group Mapping
  const [groupMappings, setGroupMappings] = useState<MappingRow[]>([]);
  const [missingGroupFields, setMissingGroupFields] = useState<AzureMissingField[]>([]);
  const [groupMappingStatus, setGroupMappingStatus] = useState<MappingStatus>('idle');
  const [groupMappingError, setGroupMappingError] = useState('');
  const [groupFieldOptions, setGroupFieldOptions] = useState<FieldOption[]>([]);
  const [savingGroupMappings, setSavingGroupMappings] = useState(false);

  // Step 5
  const [runInitialSync, setRunInitialSync]   = useState(true);
  const [activating, setActivating]           = useState(false);
  const [syncCompanyId, setSyncCompanyId]     = useState<number | null>(null);
  const [companies, setCompanies]             = useState<{ id: number; name: string }[]>([]);

  // Load existing config when editing
  useEffect(() => {
    if (!configId) return;
    api.get('/azure/configs').then((res: any) => {
      const cfg = res.data.find((c: any) => c.id === configId);
      if (!cfg) return;
      setForm(prev => ({
        ...prev,
        display_name: cfg.display_name ?? prev.display_name,
        tenant_id:    cfg.tenant_id   ?? prev.tenant_id,
        client_id:    cfg.client_id   ?? prev.client_id,
        user_filter:  cfg.user_filter  ?? prev.user_filter,
        group_filter: cfg.group_filter ?? prev.group_filter,
      }));
    }).catch(() => {});
  }, []); // eslint-disable-line

  // ── Helpers ────────────────────────────────────────────────────
  const set = (field: keyof AzureConfig, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const stepStatus = (n: number) => n < step ? 'done' : n === step ? 'active' : '';

  const updateUserMapping = (idx: number, key: string) =>
    setUserMappings(prev => prev.map((r, i) => i === idx ? { ...r, systemFieldKey: key } : r));

  const updateGroupMapping = (idx: number, key: string) =>
    setGroupMappings(prev => prev.map((r, i) => i === idx ? { ...r, systemFieldKey: key } : r));

  const buildFieldOptions = async (entityType: 'user' | 'group'): Promise<FieldOption[]> => {
    const translationType = entityType === 'user' ? 'user_fields' : 'group_fields';
    try {
      const [fieldsRes, labelsRes] = await Promise.all([
        api.get('/field-definitions', { params: { entityType } }),
        api.get('/field-definitions/translations/en', { params: { translationType } }),
      ]);
      const labels: Record<string, string> = labelsRes.data;
      const custom = (fieldsRes.data as any[]).map(f => ({
        key: f.fieldKey,
        label: labels[f.fieldKey] || formatKey(f.fieldKey),
      }));
      return entityType === 'user'
        ? [SKIP_OPTION, { key: 'username', label: 'Username' }, { key: 'display_name', label: 'Display Name' }, ...custom]
        : [SKIP_OPTION, { key: 'display_name', label: 'Group Name' }, ...custom];
    } catch {
      return entityType === 'user'
        ? [SKIP_OPTION, { key: 'username', label: 'Username' }, { key: 'display_name', label: 'Display Name' }]
        : [SKIP_OPTION, { key: 'display_name', label: 'Group Name' }];
    }
  };

  // Initialize mapping rows from sample data + saved mappings
  const initUserMappingStep = async () => {
    if (!savedId) return;
    const opts = await buildFieldOptions('user');
    setUserFieldOptions(opts);
    const rows: MappingRow[] = Object.entries(sampleUser || {}).map(([attr, val]) => ({
      azureAttribute: attr, sampleValue: String(val), systemFieldKey: '', confidence: '',
    }));
    try {
      const saved = await api.get(`/azure/configs/${savedId}/mappings`, { params: { entityType: 'user' } });
      (saved.data || []).forEach((m: any) => {
        const row = rows.find(r => r.azureAttribute === (m.azureAttribute || m.azure_attribute));
        if (row) row.systemFieldKey = m.systemFieldKey || m.system_field_key || '';
      });
    } catch {}
    setUserMappings(rows);
  };

  const initGroupMappingStep = async () => {
    if (!savedId) return;
    const opts = await buildFieldOptions('group');
    setGroupFieldOptions(opts);
    const rows: MappingRow[] = Object.entries(sampleGroup || {}).map(([attr, val]) => ({
      azureAttribute: attr, sampleValue: String(val), systemFieldKey: '', confidence: '',
    }));
    try {
      const saved = await api.get(`/azure/configs/${savedId}/mappings`, { params: { entityType: 'group' } });
      (saved.data || []).forEach((m: any) => {
        const row = rows.find(r => r.azureAttribute === (m.azureAttribute || m.azure_attribute));
        if (row) row.systemFieldKey = m.systemFieldKey || m.system_field_key || '';
      });
    } catch {}
    setGroupMappings(rows);
  };

  useEffect(() => {
    if (step === 3 && savedId) initUserMappingStep();
  }, [step]); // eslint-disable-line

  useEffect(() => {
    if (step === 4 && savedId) initGroupMappingStep();
  }, [step]); // eslint-disable-line

  useEffect(() => {
    if (step === 5) {
      api.get<{ id: number; name: string }[]>('/companies').then(r => setCompanies(r.data)).catch(() => {});
    }
  }, [step]);

  // ── Step 1 handlers ────────────────────────────────────────────
  const handleStep1Next = async () => {
    setSaving(true);
    try {
      let id = savedId;
      if (!id) {
        const res = await api.post('/azure/configs', form);
        id = res.data.id;
        setSavedId(id);
      } else {
        await api.patch(`/azure/configs/${id}`, form);
      }
      setStep(2);
    } catch (err: any) {
      alert(err.response?.data?.message || t('azure_connection_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestRaw = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = savedId
        ? await api.post(`/azure/configs/${savedId}/test`)
        : await api.post('/azure/configs/test', form);
      setTestResult({ ok: res.data.success, message: res.data.message });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.response?.data?.message || t('azure_connection_failed') });
    } finally {
      setTesting(false);
    }
  };

  // ── Step 2 handlers ────────────────────────────────────────────
  const fetchSampleUser = async () => {
    if (!savedId) return;
    setFetchingUser(true); setSampleUserError(null);
    try {
      const res = await api.get(`/azure/configs/${savedId}/sample-user`);
      if (res.data.error) { setSampleUserError(res.data.error); setSampleUser({}); }
      else setSampleUser(res.data.attributes || {});
    } catch (err: any) {
      setSampleUserError(err.response?.data?.message || t('azure_connection_failed'));
      setSampleUser({});
    } finally { setFetchingUser(false); }
  };

  const fetchSampleGroup = async () => {
    if (!savedId) return;
    setFetchingGroup(true); setSampleGroupError(null);
    try {
      const res = await api.get(`/azure/configs/${savedId}/sample-group`);
      if (res.data.error) { setSampleGroupError(res.data.error); setSampleGroup({}); }
      else setSampleGroup(res.data.attributes || {});
    } catch (err: any) {
      setSampleGroupError(err.response?.data?.message || t('azure_connection_failed'));
      setSampleGroup({});
    } finally { setFetchingGroup(false); }
  };

  // ── Step 3: User Mapping ───────────────────────────────────────
  const doRunUserMapping = async () => {
    if (!savedId) return;
    setUserMappingStatus('loading');
    setUserMappingError('');
    try {
      const res = await api.post(`/azure/configs/${savedId}/suggest-mapping`, null, {
        params: { entityType: 'user' },
      });
      if (res.data.error) { setUserMappingError(res.data.error); setUserMappingStatus('error'); return; }

      setUserMappings(prev => {
        const next = prev.map(r => ({ ...r }));
        (res.data.mappings || []).forEach((m: any) => {
          const row = next.find(r => r.azureAttribute === m.azureAttribute);
          if (row) { row.systemFieldKey = m.systemFieldKey || ''; row.confidence = m.confidence || ''; }
        });
        return next;
      });
      setMissingUserFields(res.data.missingFields || []);
      setUserMappingStatus('done');
    } catch (err: any) {
      setUserMappingError(err.response?.data?.message || 'AI mapping failed');
      setUserMappingStatus('error');
    }
  };

  const handleSaveUserMappings = async () => {
    if (!savedId) return;
    setSavingUserMappings(true);
    try {
      await api.post(`/azure/configs/${savedId}/mappings`, {
        entity_type: 'user',
        mappings: userMappings.map(m => ({ azure_attribute: m.azureAttribute, system_field_key: m.systemFieldKey })),
      });
      setStep(4);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save user mappings');
    } finally { setSavingUserMappings(false); }
  };

  // ── Step 4: Group Mapping ──────────────────────────────────────
  const doRunGroupMapping = async () => {
    if (!savedId) return;
    setGroupMappingStatus('loading');
    setGroupMappingError('');
    try {
      const res = await api.post(`/azure/configs/${savedId}/suggest-mapping`, null, {
        params: { entityType: 'group' },
      });
      if (res.data.error) { setGroupMappingError(res.data.error); setGroupMappingStatus('error'); return; }

      setGroupMappings(prev => {
        const next = prev.map(r => ({ ...r }));
        (res.data.mappings || []).forEach((m: any) => {
          const row = next.find(r => r.azureAttribute === m.azureAttribute);
          if (row) { row.systemFieldKey = m.systemFieldKey || ''; row.confidence = m.confidence || ''; }
        });
        return next;
      });
      setMissingGroupFields(res.data.missingFields || []);
      setGroupMappingStatus('done');
    } catch (err: any) {
      setGroupMappingError(err.response?.data?.message || 'AI mapping failed');
      setGroupMappingStatus('error');
    }
  };

  const handleSaveGroupMappings = async () => {
    if (!savedId) return;
    setSavingGroupMappings(true);
    try {
      if (groupMappings.length > 0) {
        await api.post(`/azure/configs/${savedId}/mappings`, {
          entity_type: 'group',
          mappings: groupMappings.map(m => ({ azure_attribute: m.azureAttribute, system_field_key: m.systemFieldKey })),
        });
      }
      setStep(5);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save group mappings');
    } finally { setSavingGroupMappings(false); }
  };

  // ── Step 5 handlers ────────────────────────────────────────────
  const handleActivate = async (active: boolean) => {
    if (!savedId) return;
    setActivating(true);
    try {
      await api.post(`/azure/configs/${savedId}/activate`, null, { params: { active } });
      if (active && runInitialSync) await api.post(`/azure/configs/${savedId}/sync`, null,
        syncCompanyId ? { params: { companyId: syncCompanyId } } : undefined);
      onSaved();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save configuration');
    } finally { setActivating(false); }
  };

  // ── Mapping panel renderer (shared for step 3 & 4) ────────────
  const renderMappingPanel = (
    status: MappingStatus,
    error: string,
    mappings: MappingRow[],
    fieldOptions: FieldOption[],
    missingFields: AzureMissingField[],
    updateFn: (idx: number, key: string) => void,
    onRerun: () => void,
    entityLabel: string,
  ) => (
    <>
      {/* Toolbar: always visible */}
      <div className="ldap-mapping-toolbar">
        <div className="ldap-mapping-stats">
          {mappings.filter(m => m.systemFieldKey).length > 0 && (
            <span className="ldap-mapping-stat">
              <CheckCircle2 size={13} />
              {mappings.filter(m => m.systemFieldKey).length} {entityLabel}
            </span>
          )}
        </div>
        <button className="ldap-wizard-btn ldap-wizard-btn-ghost"
          onClick={onRerun}
          disabled={status === 'loading'}
          style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={13} className={status === 'loading' ? 'spin' : ''} />
          {status === 'loading' ? '…' : t('azure_run_mapping_btn')}
        </button>
      </div>

      {status === 'error' && (
        <div className="ldap-test-result error">{error}</div>
      )}

      {/* Missing fields banner - only shown after AI runs */}
      {status === 'done' && missingFields.length > 0 && (
        <div className="ldap-missing-banner">
          <div>
            <strong>{t('azure_missing_fields_title')}</strong>
            <p>{t('azure_missing_fields_desc')}</p>
          </div>
          {onMissingFields && savedId && (
            <button className="ldap-wizard-btn ldap-wizard-btn-primary"
              style={{ fontSize: '0.8rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
              onClick={() => onMissingFields(savedId, missingFields)}>
              {t('azure_go_create_fields_btn')}
            </button>
          )}
        </div>
      )}

      {/* Mapping table - always visible once rows are loaded */}
      {mappings.length > 0 ? (
        <div className="ldap-mapping-card">
          <table className="ldap-mapping-table">
            <thead>
              <tr>
                <th>{t('azure_mapping_azure_attr')}</th>
                <th>{t('ldap_sample_col')}</th>
                <th></th>
                <th>{t('azure_mapping_system_field')}</th>
                <th>{t('azure_mapping_confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {mappings.map((row, i) => (
                <tr key={row.azureAttribute}>
                  <td><code className="ldap-attr-code">{row.azureAttribute}</code></td>
                  <td className="ldap-map-sample">{row.sampleValue.substring(0, 35)}</td>
                  <td className="ldap-map-arrow">→</td>
                  <td>
                    <select className="ldap-mapping-select"
                      value={row.systemFieldKey}
                      onChange={e => updateFn(i, e.target.value)}>
                      {fieldOptions.map(o => (
                        <option key={o.key} value={o.key}>{o.label}</option>
                      ))}
                    </select>
                  </td>
                  <td>
                    {row.confidence && (
                      <span className={`ldap-confidence ldap-confidence-${row.confidence}`}>
                        {row.confidence}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="ldap-sample-placeholder">{t('azure_step3_intro')}</div>
      )}
    </>
  );

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="ldap-wizard-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ldap-wizard-panel">

        {/* Header */}
        <div className="ldap-wizard-header">
          <h2 className="ldap-wizard-title">
            {isEdit ? t('azure_wizard_title_edit') : t('azure_wizard_title_new')}
          </h2>
          <button className="ldap-wizard-close" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Step indicator */}
        <div className="ldap-wizard-steps">
          {STEPS.map((key, i) => {
            const n = i + 1;
            const status = stepStatus(n);
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className={`ldap-step ${status}`}>
                  <div className="ldap-step-dot">{status === 'done' ? '✓' : n}</div>
                  <span className="ldap-step-label">{t(key)}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`ldap-step-divider ${status === 'done' ? 'done' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── Step 1: Connection ── */}
        {step === 1 && (
          <div className="ldap-wizard-body">
            <div className="ldap-form-section">
              <div className="ldap-form-section-title">{t('azure_step_connection')}</div>
              <div className="ldap-form-table">
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_display_name')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi" value={form.display_name}
                      onChange={e => set('display_name', e.target.value)} />
                  </div>
                </div>
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_tenant_id')}</div>
                  <div className="ldap-form-td" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                    <input className="ldap-fi ldap-fi-mono" value={form.tenant_id}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      onChange={e => set('tenant_id', e.target.value)} />
                    <span className="ldap-fi-hint">{t('azure_field_tenant_id_hint')}</span>
                  </div>
                </div>
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_client_id')}</div>
                  <div className="ldap-form-td" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                    <input className="ldap-fi ldap-fi-mono" value={form.client_id}
                      placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      onChange={e => set('client_id', e.target.value)} />
                    <span className="ldap-fi-hint">{t('azure_field_client_id_hint')}</span>
                  </div>
                </div>
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_client_secret')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi" type="password" value={form.client_secret}
                      onChange={e => set('client_secret', e.target.value)}
                      placeholder={isEdit ? '••••••••••••••••' : ''} />
                  </div>
                </div>
              </div>
            </div>

            <div className="ldap-form-section">
              <div className="ldap-form-section-title">{t('azure_section_filters')}</div>
              <div className="ldap-form-table">
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_user_filter')}</div>
                  <div className="ldap-form-td" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                    <input className="ldap-fi ldap-fi-mono" value={form.user_filter}
                      placeholder="accountEnabled eq true"
                      onChange={e => set('user_filter', e.target.value)} />
                    <span className="ldap-fi-hint">{t('azure_field_user_filter_hint')}</span>
                  </div>
                </div>
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_group_filter')}</div>
                  <div className="ldap-form-td" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                    <input className="ldap-fi ldap-fi-mono" value={form.group_filter}
                      placeholder="securityEnabled eq true"
                      onChange={e => set('group_filter', e.target.value)} />
                    <span className="ldap-fi-hint">{t('azure_field_group_filter_hint')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="ldap-test-row">
              <button className="ldap-wizard-btn ldap-wizard-btn-ghost"
                onClick={handleTestRaw}
                disabled={testing || !form.tenant_id || !form.client_id || (!isEdit && !form.client_secret)}>
                {testing ? '…' : t('azure_test_connection_btn')}
              </button>
              {testResult && (
                <div className={`ldap-test-result ${testResult.ok ? 'success' : 'error'}`}>
                  {testResult.ok ? '✓ ' : '✗ '}{testResult.message}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Sample Data ── */}
        {step === 2 && (
          <div className="ldap-wizard-body">
            <p className="ldap-step-intro">{t('azure_step2_intro')}</p>
            <div className="ldap-sample-panels">

              <div className="ldap-sample-panel ldap-sample-panel-user">
                <div className="ldap-sample-panel-header">
                  <div className="ldap-sample-panel-meta">
                    <span className="ldap-sample-panel-title">{t('azure_sample_user_title')}</span>
                    {sampleUser && Object.keys(sampleUser).length > 0 && (
                      <span className="ldap-sample-count-badge">{Object.keys(sampleUser).length}</span>
                    )}
                  </div>
                  <button className="ldap-sample-btn" onClick={fetchSampleUser} disabled={fetchingUser}>
                    <RefreshCw size={12} className={fetchingUser ? 'spin' : ''} />
                    {fetchingUser ? '…' : t('azure_fetch_sample_btn')}
                  </button>
                </div>
                <div className="ldap-sample-body">
                  {fetchingUser ? (
                    <div className="ldap-skeleton-rows">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="ldap-skeleton-row">
                          <div className="ldap-skeleton-cell ldap-skeleton-short" />
                          <div className="ldap-skeleton-cell" />
                        </div>
                      ))}
                    </div>
                  ) : sampleUserError ? (
                    <div className="ldap-sample-placeholder ldap-sample-placeholder-error">{sampleUserError}</div>
                  ) : sampleUser === null ? (
                    <div className="ldap-sample-placeholder">{t('azure_no_sample_yet')}</div>
                  ) : Object.keys(sampleUser).length === 0 ? (
                    <div className="ldap-sample-placeholder ldap-sample-placeholder-warn">No users found.</div>
                  ) : (
                    <div className="ldap-sample-table-wrap">
                      <table className="ldap-sample-table">
                        <tbody>
                          {Object.entries(sampleUser).map(([k, v]) => (
                            <tr key={k}>
                              <td className="ldap-sample-attr"><code className="ldap-attr-code">{k}</code></td>
                              <td className="ldap-sample-val">{String(v).substring(0, 65)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="ldap-sample-panel ldap-sample-panel-group">
                <div className="ldap-sample-panel-header">
                  <div className="ldap-sample-panel-meta">
                    <span className="ldap-sample-panel-title">{t('azure_sample_group_title')}</span>
                    {sampleGroup && Object.keys(sampleGroup).length > 0 && (
                      <span className="ldap-sample-count-badge ldap-sample-count-badge-group">{Object.keys(sampleGroup).length}</span>
                    )}
                  </div>
                  <button className="ldap-sample-btn" onClick={fetchSampleGroup} disabled={fetchingGroup}>
                    <RefreshCw size={12} className={fetchingGroup ? 'spin' : ''} />
                    {fetchingGroup ? '…' : t('azure_fetch_sample_group_btn')}
                  </button>
                </div>
                <div className="ldap-sample-body">
                  {fetchingGroup ? (
                    <div className="ldap-skeleton-rows">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="ldap-skeleton-row">
                          <div className="ldap-skeleton-cell ldap-skeleton-short" />
                          <div className="ldap-skeleton-cell" />
                        </div>
                      ))}
                    </div>
                  ) : sampleGroupError ? (
                    <div className="ldap-sample-placeholder ldap-sample-placeholder-error">{sampleGroupError}</div>
                  ) : sampleGroup === null ? (
                    <div className="ldap-sample-placeholder">{t('azure_no_sample_yet')}</div>
                  ) : Object.keys(sampleGroup).length === 0 ? (
                    <div className="ldap-sample-placeholder ldap-sample-placeholder-warn">No groups found.</div>
                  ) : (
                    <div className="ldap-sample-table-wrap">
                      <table className="ldap-sample-table">
                        <tbody>
                          {Object.entries(sampleGroup).map(([k, v]) => (
                            <tr key={k}>
                              <td className="ldap-sample-attr"><code className="ldap-attr-code">{k}</code></td>
                              <td className="ldap-sample-val">{String(v).substring(0, 65)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── Step 3: User Mapping ── */}
        {step === 3 && (
          <div className="ldap-wizard-body">
            {renderMappingPanel(
              userMappingStatus, userMappingError,
              userMappings, userFieldOptions, missingUserFields,
              updateUserMapping, doRunUserMapping, 'users',
            )}
          </div>
        )}

        {/* ── Step 4: Group Mapping ── */}
        {step === 4 && (
          <div className="ldap-wizard-body">
            {renderMappingPanel(
              groupMappingStatus, groupMappingError,
              groupMappings, groupFieldOptions, missingGroupFields,
              updateGroupMapping, doRunGroupMapping, 'groups',
            )}
          </div>
        )}

        {/* ── Step 5: Confirm & Activate ── */}
        {step === 5 && (
          <div className="ldap-wizard-body">
            <div className="ldap-confirm-ready">
              <CheckCircle2 size={28} className="ldap-confirm-ready-icon" />
              <div>
                <div className="ldap-confirm-ready-title">{t('azure_step4_ready')}</div>
                <div className="ldap-confirm-ready-sub">{t('azure_step4_intro')}</div>
              </div>
            </div>

            <div className="ldap-form-section">
              <div className="ldap-form-section-title">{t('azure_step_confirm')}</div>
              <div className="ldap-form-table">
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_display_name')}</div>
                  <div className="ldap-form-td">
                    <span className="ldap-confirm-text">{form.display_name}</span>
                  </div>
                </div>
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_field_tenant_id')}</div>
                  <div className="ldap-form-td">
                    <code className="ldap-dn-preview azure-confirm-tenant">{form.tenant_id}</code>
                  </div>
                </div>
                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('azure_step_user_mapping')}</div>
                  <div className="ldap-form-td">
                    <span className="ldap-confirm-text">
                      {userMappings.filter(m => m.systemFieldKey).length} fields mapped
                    </span>
                  </div>
                </div>
                {groupMappings.length > 0 && (
                  <div className="ldap-form-tr">
                    <div className="ldap-form-th">{t('azure_step_group_mapping')}</div>
                    <div className="ldap-form-td">
                      <span className="ldap-confirm-text">
                        {groupMappings.filter(m => m.systemFieldKey).length} fields mapped
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Company assignment */}
            {companies.length > 0 && (
              <div className="ldap-form-section" style={{ marginTop: 16 }}>
                <div className="ldap-form-section-title">{t('company_section')}</div>
                <select
                  className="ldap-fi-input"
                  value={syncCompanyId ?? ''}
                  onChange={e => setSyncCompanyId(e.target.value === '' ? null : Number(e.target.value))}>
                  <option value="">{t('companies_none_assigned')}</option>
                  {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            )}

            <label className="ldap-sync-card">
              <input type="checkbox" className="ldap-sync-checkbox"
                checked={runInitialSync} onChange={e => setRunInitialSync(e.target.checked)} />
              <div className="ldap-sync-card-info">
                <div className="ldap-sync-card-title">{t('azure_sync_option_title')}</div>
                <div className="ldap-sync-card-desc">{t('azure_sync_option_desc')}</div>
              </div>
            </label>

            <div className="ldap-confirm-actions">
              <button className="ldap-wizard-btn ldap-wizard-btn-primary ldap-btn-full"
                onClick={() => handleActivate(true)} disabled={activating}>
                {activating ? '…' : t('azure_save_config_btn')}
              </button>
              <button className="ldap-wizard-btn ldap-wizard-btn-secondary ldap-btn-full"
                onClick={() => handleActivate(false)} disabled={activating}>
                {t('azure_save_draft_btn')}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="ldap-wizard-footer">
          <button className="ldap-wizard-btn ldap-wizard-btn-secondary" onClick={onClose}>
            {t('cancel_btn')}
          </button>
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 1 && step < 5 && (
              <button className="ldap-wizard-btn ldap-wizard-btn-secondary"
                onClick={() => setStep(s => s - 1)}>
                ← {t('back_btn')}
              </button>
            )}
            {step === 1 && (
              <button className="ldap-wizard-btn ldap-wizard-btn-primary"
                onClick={handleStep1Next}
                disabled={saving || !form.display_name || !form.tenant_id || !form.client_id || (!isEdit && !form.client_secret)}>
                {saving ? '…' : t('next_btn')}
              </button>
            )}
            {step === 2 && (
              <button className="ldap-wizard-btn ldap-wizard-btn-primary"
                onClick={() => setStep(3)}
                disabled={!sampleUser || Object.keys(sampleUser).length === 0}>
                {t('next_btn')}
              </button>
            )}
            {step === 3 && (
              <button className="ldap-wizard-btn ldap-wizard-btn-primary"
                onClick={handleSaveUserMappings}
                disabled={savingUserMappings || userMappingStatus === 'loading'}>
                {savingUserMappings ? '…' : t('next_btn')}
              </button>
            )}
            {step === 4 && (
              <button className="ldap-wizard-btn ldap-wizard-btn-primary"
                onClick={handleSaveGroupMappings}
                disabled={savingGroupMappings || groupMappingStatus === 'loading'}>
                {savingGroupMappings ? '…' : t('next_btn')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
