import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, RefreshCw, CheckCircle2 } from 'lucide-react';
import api from '../../../api';
import './LdapPage.css';

// ── Types ─────────────────────────────────────────────────────────
interface LdapConfig {
  display_name: string; host: string; port: number; use_ssl: boolean;
  bind_dn: string; bind_password: string; base_dn_users: string;
  base_dn_groups: string; user_filter: string; group_filter: string; is_active: boolean;
}

interface MappingRow {
  ldapAttribute: string; sampleValue: string; systemFieldKey: string; confidence: string;
}

interface FieldOption { key: string; label: string; }

export interface MissingField {
  ldapAttribute: string; suggestedFieldKey: string; suggestedLabel: string; suggestedFieldType: string;
}

interface Props {
  configId?: number;
  onClose: () => void;
  onSaved: () => void;
  onMissingFields?: (configId: number, suggestions: MissingField[]) => void;
  initialStep?: number;
}

// ── Constants ─────────────────────────────────────────────────────
const STEPS = ['ldap_step_connection', 'ldap_step_sample', 'ldap_step_mapping', 'ldap_step_confirm'];

const defaultForm = (): LdapConfig => ({
  display_name: '', host: '', port: 389, use_ssl: false,
  bind_dn: '', bind_password: '', base_dn_users: '', base_dn_groups: '',
  user_filter: '(objectClass=person)', group_filter: '(objectClass=group)', is_active: false,
});

const formatKey = (k: string) =>
  k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const domainToDc = (d: string) =>
  d.split('.').filter(Boolean).map(p => `DC=${p}`).join(',');

const parseBindDn = (bindDn: string): { domain: string; username: string } => {
  if (!bindDn) return { domain: '', username: '' };
  const cnMatch = bindDn.match(/^cn=([^,]+)/i);
  const dcParts = [...bindDn.matchAll(/dc=([^,]+)/gi)].map(m => m[1]);
  if (cnMatch && dcParts.length > 0) {
    return { username: cnMatch[1], domain: dcParts.join('.') };
  }
  return { domain: '', username: bindDn };
};

const SKIP_OPTION: FieldOption = { key: '', label: '— skip —' };

