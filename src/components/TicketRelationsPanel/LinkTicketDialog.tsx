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
  onLinked: () => void;
}

// The auto-created inverse types (blocked_by / duplicated_by / causes) are never
// picked manually — they only ever appear as the automatically-created other side
// of one of these six.
const SELECTABLE_TYPES = ['relates_to', 'blocks', 'caused_by', 'duplicates', 'child_of', 'parent_of'];
const REL_TYPE_CLASS: Record<string, string> = {
  relates_to: 'rt-relates',
  blocks: 'rt-blocks',
  caused_by: 'rt-caused',
  duplicates: 'rt-dup',
  child_of: 'rt-child',
  parent_of: 'rt-parent',
};

export const LinkTicketDialog = ({ ticketId, onClose, onLinked }: Props) => {
  const { t } = useTranslation();
  const [type, setType] = useState('relates_to');
  const [target, setTarget] = useState<TicketPickerItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLink = async () => {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await api.post(`/tickets/${ticketId}/relationships`, {
        targetTicketId: target.id,
        relationshipType: type,
      });
      onLinked();
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError(t('ticket_link_dialog_already_linked', { defaultValue: 'These tickets are already linked this way' }));
      } else {
        setError('Failed to link ticket');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="trp-overlay" onClick={onClose}>
      <div className="trp-modal" onClick={e => e.stopPropagation()}>
        <div className="trp-modal-header">
          <h3 className="trp-modal-title">{t('ticket_link_dialog_title', { defaultValue: 'Link Ticket' })}</h3>
          <button className="trp-modal-close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="trp-modal-body">
          <div className="trp-field">
            <div className="trp-field-label">
              {t('ticket_link_dialog_type_label', { defaultValue: 'Relationship Type' })}
            </div>
            <div className="trp-type-picker">
              {SELECTABLE_TYPES.map(rt => (
                <span
                  key={rt}
                  className={`rel-type ${REL_TYPE_CLASS[rt]} trp-type-pill${type === rt ? ' selected' : ''}`}
                  onClick={() => setType(rt)}
                >
                  {t(`ticket_rel_type_${rt}`, { defaultValue: rt })}
                </span>
              ))}
            </div>
          </div>

          <div className="trp-field">
            <div className="trp-field-label">
              {t('ticket_link_dialog_search_label', { defaultValue: 'Search Ticket' })}
            </div>
            <TicketPickerControl value={target} onChange={setTarget} excludeTicketId={ticketId} />
          </div>

          {error && <div className="trp-error">{error}</div>}
        </div>

        <div className="trp-modal-footer">
          <button className="trp-cancel-btn" onClick={onClose} disabled={saving}>
            {t('cancel_btn', { defaultValue: 'Cancel' })}
          </button>
          <button className="trp-primary-btn" onClick={handleLink} disabled={saving || !target}>
            {saving ? '…' : t('ticket_link_dialog_link_btn', { defaultValue: 'Link' })}
          </button>
        </div>
      </div>
    </div>
  );
};
