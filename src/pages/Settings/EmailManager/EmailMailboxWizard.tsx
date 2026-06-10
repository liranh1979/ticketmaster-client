import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, XCircle } from 'lucide-react';
import api from '../../../api';
import type { EmailMailbox } from './EmailManager';

interface Props {
  mailbox: EmailMailbox | null;
  onSave: (mb: EmailMailbox) => void;
  onClose: () => void;
}

const DEFAULT: EmailMailbox = {
  displayName: '',
  emailAddress: '',
  protocolType: 'IMAP_SMTP',
  imapPort: 993,
  imapSsl: true,
  smtpPort: 465,
  smtpSsl: true,
  canReceive: true,
  canSend: true,
  isDefaultSender: false,
  isActive: true,
  pollIntervalSeconds: 300,
  aiEnabled: false,
  aiConfidenceThreshold: 60,
  unknownSenderAction: 'ignore',
  ignoreSignature: true,
};

type Step = 1 | 2 | 3;

export const EmailMailboxWizard = ({ mailbox, onSave, onClose }: Props) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<EmailMailbox>(mailbox ? { ...DEFAULT, ...mailbox } : { ...DEFAULT });
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState(false);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [wlInput, setWlInput] = useState('');
  const [blInput, setBlInput] = useState('');
  const [hasAiActive, setHasAiActive] = useState(false);

  useEffect(() => {
    api.get('/ai/status').then(r => setHasAiActive(r.data?.hasActiveAI === true)).catch(() => {});
    if (mailbox?.id) {
      api.get(`/email/mailboxes/${mailbox.id}/filters`).then(r => {
        const wl = r.data.filter((f: any) => f.listType === 'whitelist').map((f: any) => f.emailPattern);
        const bl = r.data.filter((f: any) => f.listType === 'blacklist').map((f: any) => f.emailPattern);
        setWhitelist(wl);
        setBlacklist(bl);
      }).catch(() => {});
    }
  }, [mailbox]);

  const set = (k: keyof EmailMailbox, v: any) => setForm(prev => ({ ...prev, [k]: v }));

  const handleTest = async () => {
    if (!mailbox?.id) return;
    setTesting(true);
    try {
      const r = await api.post(`/email/mailboxes/${mailbox.id}/test`);
      setTestResult(r.data);
    } catch { setTestResult({ success: false, message: 'Request failed' }); }
    finally { setTesting(false); }
  };

  const handleAuthorize = () => {
    if (!mailbox?.id) return;
    const provider = form.protocolType === 'OAUTH2_GMAIL' ? 'gmail' : 'microsoft';
    api.get(`/email/mailboxes/${mailbox.id}/oauth2/authorize?provider=${provider}`)
      .then(r => { window.open(r.data.authUrl, '_blank', 'width=600,height=700'); })
      .catch(() => {});
  };

  const addFilter = (type: 'whitelist' | 'blacklist') => {
    const val = type === 'whitelist' ? wlInput.trim() : blInput.trim();
    if (!val) return;
    if (type === 'whitelist') { setWhitelist(p => [...p, val]); setWlInput(''); }
    else { setBlacklist(p => [...p, val]); setBlInput(''); }
  };

  const removeFilter = (type: 'whitelist' | 'blacklist', pattern: string) => {
    if (type === 'whitelist') setWhitelist(p => p.filter(x => x !== pattern));
    else setBlacklist(p => p.filter(x => x !== pattern));
  };

  const handleSave = async () => {
    const payload = { ...form };
    onSave(payload);

    // Sync filters if editing existing
    if (mailbox?.id) {
      try {
        const existing = await api.get(`/email/mailboxes/${mailbox.id}/filters`);
        for (const f of existing.data) {
          await api.delete(`/email/mailboxes/${mailbox.id}/filters/${f.id}`);
        }
        for (const p of whitelist) {
          await api.post(`/email/mailboxes/${mailbox.id}/filters`, { listType: 'whitelist', emailPattern: p });
        }
        for (const p of blacklist) {
          await api.post(`/email/mailboxes/${mailbox.id}/filters`, { listType: 'blacklist', emailPattern: p });
        }
      } catch { /* ignore filter sync error */ }
    }
  };

  const Toggle = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
    <div className="emw-toggle-row">
      <span className="emw-toggle-label">{label}</span>
      <label className="emw-toggle">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
        <span className="emw-toggle-track" />
        <span className="emw-toggle-thumb" />
      </label>
    </div>
  );

  return (
    <div className="emw-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="emw-drawer">
        {/* Header */}
        <div className="emw-header">
          <span className="emw-title">
            {mailbox ? t('edit_mailbox') : t('add_mailbox')}
          </span>
          <button className="emw-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Step bar */}
        <div className="emw-steps">
          {[1, 2, 3].map(s => (
            <div key={s} className={`emw-step ${step > s ? 'done' : step === s ? 'active' : ''}`}>
              <div className="emw-step-dot">{step > s ? '✓' : s}</div>
              <span className="emw-step-label">
                {s === 1 ? 'Connection' : s === 2 ? 'Settings' : 'Filters'}
              </span>
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="emw-body">
          {/* ── Step 1: Connection ── */}
          {step === 1 && (
            <>
              <div className="emw-field">
                <label className="emw-label">{t('mailbox_display_name')}</label>
                <input className="emw-input" value={form.displayName}
                  onChange={e => set('displayName', e.target.value)} placeholder="e.g. Support Inbox" />
              </div>
              <div className="emw-field">
                <label className="emw-label">{t('mailbox_email_address')}</label>
                <input className="emw-input" type="email" value={form.emailAddress}
                  onChange={e => set('emailAddress', e.target.value)} placeholder="support@company.com" />
              </div>
              <div className="emw-field">
                <label className="emw-label">{t('mailbox_protocol')}</label>
                <select className="emw-select" value={form.protocolType}
                  onChange={e => set('protocolType', e.target.value as EmailMailbox['protocolType'])}>
                  <option value="IMAP_SMTP">{t('protocol_imap_smtp')}</option>
                  <option value="OAUTH2_GMAIL">{t('protocol_oauth2_gmail')}</option>
                  <option value="OAUTH2_MICROSOFT">{t('protocol_oauth2_microsoft')}</option>
                </select>
              </div>

              {/* IMAP/SMTP fields */}
              {form.protocolType === 'IMAP_SMTP' && (
                <>
                  <div className="emw-section">{t('imap_settings')}</div>
                  <div className="emw-row">
                    <div className="emw-field">
                      <label className="emw-label">Host</label>
                      <input className="emw-input" value={form.imapHost ?? ''}
                        onChange={e => set('imapHost', e.target.value)} placeholder="imap.gmail.com" />
                    </div>
                    <div className="emw-field">
                      <label className="emw-label">Port</label>
                      <input className="emw-input" type="number" value={form.imapPort ?? 993}
                        onChange={e => set('imapPort', +e.target.value)} />
                    </div>
                  </div>
                  <Toggle label="SSL/TLS" checked={!!form.imapSsl} onChange={v => set('imapSsl', v)} />

                  <div className="emw-section">{t('smtp_settings')}</div>
                  <div className="emw-row">
                    <div className="emw-field">
                      <label className="emw-label">Host</label>
                      <input className="emw-input" value={form.smtpHost ?? ''}
                        onChange={e => set('smtpHost', e.target.value)} placeholder="smtp.gmail.com" />
                    </div>
                    <div className="emw-field">
                      <label className="emw-label">Port</label>
                      <input className="emw-input" type="number" value={form.smtpPort ?? 465}
                        onChange={e => set('smtpPort', +e.target.value)} />
                    </div>
                  </div>
                  <Toggle label="SSL/TLS" checked={!!form.smtpSsl} onChange={v => set('smtpSsl', v)} />

                  <div className="emw-field">
                    <label className="emw-label">Username</label>
                    <input className="emw-input" value={form.username ?? ''}
                      onChange={e => set('username', e.target.value)} />
                  </div>
                  <div className="emw-field">
                    <label className="emw-label">Password</label>
                    <input className="emw-input" type="password" value={form.password ?? ''}
                      onChange={e => set('password', e.target.value)}
                      placeholder={mailbox?.id ? '(leave blank to keep current)' : ''} />
                  </div>
                </>
              )}

              {/* OAuth2 fields */}
              {(form.protocolType === 'OAUTH2_GMAIL' || form.protocolType === 'OAUTH2_MICROSOFT') && (
                <>
                  <div className="emw-section">{t('oauth2_settings')}</div>
                  <div className="emw-field">
                    <label className="emw-label">{t('oauth2_client_id')}</label>
                    <input className="emw-input" value={form.oauth2ClientId ?? ''}
                      onChange={e => set('oauth2ClientId', e.target.value)} />
                  </div>
                  <div className="emw-field">
                    <label className="emw-label">{t('oauth2_client_secret')}</label>
                    <input className="emw-input" type="password" value={form.oauth2ClientSecret ?? ''}
                      onChange={e => set('oauth2ClientSecret', e.target.value)}
                      placeholder={mailbox?.id ? '(leave blank to keep current)' : ''} />
                  </div>
                  {form.protocolType === 'OAUTH2_MICROSOFT' && (
                    <div className="emw-field">
                      <label className="emw-label">{t('oauth2_tenant_id')}</label>
                      <input className="emw-input" value={form.oauth2TenantId ?? ''}
                        onChange={e => set('oauth2TenantId', e.target.value)} placeholder="common" />
                    </div>
                  )}
                  <div>
                    {form.oauth2Authorized
                      ? <span className="emw-authorized-badge">✓ {t('authorized_label')}</span>
                      : (
                        <button className="emw-authorize-btn" onClick={handleAuthorize}
                          disabled={!mailbox?.id}>
                          {t('authorize_btn')}
                          {!mailbox?.id && <span style={{ marginLeft: 6, fontSize: 11 }}>(save first)</span>}
                        </button>
                      )}
                  </div>
                </>
              )}

              {/* Test connection */}
              {mailbox?.id && (
                <div className="emw-test-row">
                  <button className="emw-test-btn" onClick={handleTest} disabled={testing}>
                    {testing ? 'Testing...' : t('test_connection_btn')}
                  </button>
                  {testResult && (
                    <span className={`emw-test-result ${testResult.success ? 'ok' : 'fail'}`}>
                      {testResult.success ? <CheckCircle size={12} /> : <XCircle size={12} />}
                      {testResult.message}
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Processing Settings ── */}
          {step === 2 && (
            <>
              <Toggle label={t('can_receive_label')} checked={!!form.canReceive}
                onChange={v => set('canReceive', v)} />
              <Toggle label={t('can_send_label')} checked={!!form.canSend}
                onChange={v => set('canSend', v)} />
              <Toggle label={t('is_default_sender_label')} checked={!!form.isDefaultSender}
                onChange={v => set('isDefaultSender', v)} />

              <div className="emw-field">
                <label className="emw-label">{t('poll_interval_label')}</label>
                <input className="emw-input" type="number" min={60} value={form.pollIntervalSeconds ?? 300}
                  onChange={e => set('pollIntervalSeconds', +e.target.value)} />
              </div>

              <div className="emw-field">
                <label className="emw-label">Unknown sender</label>
                <div className="emw-radio-group">
                  <label className="emw-radio-label">
                    <input type="radio" name="unk" value="create_user"
                      checked={form.unknownSenderAction === 'create_user'}
                      onChange={() => set('unknownSenderAction', 'create_user')} />
                    {t('unknown_sender_create')}
                  </label>
                  <label className="emw-radio-label">
                    <input type="radio" name="unk" value="ignore"
                      checked={form.unknownSenderAction === 'ignore'}
                      onChange={() => set('unknownSenderAction', 'ignore')} />
                    {t('unknown_sender_ignore')}
                  </label>
                </div>
              </div>

              {hasAiActive && (
                <>
                  <Toggle label={t('ai_enabled_label')} checked={!!form.aiEnabled}
                    onChange={v => set('aiEnabled', v)} />
                  {form.aiEnabled && (
                    <div className="emw-field">
                      <label className="emw-label">
                        {t('ai_confidence_label')}: {form.aiConfidenceThreshold}%
                      </label>
                      <input className="emw-slider" type="range" min={0} max={100}
                        value={form.aiConfidenceThreshold ?? 60}
                        onChange={e => set('aiConfidenceThreshold', +e.target.value)} />
                    </div>
                  )}
                </>
              )}

              <Toggle label={t('ignore_signature_label')} checked={!!form.ignoreSignature}
                onChange={v => set('ignoreSignature', v)} />
              <Toggle label="Active" checked={!!form.isActive}
                onChange={v => set('isActive', v)} />
            </>
          )}

          {/* ── Step 3: Filters ── */}
          {step === 3 && (
            <>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                {t('email_filters_title')} — if whitelist has entries, only those senders create tickets.
              </p>
              <div className="emw-filters-row">
                <div className="emw-filter-col">
                  <h4>✅ {t('filter_whitelist_label')}</h4>
                  <div className="emw-filter-input-row">
                    <input className="emw-input" value={wlInput} onChange={e => setWlInput(e.target.value)}
                      placeholder={t('filter_pattern_hint')}
                      onKeyDown={e => e.key === 'Enter' && addFilter('whitelist')} />
                    <button className="emw-filter-add-btn" onClick={() => addFilter('whitelist')}>Add</button>
                  </div>
                  <div className="emw-chips">
                    {whitelist.map(p => (
                      <span key={p} className="emw-chip">
                        {p}
                        <button className="emw-chip-remove" onClick={() => removeFilter('whitelist', p)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div className="emw-filter-col">
                  <h4>🚫 {t('filter_blacklist_label')}</h4>
                  <div className="emw-filter-input-row">
                    <input className="emw-input" value={blInput} onChange={e => setBlInput(e.target.value)}
                      placeholder={t('filter_pattern_hint')}
                      onKeyDown={e => e.key === 'Enter' && addFilter('blacklist')} />
                    <button className="emw-filter-add-btn" onClick={() => addFilter('blacklist')}>Add</button>
                  </div>
                  <div className="emw-chips">
                    {blacklist.map(p => (
                      <span key={p} className="emw-chip">
                        {p}
                        <button className="emw-chip-remove" onClick={() => removeFilter('blacklist', p)}>×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="emw-footer">
          {step > 1
            ? <button className="emw-btn emw-btn-secondary" onClick={() => setStep(s => (s - 1) as Step)}>
                ← Back
              </button>
            : <button className="emw-btn emw-btn-secondary" onClick={onClose}>Cancel</button>
          }
          {step < 3
            ? <button className="emw-btn emw-btn-primary" onClick={() => setStep(s => (s + 1) as Step)}>
                Next →
              </button>
            : <button className="emw-btn emw-btn-primary" onClick={handleSave}>
                Save Mailbox
              </button>
          }
        </div>
      </div>
    </div>
  );
};