// ── Component ─────────────────────────────────────────────────────
export const LdapWizard = ({ configId, onClose, onSaved, onMissingFields, initialStep }: Props) => {
  const { t } = useTranslation();
  const isEdit = configId != null;

  // Step 1
  const [step, setStep] = useState(initialStep ?? 1);
  const [form, setForm] = useState<LdapConfig>(defaultForm());
  const [savedId, setSavedId] = useState<number | undefined>(configId);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [domain, setDomain] = useState('');
  const [username, setUsername] = useState('');

  // Step 2
  const [sampleUser, setSampleUser] = useState<Record<string, string> | null>(null);
  const [sampleGroup, setSampleGroup] = useState<Record<string, string> | null>(null);
  const [sampleUserError, setSampleUserError] = useState<string | null>(null);
  const [sampleGroupError, setSampleGroupError] = useState<string | null>(null);
  const [fetchingUser, setFetchingUser] = useState(false);
  const [fetchingGroup, setFetchingGroup] = useState(false);

  const hasGroups = !!form.base_dn_groups?.trim();

  // Step 3
  const [userMappings, setUserMappings] = useState<MappingRow[]>([]);
  const [groupMappings, setGroupMappings] = useState<MappingRow[]>([]);
  const [missingUserFields, setMissingUserFields] = useState<MissingField[]>([]);
  const [missingGroupFields, setMissingGroupFields] = useState<MissingField[]>([]);
  const [mappingStatus, setMappingStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [mappingError, setMappingError] = useState('');
  const [userFieldOptions, setUserFieldOptions] = useState<FieldOption[]>([]);
  const [groupFieldOptions, setGroupFieldOptions] = useState<FieldOption[]>([]);
  const [savingMappings, setSavingMappings] = useState(false);

  // Step 4
  const [runInitialSync, setRunInitialSync]   = useState(true);
  const [syncCompanyId, setSyncCompanyId]     = useState<number | null>(null);
  const [companies, setCompanies]             = useState<{ id: number; name: string }[]>([]);
  const [activating, setActivating] = useState(false);

  // Load existing config data whenever the wizard opens in edit mode
  useEffect(() => {
    if (!configId) return;
    api.get('/ldap/configs').then((res: any) => {
      const cfg = res.data.find((c: any) => c.id === configId);
      if (!cfg) return;
      setForm(prev => ({
        ...prev,
        display_name:   cfg.display_name   ?? prev.display_name,
        host:           cfg.host           ?? prev.host,
        port:           cfg.port           ?? prev.port,
        use_ssl:        cfg.use_ssl        ?? prev.use_ssl,
        base_dn_users:  cfg.base_dn_users  ?? prev.base_dn_users,
        base_dn_groups: cfg.base_dn_groups ?? prev.base_dn_groups,
        user_filter:    cfg.user_filter    ?? prev.user_filter,
        group_filter:   cfg.group_filter   ?? prev.group_filter,
      }));
      if (cfg.bind_dn) {
        const { domain: d, username: u } = parseBindDn(cfg.bind_dn);
        setDomain(d);
        setUsername(u);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line

  // ── Helpers ────────────────────────────────────────────────────
  const set = (field: keyof LdapConfig, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const buildBindDn = (): string => {
    if (!username) return '';
    // Already a full DN or UPN — use as-is
    if (username.includes('@') || username.toLowerCase().includes('cn=') || username.toLowerCase().includes('dc=')) return username;
    // Standard LDAP DN format — works for both OpenLDAP and Active Directory
    return domain ? `cn=${username},${domainToDc(domain).toLowerCase()}` : username;
  };

  const handleDomainChange = (d: string) => {
    const prevDc = domain ? domainToDc(domain) : '';
    setDomain(d);
    if (d) {
      const newDc = domainToDc(d);
      setForm(prev => ({
        ...prev,
        // Only auto-update if the field is empty OR still equals the last auto-computed value
        // (i.e. the user hasn't manually edited it)
        base_dn_users: !prev.base_dn_users || prev.base_dn_users.toLowerCase() === prevDc.toLowerCase()
          ? newDc : prev.base_dn_users,
        base_dn_groups: !prev.base_dn_groups || prev.base_dn_groups.toLowerCase() === prevDc.toLowerCase()
          ? newDc : prev.base_dn_groups,
      }));
    }
  };

  const stepStatus = (n: number) => n < step ? 'done' : n === step ? 'active' : '';

  const updateUserMapping = (idx: number, key: string) =>
    setUserMappings(prev => prev.map((r, i) => i === idx ? { ...r, systemFieldKey: key } : r));

  const updateGroupMapping = (idx: number, key: string) =>
    setGroupMappings(prev => prev.map((r, i) => i === idx ? { ...r, systemFieldKey: key } : r));

  // ── Step 1 handlers ────────────────────────────────────────────
  const handleStep1Next = async () => {
    setSaving(true);
    try {
      const payload = { ...form, bind_dn: buildBindDn() };
      let id = savedId;
      if (!id) {
        const res = await api.post('/ldap/configs', payload);
        id = res.data.id;
        setSavedId(id);
      } else {
        await api.patch(`/ldap/configs/${id}`, payload);
      }
      setStep(2);
    } catch (err: any) {
      alert(err.response?.data?.message || t('ldap_connection_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleTestRaw = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/ldap/configs/test', { ...form, bind_dn: buildBindDn() });
      setTestResult({ ok: res.data.success, message: res.data.message });
    } catch (err: any) {
      setTestResult({ ok: false, message: err.response?.data?.message || t('ldap_connection_failed') });
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
      const res = await api.get(`/ldap/configs/${savedId}/sample-user`);
      if (res.data.error) {
        setSampleUserError(res.data.error);
        setSampleUser({});
      } else {
        setSampleUser(res.data.attributes || {});
      }
    } catch (err: any) {
      setSampleUserError(err.response?.data?.message || t('ldap_connection_failed'));
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
      const res = await api.get(`/ldap/configs/${savedId}/sample-group`);
      if (res.data.error) {
        setSampleGroupError(res.data.error);
        setSampleGroup({});
      } else {
        setSampleGroup(res.data.attributes || {});
      }
    } catch (err: any) {
      setSampleGroupError(err.response?.data?.message || t('ldap_connection_failed'));
      setSampleGroup({});
    } finally {
      setFetchingGroup(false);
    }
  };

  // ── Step 3 handlers ────────────────────────────────────────────
  const buildOptions = async (entityType: 'user' | 'group'): Promise<FieldOption[]> => {
    try {
      const translationType = entityType === 'user' ? 'user_fields' : 'group_fields';
      const [fieldsRes, labelsRes] = await Promise.all([
        api.get('/field-definitions', { params: { entityType } }),
        api.get('/field-definitions/translations/en', { params: { translationType } }),
      ]);
      const labels: Record<string, string> = labelsRes.data;
      const custom = (fieldsRes.data as any[]).map((f: any) => ({
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

  const initMappingStep = async () => {
    if (!savedId) return;
    const [uOpts, gOpts] = await Promise.all([buildOptions('user'), buildOptions('group')]);
    setUserFieldOptions(uOpts);
    setGroupFieldOptions(gOpts);

    const uRows: MappingRow[] = Object.entries(sampleUser || {}).map(([attr, val]) => ({
      ldapAttribute: attr, sampleValue: String(val), systemFieldKey: '', confidence: '',
    }));
    const gRows: MappingRow[] = Object.entries(sampleGroup || {}).map(([attr, val]) => ({
      ldapAttribute: attr, sampleValue: String(val), systemFieldKey: '', confidence: '',
    }));

    try {
      const [uSaved, gSaved] = await Promise.all([
        api.get(`/ldap/configs/${savedId}/mappings`, { params: { entityType: 'user' } }),
        api.get(`/ldap/configs/${savedId}/mappings`, { params: { entityType: 'group' } }),
      ]);
      (uSaved.data || []).forEach((m: any) => {
        const row = uRows.find(r => r.ldapAttribute === (m.ldapAttribute || m.ldap_attribute));
        if (row) row.systemFieldKey = m.systemFieldKey || m.system_field_key || '';
      });
      (gSaved.data || []).forEach((m: any) => {
        const row = gRows.find(r => r.ldapAttribute === (m.ldapAttribute || m.ldap_attribute));
        if (row) row.systemFieldKey = m.systemFieldKey || m.system_field_key || '';
      });
    } catch { /* start with empty mappings if load fails */ }

    setUserMappings(uRows);
    setGroupMappings(gRows);
  };

  useEffect(() => {
    if (step === 3 && savedId) initMappingStep();
    if (step === 4) {
      api.get<{ id: number; name: string }[]>('/companies').then(r => setCompanies(r.data)).catch(() => {});
    }
  }, [step]); // eslint-disable-line

  const doRunMapping = async () => {
    if (!savedId) return;
    setMappingStatus('loading');
    setMappingError('');

    try {
      const userRes = await api.post(`/ldap/configs/${savedId}/suggest-mapping`, null, {
        params: { entityType: 'user' },
      });

      if (userRes.data.error) {
        setMappingError(userRes.data.error);
        setMappingStatus('error');
        return;
      }

      setUserMappings(prev => {
        const next = prev.map(r => ({ ...r }));
        (userRes.data.mappings || []).forEach((m: any) => {
          const row = next.find(r => r.ldapAttribute === m.ldapAttribute);
          if (row) { row.systemFieldKey = m.systemFieldKey || ''; row.confidence = m.confidence || ''; }
        });
        return next;
      });
      setMissingUserFields(userRes.data.missingFields || []);

      if (hasGroups && sampleGroup && Object.keys(sampleGroup).length > 0) {
        try {
          const groupRes = await api.post(`/ldap/configs/${savedId}/suggest-mapping`, null, {
            params: { entityType: 'group' },
          });
          setGroupMappings(prev => {
            const next = prev.map(r => ({ ...r }));
            (groupRes.data.mappings || []).forEach((m: any) => {
              const row = next.find(r => r.ldapAttribute === m.ldapAttribute);
              if (row) { row.systemFieldKey = m.systemFieldKey || ''; row.confidence = m.confidence || ''; }
            });
            return next;
          });
          setMissingGroupFields(groupRes.data.missingFields || []);
        } catch { /* group mapping failure is non-fatal */ }
      }

      setMappingStatus('done');
    } catch (err: any) {
      setMappingError(err.response?.data?.message || 'AI mapping failed');
      setMappingStatus('error');
    }
  };

  const handleSaveMappings = async () => {
    if (!savedId) return;
    setSavingMappings(true);
    try {
      await api.post(`/ldap/configs/${savedId}/mappings`, {
        entity_type: 'user',
        mappings: userMappings.map(m => ({ ldap_attribute: m.ldapAttribute, system_field_key: m.systemFieldKey })),
      });
      if (groupMappings.length > 0) {
        await api.post(`/ldap/configs/${savedId}/mappings`, {
          entity_type: 'group',
          mappings: groupMappings.map(m => ({ ldap_attribute: m.ldapAttribute, system_field_key: m.systemFieldKey })),
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
      await api.post(`/ldap/configs/${savedId}/activate`, null, { params: { active } });
      if (active && runInitialSync) {
        await api.post(`/ldap/configs/${savedId}/sync`, null,
          syncCompanyId ? { params: { companyId: syncCompanyId } } : undefined);
      }
      onSaved();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to save configuration');
    } finally {
      setActivating(false);
    }
  };

  // ── Missing fields combined ────────────────────────────────────
  const allMissingFields = [...missingUserFields, ...missingGroupFields];
  const hasMissing = allMissingFields.length > 0;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="ldap-wizard-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ldap-wizard-panel">

        {/* Header */}
        <div className="ldap-wizard-header">
          <h2 className="ldap-wizard-title">
            {isEdit ? t('ldap_wizard_title_edit') : t('ldap_wizard_title_new')}
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

            {/* Section: Connection */}
            <div className="ldap-form-section">
              <div className="ldap-form-section-title">{t('ldap_step_connection')}</div>
              <div className="ldap-form-table">

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_display_name')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi" value={form.display_name}
                      onChange={e => set('display_name', e.target.value)} />
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_host')}</div>
                  <div className="ldap-form-td">
                    <div className="ldap-fi-group">
                      <input className="ldap-fi" style={{ flex: 1 }}
                        value={form.host} placeholder="ldap.company.com"
                        onChange={e => set('host', e.target.value)} />
                      <span className="ldap-fi-sep">:</span>
                      <input className="ldap-fi ldap-fi-port" type="number"
                        value={form.port}
                        onChange={e => set('port', parseInt(e.target.value) || 389)} />
                    </div>
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_use_ssl')}</div>
                  <div className="ldap-form-td">
                    <label className="ldap-fi-checkbox">
                      <input type="checkbox" checked={form.use_ssl}
                        onChange={e => set('use_ssl', e.target.checked)} />
                      <span>LDAPS<span className="ldap-fi-checkbox-hint">(port 636)</span></span>
                    </label>
                  </div>
                </div>

              </div>
            </div>

            {/* Section: Authentication */}
            <div className="ldap-form-section">
              <div className="ldap-form-section-title">{t('ldap_section_auth')}</div>
              <div className="ldap-form-table">

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_domain')}</div>
                  <div className="ldap-form-td" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 5 }}>
                    <input className="ldap-fi" value={domain}
                      placeholder={t('ldap_field_domain_hint')}
                      onChange={e => handleDomainChange(e.target.value)} />
                    <span className="ldap-fi-hint">{t('ldap_field_domain_desc')}</span>
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_username')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi" value={username}
                      placeholder={isEdit ? t('ldap_bind_pw_placeholder') : t('ldap_field_username_hint')}
                      onChange={e => setUsername(e.target.value)} />
                  </div>
                </div>

                {buildBindDn() && (
                  <div className="ldap-form-tr">
                    <div className="ldap-form-th ldap-form-th-muted">{t('ldap_bind_dn_computed')}</div>
                    <div className="ldap-form-td">
                      <code className="ldap-dn-preview">{buildBindDn()}</code>
                    </div>
                  </div>
                )}

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_bind_password')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi" type="password" value={form.bind_password}
                      onChange={e => set('bind_password', e.target.value)}
                      placeholder={isEdit ? t('ldap_bind_pw_placeholder') : ''} />
                  </div>
                </div>

              </div>
            </div>

            {/* Section: Search Base */}
            <div className="ldap-form-section">
              <div className="ldap-form-section-title">{t('ldap_section_search_base')}</div>
              <div className="ldap-form-table">

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_base_dn_users')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi ldap-fi-mono" value={form.base_dn_users}
                      onChange={e => set('base_dn_users', e.target.value)} />
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_base_dn_groups')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi ldap-fi-mono" value={form.base_dn_groups}
                      onChange={e => set('base_dn_groups', e.target.value)} />
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_user_filter')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi ldap-fi-mono" value={form.user_filter}
                      onChange={e => set('user_filter', e.target.value)} />
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_group_filter')}</div>
                  <div className="ldap-form-td">
                    <input className="ldap-fi ldap-fi-mono" value={form.group_filter}
                      onChange={e => set('group_filter', e.target.value)} />
                  </div>
                </div>

              </div>
            </div>

            {/* Test connection */}
            <div className="ldap-test-row">
              <button className="ldap-wizard-btn ldap-wizard-btn-ghost"
                onClick={handleTestRaw} disabled={testing || !form.host || (!isEdit && !username)}>
                {testing ? '…' : t('ldap_test_connection_btn')}
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
            <p className="ldap-step-intro">{t('ldap_step2_intro')}</p>
            <div className="ldap-sample-panels">

              {/* User panel */}
              <div className="ldap-sample-panel ldap-sample-panel-user">
                <div className="ldap-sample-panel-header">
                  <div className="ldap-sample-panel-meta">
                    <span className="ldap-sample-panel-title">{t('ldap_sample_user_title')}</span>
                    {sampleUser && Object.keys(sampleUser).length > 0 && (
                      <span className="ldap-sample-count-badge">{Object.keys(sampleUser).length}</span>
                    )}
                  </div>
                  <button className="ldap-sample-btn" onClick={fetchSampleUser} disabled={fetchingUser}>
                    <RefreshCw size={12} className={fetchingUser ? 'spin' : ''} />
                    {fetchingUser ? '…' : t('ldap_fetch_sample_btn')}
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
                    <div className="ldap-sample-placeholder">{t('ldap_no_sample_yet')}</div>
                  ) : Object.keys(sampleUser).length === 0 ? (
                    <div className="ldap-sample-placeholder ldap-sample-placeholder-warn">{t('ldap_no_users_in_dn')}</div>
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
                    <span className="ldap-sample-panel-title">{t('ldap_sample_group_title')}</span>
                    {sampleGroup && Object.keys(sampleGroup).length > 0 && (
                      <span className="ldap-sample-count-badge ldap-sample-count-badge-group">{Object.keys(sampleGroup).length}</span>
                    )}
                  </div>
                  {hasGroups && (
                    <button className="ldap-sample-btn" onClick={fetchSampleGroup} disabled={fetchingGroup}>
                      <RefreshCw size={12} className={fetchingGroup ? 'spin' : ''} />
                      {fetchingGroup ? '…' : t('ldap_fetch_sample_group_btn')}
                    </button>
                  )}
                </div>
                <div className="ldap-sample-body">
                  {!hasGroups ? (
                    <div className="ldap-sample-placeholder ldap-sample-placeholder-muted">{t('ldap_no_group_base_dn')}</div>
                  ) : fetchingGroup ? (
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
                    <div className="ldap-sample-placeholder">{t('ldap_no_sample_yet')}</div>
                  ) : Object.keys(sampleGroup).length === 0 ? (
                    <div className="ldap-sample-placeholder ldap-sample-placeholder-warn">{t('ldap_no_groups_in_dn')}</div>
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

        {/* ── Step 3: Field Mapping ── */}
        {step === 3 && (
          <div className="ldap-wizard-body">

            {/* Toolbar: always visible */}
            <div className="ldap-mapping-toolbar">
              <div className="ldap-mapping-stats">
                {userMappings.filter(m => m.systemFieldKey).length > 0 && (
                  <span className="ldap-mapping-stat">
                    <CheckCircle2 size={13} />
                    {userMappings.filter(m => m.systemFieldKey).length} {t('ldap_section_users').toLowerCase()}
                  </span>
                )}
                {groupMappings.filter(m => m.systemFieldKey).length > 0 && (
                  <span className="ldap-mapping-stat">
                    <CheckCircle2 size={13} />
                    {groupMappings.filter(m => m.systemFieldKey).length} {t('ldap_section_groups').toLowerCase()}
                  </span>
                )}
              </div>
              <button className="ldap-wizard-btn ldap-wizard-btn-ghost"
                onClick={doRunMapping}
                disabled={mappingStatus === 'loading'}
                style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <RefreshCw size={13} className={mappingStatus === 'loading' ? 'spin' : ''} />
                {mappingStatus === 'loading' ? '…' : t('ldap_run_mapping_btn')}
              </button>
            </div>

            {mappingStatus === 'error' && (
              <div className="ldap-test-result error">{mappingError}</div>
            )}

            {/* Missing fields banner - only shown after AI runs */}
            {mappingStatus === 'done' && hasMissing && (
              <div className="ldap-missing-banner">
                <div>
                  <strong>{t('ldap_missing_fields_title')}</strong>
                  <p>{t('ldap_missing_fields_desc')}</p>
                </div>
                {onMissingFields && savedId && (
                  <button className="ldap-wizard-btn ldap-wizard-btn-primary"
                    style={{ fontSize: '0.8rem', padding: '7px 14px', whiteSpace: 'nowrap' }}
                    onClick={() => onMissingFields(savedId, allMissingFields)}>
                    {t('ldap_go_create_fields_btn')}
                  </button>
                )}
              </div>
            )}

            {/* User mappings - always visible once rows are loaded */}
            {userMappings.length > 0 && (
              <div className="ldap-form-section">
                <div className="ldap-form-section-title">{t('ldap_section_users')}</div>
                <div className="ldap-mapping-card">
                  <table className="ldap-mapping-table">
                    <thead>
                      <tr>
                        <th>{t('ldap_mapping_ldap_attr')}</th>
                        <th>{t('ldap_sample_col')}</th>
                        <th></th>
                        <th>{t('ldap_mapping_system_field')}</th>
                        <th>{t('ldap_mapping_confidence')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userMappings.map((row, i) => (
                        <tr key={row.ldapAttribute}>
                          <td><code className="ldap-attr-code">{row.ldapAttribute}</code></td>
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

            {/* Group mappings */}
            {groupMappings.length > 0 && (
              <div className="ldap-form-section">
                <div className="ldap-form-section-title">{t('ldap_section_groups')}</div>
                <div className="ldap-mapping-card">
                  <table className="ldap-mapping-table">
                    <thead>
                      <tr>
                        <th>{t('ldap_mapping_ldap_attr')}</th>
                        <th>{t('ldap_sample_col')}</th>
                        <th></th>
                        <th>{t('ldap_mapping_system_field')}</th>
                        <th>{t('ldap_mapping_confidence')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupMappings.map((row, i) => (
                        <tr key={row.ldapAttribute}>
                          <td><code className="ldap-attr-code">{row.ldapAttribute}</code></td>
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
              <div className="ldap-sample-placeholder">{t('ldap_step3_intro')}</div>
            )}
          </div>
        )}

        {/* ── Step 4: Confirm & Activate ── */}
        {step === 4 && (
          <div className="ldap-wizard-body">

            {/* Ready banner */}
            <div className="ldap-confirm-ready">
              <CheckCircle2 size={28} className="ldap-confirm-ready-icon" />
              <div>
                <div className="ldap-confirm-ready-title">{t('ldap_step4_ready')}</div>
                <div className="ldap-confirm-ready-sub">{t('ldap_step4_intro')}</div>
              </div>
            </div>

            {/* Summary table */}
            <div className="ldap-form-section">
              <div className="ldap-form-section-title">{t('ldap_step_confirm')}</div>
              <div className="ldap-form-table">

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_field_display_name')}</div>
                  <div className="ldap-form-td">
                    <span className="ldap-confirm-text">{form.display_name}</span>
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_confirm_host')}</div>
                  <div className="ldap-form-td" style={{ gap: 10 }}>
                    <code className="ldap-dn-preview" style={{ flex: 1 }}>
                      {form.use_ssl ? 'ldaps' : 'ldap'}://{form.host}:{form.port}
                    </code>
                    <span className={`ldap-proto-badge${form.use_ssl ? ' ldap-proto-ssl' : ''}`}>
                      {form.use_ssl ? 'LDAPS' : 'LDAP'}
                    </span>
                  </div>
                </div>

                <div className="ldap-form-tr">
                  <div className="ldap-form-th">{t('ldap_confirm_user_mappings')}</div>
                  <div className="ldap-form-td">
                    <span className="ldap-confirm-text">
                      {t('ldap_fields_mapped', { count: userMappings.filter(m => m.systemFieldKey).length })}
                    </span>
                  </div>
                </div>

                {groupMappings.length > 0 && (
                  <div className="ldap-form-tr">
                    <div className="ldap-form-th">{t('ldap_confirm_group_mappings')}</div>
                    <div className="ldap-form-td">
                      <span className="ldap-confirm-text">
                        {t('ldap_fields_mapped', { count: groupMappings.filter(m => m.systemFieldKey).length })}
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

            {/* Sync option */}
            <label className="ldap-sync-card">
              <input type="checkbox" className="ldap-sync-checkbox"
                checked={runInitialSync} onChange={e => setRunInitialSync(e.target.checked)} />
              <div className="ldap-sync-card-info">
                <div className="ldap-sync-card-title">{t('ldap_sync_option_title')}</div>
                <div className="ldap-sync-card-desc">{t('ldap_sync_option_desc')}</div>
              </div>
            </label>

            {/* Actions */}
            <div className="ldap-confirm-actions">
              <button className="ldap-wizard-btn ldap-wizard-btn-primary ldap-btn-full"
                onClick={() => handleActivate(true)} disabled={activating}>
                {activating ? '…' : t('ldap_save_config_btn')}
              </button>
              <button className="ldap-wizard-btn ldap-wizard-btn-secondary ldap-btn-full"
                onClick={() => handleActivate(false)} disabled={activating}>
                {t('ldap_save_draft_btn')}
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
                disabled={saving || !form.display_name || !form.host || (!isEdit && !username) || !form.base_dn_users}>
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
                disabled={savingMappings || mappingStatus === 'loading'}>
                {savingMappings ? '…' : t('next_btn')}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
