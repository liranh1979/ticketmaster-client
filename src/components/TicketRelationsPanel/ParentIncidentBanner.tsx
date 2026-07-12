import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link2 } from 'lucide-react';
import api from '../../api';
import type { TicketRelationship } from '../../pages/Tickets/ticketTypes';
import './TicketRelationsPanel.css';

interface Props {
  relationships: TicketRelationship[];
  onNavigateTicket?: (id: number) => void;
}

export const ParentIncidentBanner = ({ relationships, onNavigateTicket }: Props) => {
  const { t } = useTranslation();
  const parent = relationships.find(r => r.relationshipType === 'child_of');
  const [childCount, setChildCount] = useState<number | null>(null);

  useEffect(() => {
    if (!parent) { setChildCount(null); return; }
    let cancelled = false;
    api.get(`/tickets/${parent.otherTicketId}/relationships`).then(({ data }) => {
      if (cancelled) return;
      const count = (data as TicketRelationship[]).filter(r => r.relationshipType === 'parent_of').length;
      setChildCount(count);
    }).catch(() => { if (!cancelled) setChildCount(null); });
    return () => { cancelled = true; };
  }, [parent?.otherTicketId]);

  if (!parent) return null;

  return (
    <div className="trp-parent-banner">
      <span className="trp-parent-icon"><Link2 size={16} /></span>
      <div className="trp-parent-body">
        <div className="trp-parent-label">
          {t('ticket_parent_banner_label', { defaultValue: 'Parent (Major Incident)' })}
        </div>
        <a
          className="trp-parent-link"
          href={`?ticket=${parent.otherTicketId}`}
          onClick={e => { e.preventDefault(); onNavigateTicket?.(parent.otherTicketId); }}
        >
          TT-{parent.otherTicketId} — {parent.otherTicketTitle}
        </a>
      </div>
      {childCount != null && (
        <span className="trp-parent-count">
          {t('ticket_parent_banner_child_count', { defaultValue: `${childCount} child tickets`, count: childCount })}
        </span>
      )}
    </div>
  );
};
