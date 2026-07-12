import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2, X, GitMerge } from 'lucide-react';
import api from '../../api';
import type { TicketRelationship } from '../../pages/Tickets/ticketTypes';
import { useTicketRelationships } from '../../hooks/useTicketRelationships';
import { LinkTicketDialog } from './LinkTicketDialog';
import { MergeTicketsDialog } from './MergeTicketsDialog';
import './TicketRelationsPanel.css';

interface Props {
  ticketId: number;
  isAdmin: boolean;
  onNavigateTicket?: (id: number) => void;
  onMerged?: (targetTicketId: number) => void;
}

function statusPillClass(status: string) {
  return `sd-pill sd-pill--${status.replace(/_/g, '-')}`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const REL_TYPE_CLASS: Record<string, string> = {
  child_of: 'rt-child',
  parent_of: 'rt-parent',
  relates_to: 'rt-relates',
  blocks: 'rt-blocks',
  blocked_by: 'rt-blocks',
  caused_by: 'rt-caused',
  causes: 'rt-caused',
  duplicates: 'rt-dup',
  duplicated_by: 'rt-dup',
};

export const TicketRelationsPanel = ({
  ticketId, isAdmin, onNavigateTicket, onMerged,
}: Props) => {
  const { t } = useTranslation();
  const { relationships, loading, refresh } = useTicketRelationships(ticketId);
  const [linkOpen, setLinkOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<TicketRelationship | null>(null);
  const [unlinking, setUnlinking] = useState(false);

  const handleUnlink = async () => {
    if (!confirmUnlink) return;
    setUnlinking(true);
    try {
      await api.delete(`/tickets/${ticketId}/relationships/${confirmUnlink.id}`);
      setConfirmUnlink(null);
      refresh();
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="trp-section">
      <div className="trp-header">
        <h3 className="trp-title">{t('ticket_relations_panel_title', { defaultValue: 'Related Tickets' })}</h3>
        <div className="trp-header-actions">
          <button className="trp-link-btn" onClick={() => setLinkOpen(true)}>
            <Link2 size={13} /> {t('ticket_relations_link_btn', { defaultValue: '+ Link Ticket' })}
          </button>
          {isAdmin && (
            <button className="trp-merge-btn" onClick={() => setMergeOpen(true)}>
              <GitMerge size={13} /> {t('ticket_relations_merge_btn', { defaultValue: 'Merge Tickets' })}
            </button>
          )}
        </div>
      </div>

      {!loading && relationships.length === 0 && (
        <div className="trp-empty">{t('ticket_relations_empty', { defaultValue: 'No related tickets yet.' })}</div>
      )}

      {relationships.length > 0 && (
        <div className="trp-list">
          {relationships.map(rel => (
            <div key={rel.id} className="trp-row">
              <span className={`rel-type ${REL_TYPE_CLASS[rel.relationshipType] ?? 'rt-relates'}`}>
                {t(`ticket_rel_type_${rel.relationshipType}`, { defaultValue: rel.relationshipType })}
              </span>
              <span className="trp-tkt-id">TT-{rel.otherTicketId}</span>
              <a
                className="trp-tkt-link"
                href={`?ticket=${rel.otherTicketId}`}
                onClick={e => { e.preventDefault(); onNavigateTicket?.(rel.otherTicketId); }}
              >
                {rel.otherTicketTitle ?? `TT-${rel.otherTicketId}`}
              </a>
              <span className="trp-row-right">
                {rel.otherTicketStatus && (
                  <span className={statusPillClass(rel.otherTicketStatus)}>
                    <span>{statusLabel(rel.otherTicketStatus)}</span>
                  </span>
                )}
                <button
                  className="trp-unlink-btn"
                  onClick={() => setConfirmUnlink(rel)}
                  title={t('ticket_unlink_confirm', { defaultValue: 'Remove this relationship?' })}
                >
                  <X size={13} />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {linkOpen && (
        <LinkTicketDialog
          ticketId={ticketId}
          onClose={() => setLinkOpen(false)}
          onLinked={() => { setLinkOpen(false); refresh(); }}
        />
      )}

      {mergeOpen && (
        <MergeTicketsDialog
          ticketId={ticketId}
          onClose={() => setMergeOpen(false)}
          onMerged={(targetId) => { setMergeOpen(false); onMerged ? onMerged(targetId) : refresh(); }}
        />
      )}

      {confirmUnlink && (
        <div className="trp-overlay" onClick={() => !unlinking && setConfirmUnlink(null)}>
          <div className="trp-confirm" onClick={e => e.stopPropagation()}>
            <p>{t('ticket_unlink_confirm', { defaultValue: 'Remove this relationship?' })}</p>
            <div className="trp-confirm-actions">
              <button className="trp-cancel-btn" onClick={() => setConfirmUnlink(null)} disabled={unlinking}>
                {t('cancel_btn', { defaultValue: 'Cancel' })}
              </button>
              <button className="trp-danger-btn" onClick={handleUnlink} disabled={unlinking}>
                {unlinking ? '…' : t('delete_btn', { defaultValue: 'Remove' })}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
