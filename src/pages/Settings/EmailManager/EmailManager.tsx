import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { PlusCircle, Trash2, TestTube2, Star, Edit2, CheckCircle, XCircle } from 'lucide-react';
import api from '../../../api';
import { EmailMailboxWizard } from './EmailMailboxWizard';
import './EmailManager.css';

export interface EmailMailbox {
  id?: number;
  displayName: string;
  emailAddress: string;
  protocolType: 'IMAP_SMTP' | 'OAUTH2_GMAIL' | 'OAUTH2_MICROSOFT';
  imapHost?: string;
  imapPort?: number;
  imapSsl?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpSsl?: boolean;
  username?: string;
  password?: string;
  oauth2ClientId?: string;
  oauth2ClientSecret?: string;
  oauth2TenantId?: string;
  oauth2Authorized?: boolean;
  canReceive?: boolean;
  canSend?: boolean;
  isDefaultSender?: boolean;
  isActive?: boolean;
  pollIntervalSeconds?: number;
  aiEnabled?: boolean;
  aiConfidenceThreshold?: number;
  unknownSenderAction?: 'create_user' | 'ignore';
  ignoreSignature?: boolean;
  lastCheckedAt?: string;
}

export const EmailManager = () => {
  const { t } = useTranslation();
  const [mailboxes, setMailboxes] = useState<EmailMailbox[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingMailbox, setEditingMailbox] = useState<EmailMailbox | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string }>>({});
  const [testing, setTesting] = useState<Record<number, boolean>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const res = await api.get('/email/mailboxes');
      setMailboxes(res.data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleSave = async (mailbox: EmailMailbox) => {
    try {
      if (mailbox.id) {
        await api.patch(`/email/mailboxes/${mailbox.id}`, mailbox);
      } else {
        await api.post('/email/mailboxes', mailbox);
      }
      setWizardOpen(false);
      setEditingMailbox(null);
      load();
    } catch (e) {
      console.error('Save failed', e);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this mailbox?')) return;
    try {
      await api.delete(`/email/mailboxes/${id}`);
      load();
    } catch { /* ignore */ }
  };

  const handleTest = async (id: number) => {
    setTesting(prev => ({ ...prev, [id]: true }));
    try {
      const res = await api.post(`/email/mailboxes/${id}/test`);
      setTestResults(prev => ({ ...prev, [id]: res.data }));
    } catch {
      setTestResults(prev => ({ ...prev, [id]: { success: false, message: 'Request failed' } }));
    } finally {
      setTesting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await api.post(`/email/mailboxes/${id}/set-default`);
      load();
    } catch { /* ignore */ }
  };

  const protocolLabel = (p: string) => {
    if (p === 'IMAP_SMTP') return 'IMAP/SMTP';
    if (p === 'OAUTH2_GMAIL') return 'Gmail OAuth2';
    if (p === 'OAUTH2_MICROSOFT') return 'Microsoft OAuth2';
    return p;
  };

  return (
    <div className="em-container">
      <div className="em-header">
        <div>
          <h2 className="em-title">✉️ {t('settings_email_manager')}</h2>
          <p className="em-subtitle">{t('email_manager_desc')}</p>
        </div>
        <button className="em-add-btn" onClick={() => { setEditingMailbox(null); setWizardOpen(true); }}>
          <PlusCircle size={14} /> {t('add_mailbox')}
        </button>
      </div>

      {loading ? (
        <div className="em-loading">Loading...</div>
      ) : mailboxes.length === 0 ? (
        <div className="em-empty">{t('no_mailboxes_yet')}</div>
      ) : (
        <div className="em-table-wrapper">
          <table className="em-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Protocol</th>
                <th>Status</th>
                <th>Last Checked</th>
                <th>Recv</th>
                <th>Send</th>
                <th>Default</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mailboxes.map(mb => (
                <tr key={mb.id}>
                  <td className="em-name-cell">{mb.displayName}</td>
                  <td className="em-email-cell">{mb.emailAddress}</td>
                  <td><span className="em-proto-badge">{protocolLabel(mb.protocolType)}</span></td>
                  <td>
                    <span className={`em-status-badge ${mb.isActive ? 'active' : 'inactive'}`}>
                      {mb.isActive ? t('mailbox_status_active') : t('mailbox_status_inactive')}
                    </span>
                  </td>
                  <td className="em-time-cell">
                    {mb.lastCheckedAt ? new Date(mb.lastCheckedAt).toLocaleString() : '—'}
                  </td>
                  <td>{mb.canReceive ? '✓' : '—'}</td>
                  <td>{mb.canSend ? '✓' : '—'}</td>
                  <td>{mb.isDefaultSender ? <Star size={14} className="em-star" /> : '—'}</td>
                  <td>
                    <div className="em-actions">
                      <button className="em-action-btn" title="Edit"
                        onClick={() => { setEditingMailbox(mb); setWizardOpen(true); }}>
                        <Edit2 size={13} />
                      </button>
                      <button className="em-action-btn" title="Test"
                        onClick={() => handleTest(mb.id!)}
                        disabled={testing[mb.id!]}>
                        <TestTube2 size={13} />
                      </button>
                      {!mb.isDefaultSender && (
                        <button className="em-action-btn" title="Set as default"
                          onClick={() => handleSetDefault(mb.id!)}>
                          <Star size={13} />
                        </button>
                      )}
                      <button className="em-action-btn danger" title="Delete"
                        onClick={() => handleDelete(mb.id!)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                    {testResults[mb.id!] && (
                      <div className={`em-test-result ${testResults[mb.id!].success ? 'ok' : 'fail'}`}>
                        {testResults[mb.id!].success
                          ? <CheckCircle size={11} />
                          : <XCircle size={11} />}
                        {testResults[mb.id!].message}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {wizardOpen && (
        <EmailMailboxWizard
          mailbox={editingMailbox}
          onSave={handleSave}
          onClose={() => { setWizardOpen(false); setEditingMailbox(null); }}
        />
      )}
    </div>
  );
};
