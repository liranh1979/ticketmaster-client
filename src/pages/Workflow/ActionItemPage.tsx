import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ShieldCheck, ShieldX, Check } from 'lucide-react';
import api from '../../api';
import { SimpleItemFieldsForm } from '../../components/SimpleItemFieldsForm/SimpleItemFieldsForm';
import type { SimpleItemField } from '../Settings/TicketsTemplates/SimpleItemFieldsEditor';
import './ActionItemPage.css';

/* ── Types ── */

interface ItemContext {
  itemId: number;
  ticketId: number;
  ticketTitle: string | null;
  requesterName: string;
  itemTitle: string;
  itemType: string;
  itemStatus: string;
  typeConfig: { fields?: SimpleItemField[] } | null;
  fieldValues: Record<string, any> | null;
}

interface ApprovalDecision {
  id: number;
  workflowItemId: number;
  levelOrder: number;
  decision: 'pending' | 'approved' | 'rejected' | 'escalated';
}

interface Props {
  itemId: number;
  onBack: () => void;
}

const USER_STATUSES = ['in_progress', 'done', 'blocked'];
const STATUS_KEY: Record<string, string> = {
  in_progress: 'wf_status_in_progress',
  done: 'wf_status_done',
  blocked: 'wf_status_blocked',
};

/* ── Component ── */

// Scoped, ticket-detail-free view for "My Tasks" items — a user assigned to just this item (not
// the ticket's requester, not a TICKET_MANAGER) can act on it here without loading the full
// ticket via TicketEditPage, which they may not have access to (see WorkflowService.assertCanViewItem).
export const ActionItemPage = ({ itemId, onBack }: Props) => {
  const { t } = useTranslation();
  const [context, setContext] = useState<ItemContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [decisions, setDecisions] = useState<ApprovalDecision[]>([]);
  const [status, setStatus] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [decideError, setDecideError] = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [savingFields, setSavingFields] = useState(false);
  const [fieldsSaved, setFieldsSaved] = useState(false);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/workflow/items/${itemId}/context`);
      setContext(res.data);
      setStatus(res.data.itemStatus);
      setFieldValues(res.data.fieldValues ?? {});
      if (res.data.itemType === 'approval') {
        const dRes = await api.get(`/workflow/items/${itemId}/approval-decisions`);
        setDecisions(dRes.data);
      }
    } catch (err: any) {
      setError(err?.response?.status === 404
        ? t('action_item_not_found', { defaultValue: 'This item could not be found.' })
        : t('action_item_no_access', { defaultValue: "You don't have access to this item." }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [itemId]);

  const pending = decisions.find(d => d.decision === 'pending') ?? null;

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    setDecideError('');
    setDeciding(true);
    try {
      await api.post(`/workflow/items/${itemId}/approval-decision`, {
        decision, reason: decision === 'rejected' ? rejectReason : undefined,
      });
      setShowRejectBox(false);
      setRejectReason('');
      await load();
    } catch (err: any) {
      setDecideError(err?.response?.data?.message || t('something_went_wrong', { defaultValue: 'Something went wrong. Please try again.' }));
    } finally {
      setDeciding(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const prev = status;
    setStatus(newStatus);
    setSavingStatus(true);
    try {
      await api.patch(`/workflow/items/${itemId}/status`, { status: newStatus });
    } catch {
      setStatus(prev);
    } finally {
      setSavingStatus(false);
    }
  };

  const handleFieldValueChange = (key: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
    setFieldsSaved(false);
  };

  const handleSaveFields = async () => {
    setSavingFields(true);
    try {
      await api.patch(`/workflow/items/${itemId}`, { fieldValues });
      setFieldsSaved(true);
    } finally {
      setSavingFields(false);
    }
  };

  const taskFields = context?.typeConfig?.fields ?? [];

  return (
    <div className="aip-page">
      <div className="aip-header">
        <button className="aip-back-btn" onClick={onBack} title={t('back_btn', { defaultValue: 'Back' }) as string}>
          <ArrowLeft size={15} />
        </button>
        {context && (
          <div>
            <div className="aip-title">{context.itemTitle}</div>
            <div className="aip-sub">
              TT-{context.ticketId}{context.ticketTitle ? ` — ${context.ticketTitle}` : ''} · {t('workflow_approval_submitted_by', { defaultValue: 'Submitted by' })} {context.requesterName}
            </div>
          </div>
        )}
      </div>

      <div className="aip-body">
        {loading ? (
          <div className="aip-state">{t('loading_ellipsis', { defaultValue: 'Loading…' })}</div>
        ) : error || !context ? (
          <div className="aip-state aip-state-error">{error}</div>
        ) : context.itemType === 'approval' ? (
          <div className="aip-card">
            {pending ? (
              <>
                <div className="aip-level-label">{t('workflow_level_label', { defaultValue: 'Level {{level}}', level: pending.levelOrder + 1 })}</div>
                {showRejectBox ? (
                  <div className="aip-reject-box">
                    <textarea
                      className="aip-reason-input"
                      placeholder={t('workflow_rejection_reason_placeholder', { defaultValue: 'Reason for rejection (optional)…' }) as string}
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                    />
                    <div className="aip-reject-btns">
                      <button className="aip-btn-cancel" onClick={() => setShowRejectBox(false)} disabled={deciding}>
                        {t('cancel_btn', { defaultValue: 'Cancel' })}
                      </button>
                      <button className="aip-btn-reject" onClick={() => handleDecision('rejected')} disabled={deciding}>
                        <ShieldX size={14} /> {t('workflow_confirm_reject_btn', { defaultValue: 'Confirm Reject' })}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="aip-decide-btns">
                    <button className="aip-btn-approve" onClick={() => handleDecision('approved')} disabled={deciding}>
                      <ShieldCheck size={14} /> {t('workflow_approve_btn', { defaultValue: 'Approve' })}
                    </button>
                    <button className="aip-btn-reject" onClick={() => setShowRejectBox(true)} disabled={deciding}>
                      <ShieldX size={14} /> {t('workflow_reject_btn', { defaultValue: 'Reject' })}
                    </button>
                  </div>
                )}
                {decideError && <p className="aip-error-text">{decideError}</p>}
              </>
            ) : (
              <p className="aip-empty">{t('action_item_no_pending_decision', { defaultValue: 'There is nothing pending for you to decide on this item right now.' })}</p>
            )}
          </div>
        ) : (
          <div className="aip-card">
            <label className="aip-field-label">{t('status', { defaultValue: 'Status' })}</label>
            <select
              className="aip-select"
              value={status}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={savingStatus || status === 'done' || status === 'canceled'}
            >
              {USER_STATUSES.map(s => (
                <option key={s} value={s}>{t(STATUS_KEY[s], { defaultValue: s })}</option>
              ))}
            </select>

            {taskFields.length > 0 && (
              <div className="aip-fields-section">
                <SimpleItemFieldsForm fields={taskFields} values={fieldValues} onChange={handleFieldValueChange} />
                <button className="aip-btn-approve aip-save-fields-btn" onClick={handleSaveFields} disabled={savingFields}>
                  <Check size={14} /> {fieldsSaved ? t('saved', { defaultValue: 'Saved' }) : t('save_btn', { defaultValue: 'Save' })}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
