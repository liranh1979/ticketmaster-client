import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../api';
import type { TicketPickerItem } from '../../pages/Tickets/ticketTypes';
import { TicketPickerControl } from '../TicketPickerControl/TicketPickerControl';
import './TicketRelationsPanel.css';

interface Props {
  ticketId: number;
  onClose: () => void;
  onMerged: (targetTicketId: number) => void;
}

export const MergeTicketsDialog = ({ ticketId, onClose, onMerged }: Props) => {
  const { t } = useTranslation();
  const [target, setTarget] = useState<TicketPickerItem | null>(null);
  const [notifyRequester, setNotifyRequester] = useState(true);
  const [addComment, setAddComment] = useState(true);
  const [moveAttachments, setMoveAttachments] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMerge = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/tickets/${ticketId}/merge`, {
        targetTicketId: target.id,
        notifyRequester,
        addComment,
        moveAttachments,
      });
      onMerged(target.id);
    } catch {
      setError('Failed to merge tickets');
      setSaving(false);
    }
  };

  return (
    <div className="trp-overlay" onClick={onClose}>
      <div className="trp-modal" onClick={e => e.stopPropagation()}>
        <div className="trp-modal-header">
          <h3 className="trp-modal-title">{t('ticket_merge_dialog_title', { defaultValue: 'Merge Tickets' })}</h3>
          <button className="trp-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="trp-modal-body">
          <div className="trp-field">
            <div className="trp-field-label">
              {t('ticket_merge_dialog_target_label', { defaultValue: 'Merge into' })}
            </div>
            <TicketPickerControl value={target} onChange={setTarget} excludeTicketId={ticketId} />
          </div>

          {target && (
            <p className="trp-merge-desc">
              {t('ticket_merge_dialog_desc', {
                defaultValue: `All activity, attachments, and comments from TT-${ticketId} will be copied to TT-${target.id}. TT-${ticketId} will be closed as a duplicate.`,
                sourceId: `TT-${ticketId}`,
                targetId: `TT-${target.id}`,
              })}
            </p>
          )}

          <label className="trp-checkbox-row">
            <input type="checkbox" checked={notifyRequester} onChange={e => setNotifyRequester(e.target.checked)} />
            {t('ticket_merge_notify_checkbox', { defaultValue: 'Notify requester about the merge' })}
          </label>
          <label className="trp-checkbox-row">
            <input type="checkbox" checked={addComment} onChange={e => setAddComment(e.target.checked)} />
            {t('ticket_merge_comment_checkbox', { defaultValue: 'Add a comment explaining the merge' })}
          </label>
          <label className="trp-checkbox-row">
            <input type="checkbox" checked={moveAttachments} onChange={e => setMoveAttachments(e.target.checked)} />
            {t('ticket_merge_attachments_checkbox', { defaultValue: 'Move attachments to the target ticket' })}
          </label>

          {error && <div className="trp-error">{error}</div>}
        </div>

        <div className="trp-modal-footer">
          <button className="trp-cancel-btn" onClick={onClose} disabled={saving}>
            {t('cancel_btn', { defaultValue: 'Cancel' })}
          </button>
          <button className="trp-danger-btn" onClick={handleMerge} disabled={saving || !target}>
            {saving ? '…' : t('ticket_merge_confirm_btn', { defaultValue: 'Merge Tickets' })}
          </button>
        </div>
      </div>
    </div>
  );
};
