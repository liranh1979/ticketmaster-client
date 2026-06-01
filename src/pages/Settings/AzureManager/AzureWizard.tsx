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

interface Props {
  configId?: number;
  onClose: () => void;
  onSaved: () => void;
  onMissingFields?: (configId: number, suggestions: AzureMissingField[]) => void;
  initialStep?: number;
}

// ── Constants ─────────────────────────────────────────────────────
const STEPS = ['azure_step_connection', 'azure_step_sample', 'azure_step_mapping', 'azure_step_confirm'];

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

  // Step 3
  const [userMappings, setUserMappings] = useState<MappingRow[]>([]);
  const [groupMappings, setGroupMappings] = useState<MappingRow[]>([]);
  const [missingUserFields, setMissingUserFields] = useState<AzureMissingField[]>([]);
  const [missingGroupFields, setMissingGroupFields] = useState<AzureMissingField[]>([]);
  const [mappingStatus, setMappingStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [mappingError, setMappingError] = useState('');
  const [userFieldOptions, setUserFieldOptions] = useState<FieldOption[]>([]);
  const [groupFieldOptions, setGroupFieldOptions] = useState<FieldOption[]>([]);
  const [savingMappings, setSavingMappings] = useState(false);

  // Step 4
  const [runInitialSync, setRunInitialSync] = useState(true);
  const [activating, setActivating] = useState(false);

  // Auto-trigger AI mapping when entering Step 3
  useEffect(() => {
    if (step === 3 && mappingStatus === 'idle' && savedId) {
      doRunMapping();
    }
  }, [step, mappingStatus]); // eslint-disable-line

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
      const res = await api.post('/azure/configs/test', form);
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
    setFetchingUser(true);
    setSampleUserError(null);
    try {
      const res = await api.get(`/azure/configs/${savedId}/sample-user`);
      if (res.data.error) {
        setSampleUserError(res.data.error);
        setSampleUser({});
      } else {
        setSampleUser(res.data.attributes || {});
      }
    } catch (err: any) {
      setSampleUserError(err.response?.data?.message || t('azure_connection_failed'));
      setSampleUser({});
    } finally {
      setFetchingUser(false);
    }
  };

  const fetchSampleGroup = async () => {
    if (!savedId) return;
    setFetchingGroup(true);
    setSampleGroupError(null);
    try {
      const res = await api.get(`/azure/configs/${savedId}/sample-group`);
      if (res.data.error) {
        setSampleGroupError(res.data.error);
        setSampleGroup({});
      } else {
        setSampleGroup(res.data.attributes || {});
      }
    } catch (err: any) {
      setSampleGroupError(err.response?.data?.message || t('azure_connection_failed'));
      setSampleGroup({});
    } finally {
      setFetchingGroup(false);
    }
  };

  // ── Step 3 handlers ────────────────────────────────────────────
  const doRunMapping = async () => {
    if (!savedId) return;
    setMappingStatus('loading');
    setMappingError('');

    try {
      const buildUserOptions = async (): Promise<FieldOption[]> => {
        try {
          const [fieldsRes, labelsRes] = await Promise.all([
            api.get('/field-definitions', { params: { entityType: 'user' } }),
            api.get('/field-definitions/translations/en', { params: { translationType: 'user_fields' } }),
          ]);
          const labels: Record<string, string> = labelsRes.data;
          const custom = (fieldsRes.data as any[]).map(f => ({
            key: f.fieldKey,
            label: labels[f.fieldKey] || formatKey(f.fieldKey),
          }));
          return [SKIP_OPTION, { key: 'username', label: 'Username' }, { key: 'display_name', label: 'Display Name' }, ...custom];
        } catch {
          return [SKIP_OPTION, { key: 'username', label: 'Username' }, { key: 'display_name', label: 'Display Name' }];
        }
      };

      const buildGroupOptions = async (): Promise<FieldOption[]> => {
        try {
          const [fieldsRes, labelsRes] = await Promise.all([
            api.get('/field-definitions', { params: { entityType: 'group' } }),
            api.get('/field-definitions/translations/en', { params: { translationType: 'group_fields' } }),
          ]);
          const labels: Record<string, string> = labelsRes.data;
          const custom = (fieldsRes.data as any[]).map(f => ({
            key: f.fieldKey,
            label: labels[f.fieldKey] || formatKey(f.fieldKey),
          }));
          return [SKIP_OPTION, { key: 'display_name', label: 'Group Name' }, ...custom];
        } catch {
          return [SKIP_OPTION, { key: 'display_name', label: 'Group Name' }];
        }
      };

      const [uOpts, gOpts] = await Promise.all([buildUserOptions(), buildGroupOptions()]);
      setUserFieldOptions(uOpts);
      setGroupFieldOptions(gOpts);

      const userRes = await api.post(`/azure/configs/${savedId}/suggest-mapping`, null, {
        params: { entityType: 'user' },
      });

      if (userRes.data.error) {
        setMappingError(userRes.data.error);
        setMappingStatus('error');
        return;
      }

      setUserMappings((userRes.data.mappings || []).map((m: any) => ({
        azureAttribute: m.azureAttribute,
        sampleValue: m.azureSampleValue || '',
        systemFieldKey: m.systemFieldKey || '',
        confidence: m.confidence || '',
      })));
      setMissingUserFields(userRes.data.missingFields || []);

      if (sampleGroup && Object.keys(sampleGroup).length > 0) {
        try {
          const groupRes = await api.post(`/azure/configs/${savedId}/suggest-mapping`, null, {
            params: { entityType: 'group' },
          });
          setGroupMappings((groupRes.data.mappings || []).map((m: any) => ({
            azureAttribute: m.azureAttribute,
            sampleValue: m.azureSampleValue || '',
            systemFieldKey: m.systemFieldKey || '',
            confidence: m.confidence || '',
          })));
          setMissingGroupFields(groupRes.data.missingFields || []);
        } catch { /* group mapping failure is non-fatal */ }
      }

      setMappingStatus('done');
    } catch (err: any) {
      setMappingError(err.response?.data?.message || 'AI mapping failed');
      setMappingStatus('error');
    }
  };

  const handleRerunMapping = () => {
    setUserMappings([]);
    setGroupMappings([]);
    setMissingUserFields([]);
    setMissingGroupFields([]);
    setMappingStatus('idle');
  };

  const handleSaveMappings = async () => {
    if (!savedId) return;
    setSavingMappings(true);
    try {
      await api.post(`/azure/configs/${savedId}/mappings`, {
        entity_type: 'user',
        mappings: userMappings.map(m => ({ azure_attribute: m.azureAttribute, system_field_key: m.systemFieldKey })),
      });
      if (groupMappings.length > 0) {
        await api.post(`/azure/configs/${savedId}/mappings`, {
          entity_type: 'group',
          mappings: groupMappings.map(m => ({ azure_attribute: m.azureAttribute, system_field_key: m.systemFieldKey })),
        });
      }
      setStep(4);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save mappings');
    } finally {
      setSavingMappings(false);
    }
  };

  // ── Step 4 handlers ────────────────────────────────────────────
  const handleActivate = async (active: boolean) => {
    if (!savedId) return;
    setActivating(true);
    try {
      await api.post(`/azure/configs/${savedId}/activate`, null, { params: { active } });
      if (active && runInitialSync) {
        await api.post(`/azure/configs/${savedId}/sync`);
      }
      onSaved();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setActivating(false);
    }
  };

  // ── Missing fields combined ────────────────────────────────────
  const allMissingFields: AzureMissingField[] = [...missingUserFields, ...missingGroupFields];
  const hasMissing = allMissingFields.length > 0;

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

            {/* Filters section */}
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

            {/* Test connection */}
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

              {/* User panel */}
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

              {/* Group panel */}
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

        {/* ── Step 3: AI Field Mapping ── */}
        {step === 3 && (
          <div className="ldap-wizard-body">

            {mappingStatus === 'loading' && (
              <div className="ldap-mapping-loading-card">
                <RefreshCw size={24} className="spin ldap-mapping-loading-spinner" />
                <div className="ldap-mapping-loading-text">
                  <strong>{t('azure_mapping_running')}</strong>
                  <span>{t('azure_step3_intro')}</span>
                </div>
              </div>
            )}

            {mappingStatus === 'error' && (
              <div className="ldap-test-result error">{mappingError}</div>
            )}

            {mappingStatus === 'done' && (
              <>
                <div className="ldap-mapping-toolbar">
                  <div className="ldap-mapping-stats">
                    {userMappings.filter(m => m.systemFieldKey).length > 0 && (
                      <span className="ldap-mapping-stat">
                        <CheckCircle2 size={13} />
                        {userMappings.filter(m => m.systemFieldKey).length} users
                      </span>
                    )}
                    {groupMappings.filter(m => m.systemFieldKey).length > 0 && (
                      <span className="ldap-mapping-stat">
                        <CheckCircle2 size={13} />
                        {groupMappings.filter(m => m.systemFieldKey).length} groups
                      </span>
                    )}
                  </div>
                  <button className="ldap-wizard-btn ldap-wizard-btn-ghost"
                    onClick={handleRerunMapping}
                    style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <RefreshCw size={13} /> {t('azure_remap_btn')}
                  </button>
                </div>

                {hasMissing && (
                  <div className="ldap-missing-banner">
                    <div>
                      <strong>{t('azure_missing_fields_title')}</strong>
                      <p>{t('azure_missing_fields_desc')}</p>
                    </div>
                    {onMissingFields && savedId && (
                      <button className="ldap-wizard-btn ldap-wizard-btn-primary"
                        style={{ fontSize: '0.8rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
                        onClick={() => onMissingFields(savedId, allMissingFields)}>
                        {t('azure_go_create_fields_btn')}
                      </button>
                    )}
                  </div>
                )}

                {userMappings.length > 0 && (
                  <div className="ldap-form-section">
                    <div className="ldap-form-section-title">Users</div>
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
                          {userMappings.map((row, i) => (
                            <tr key={row.azureAttribute}>
                              <td><code className="ldap-attr-code">{row.azureAttribute}</code></td>
                              <td className="ldap-map-sample">{row.sampleValue.substring(0, 35)}</td>
                              <td className="ldap-map-arrow">→</td>
                              <td>
                                <select className="ldap-mapping-select"
                                  value={row.systemFieldKey}
                                  onChange={e => updateUserMapping(i, e.target.value)}>
                                  {userFieldOptions.map(o => (
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
                  </div>
                )}

                {groupMappings.length > 0 && (
                  <div className="ldap-form-section">
                    <div className="ldap-form-section-title">Groups</div>
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
                          {groupMappings.map((row, i) => (
                            <tr key={row.azureAttribute}>
                              <td><code className="ldap-attr-code">{row.azureAttribute}</code></td>
                              <td className="ldap-map-sample">{row.sampleValue.substring(0, 35)}</td>
                              <td className="ldap-map-arrow">→</td>
                              <td>
                                <select className="ldap-mapping-select"
                                  value={row.systemFieldKey}
                                  onChange={e => updateGroupMapping(i, e.target.value)}>
                                  {groupFieldOptions.map(o => (
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
                  </div>
                )}

                {userMappings.length === 0 && groupMappings.length === 0 && (
                  <div className="ldap-sample-placeholder">{t('azure_mapping_running')}</div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Step 4: Confirm & Activate ── */}
        {step === 4 && (
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
                  <div className="ldap-form-th">{t('azure_col_name')} — User mappings</div>
                  <div className="ldap-form-td">
                    <span className="ldap-confirm-text">
                      {userMappings.filter(m => m.systemFieldKey).length} fields mapped
                    </span>
                  </div>
                </div>

                {groupMappings.length > 0 && (
                  <div className="ldap-form-tr">
                    <div className="ldap-form-th">{t('azure_col_name')} — Group mappings</div>
                    <div className="ldap-form-td">
                      <span className="ldap-confirm-text">
                        {groupMappings.filter(m => m.systemFieldKey).length} fields mapped
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </div>

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
            {step > 1 && step < 4 && (
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
                onClick={handleSaveMappings}
                disabled={savingMappings || mappingStatus !== 'done'}>
                {savingMappings ? '…' : t('next_btn')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
