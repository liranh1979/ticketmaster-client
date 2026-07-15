import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../api';
import './WorkflowApprovalPage.css';

interface WorkflowApprovalContextDto {
  ticketId: number;
  ticketTitle: string | null;
  itemTitle: string;
  requesterName: string;
  levelOrder: number;
  expired: boolean;
  alreadyDecided: boolean;
  existingDecision: 'approved' | 'rejected' | null;
}

interface Props {
  token: string;
  initialAction: 'approve' | 'reject' | null;
}

export const WorkflowApprovalPage = ({ token, initialAction }: Props) => {
  const { t } = useTranslation();
  const [context, setContext] = useState<WorkflowApprovalContextDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Clicking either link in the email lands here with the intent pre-selected — but nothing is
  // recorded until the human confirms with a click on THIS page (a plain GET on the emailed link
  // never mutates anything), which is what protects against a corporate email scanner prefetching
  // the link and silently recording a decision no human actually made.
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(initialAction);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'approved' | 'rejected' | null>(null);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.get(`/workflow-approval/${token}`)
      .then(r => setContext(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const decision = pendingAction === 'approve' ? 'approved' : 'rejected';
      await api.post(`/workflow-approval/${token}`, { decision, reason: reason.trim() || null });
      setSubmitted(decision);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="wap-root">
        <div className="wap-spinner" />
      </div>
    );
  }

  if (notFound || !context) {
    return (
      <div className="wap-root">
        <div className="wap-card">
          <p className="wap-message">{t('workflow_approval_not_found', { defaultValue: 'Approval link not found.' })}</p>
        </div>
      </div>
    );
  }

  const finalDecision = submitted ?? (context.alreadyDecided ? context.existingDecision : null);

  return (
    <div className="wap-root">
      <div className="wap-card">
        <div className="wap-header">🔔 {t('workflow_approval_header', { defaultValue: 'Approval Required' })}</div>

        <div className="wap-ticket-context">
          <div className="wap-ticket-title">TT-{context.ticketId} — {context.ticketTitle}</div>
          <div className="wap-ticket-meta">
            {t('workflow_approval_submitted_by', { defaultValue: 'Submitted by' })} {context.requesterName} · {context.itemTitle}
          </div>
        </div>

        {context.expired && !context.alreadyDecided ? (
          <p className="wap-message">{t('workflow_approval_expired', { defaultValue: 'This approval link has expired.' })}</p>
        ) : finalDecision ? (
          <div className="wap-result">
            {finalDecision === 'approved' ? (
              <CheckCircle2 size={40} color="#22c55e" />
            ) : (
              <XCircle size={40} color="#ef4444" />
            )}
            <p className="wap-message">
              {finalDecision === 'approved'
                ? t('workflow_approval_result_approved', { defaultValue: 'You approved this request.' })
                : t('workflow_approval_result_rejected', { defaultValue: 'You rejected this request.' })}
            </p>
          </div>
        ) : !pendingAction ? (
          <div className="wap-actions">
            <button className="wap-approve-btn" onClick={() => setPendingAction('approve')}>
              <Check size={16} /> {t('workflow_approval_approve_btn', { defaultValue: 'Approve' })}
            </button>
            <button className="wap-reject-btn" onClick={() => setPendingAction('reject')}>
              <X size={16} /> {t('workflow_approval_reject_btn', { defaultValue: 'Reject' })}
            </button>
          </div>
        ) : (
          <>
            <p className="wap-question">
              {pendingAction === 'approve'
                ? t('workflow_approval_confirm_approve', { defaultValue: 'Confirm you want to approve this request?' })
                : t('workflow_approval_confirm_reject', { defaultValue: 'Confirm you want to reject this request?' })}
            </p>

            {pendingAction === 'reject' && (
              <>
                <label className="wap-reason-label">
                  {t('workflow_approval_reason_prompt', { defaultValue: 'Reason (optional)' })}
                </label>
                <textarea
                  className="wap-reason-input"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  rows={3}
                />
              </>
            )}

            {submitError && <p className="wap-error">{submitError}</p>}

            <div className="wap-confirm-row">
              <button className="wap-cancel-btn" onClick={() => setPendingAction(null)} disabled={submitting}>
                {t('cancel_btn', { defaultValue: 'Cancel' })}
              </button>
              <button
                className={pendingAction === 'approve' ? 'wap-approve-btn' : 'wap-reject-btn'}
                onClick={handleConfirm}
                disabled={submitting}
              >
                {submitting ? '…' : pendingAction === 'approve'
                  ? t('workflow_approval_confirm_approve_btn', { defaultValue: 'Confirm Approve' })
                  : t('workflow_approval_confirm_reject_btn', { defaultValue: 'Confirm Reject' })}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
