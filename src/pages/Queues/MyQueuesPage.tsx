import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Loader2, Settings2 } from 'lucide-react';
import api from '../../api';
import './MyQueuesPage.css';

// Agent Queue Management: the daily-use VIEW of saved queues — main workspace nav, not Settings
// (agents check this constantly, same as My Tasks/Service Desk). Creating/deleting queue
// definitions stays in Settings → Manage Queues; this page only browses tickets in a queue
// already saved there. GET /queues already returns exactly the queues this caller can see
// (personal ones they own + team queues for groups they belong to) — no client-side filtering
// needed. See V2/Agent Queue Management/03-mockup-queues-workload.html.

interface Queue {
  id: number;
  name: string;
  ownerType: 'user' | 'group';
  ownerId: number;
  filterConfig: Record<string, any>;
}

interface TicketRow {
  id: number;
  title: string;
  status: string;
  priority: string;
  responsibleUserDisplayName?: string | null;
}

interface Props {
  user: any;
  onManageQueues?: () => void;
  onViewTicket?: (id: number) => void;
}

export const MyQueuesPage = ({ onManageQueues, onViewTicket }: Props) => {
  const { t } = useTranslation();

  const [queues, setQueues] = useState<Queue[]>([]);
  const [selected, setSelected] = useState<Queue | null>(null);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);

  useEffect(() => {
    api.get<Queue[]>('/queues').then(res => {
      setQueues(res.data);
      if (res.data.length > 0) select(res.data[0]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const select = async (q: Queue) => {
    setSelected(q);
    setSummary(null);
    setLoadingTickets(true);
    try {
      const res = await api.get<TicketRow[]>(`/queues/${q.id}/tickets`, { params: { size: 50 } });
      setTickets(res.data);
    } finally { setLoadingTickets(false); }
  };

  const summarize = async () => {
    if (!selected) return;
    setSummarizing(true);
    try {
      const res = await api.post<{ html: string }>(`/queues/${selected.id}/summarize`);
      setSummary(res.data.html || t('aq_no_ai_provider_hint', { defaultValue: 'No active AI provider — suggestions unavailable.' }));
    } finally { setSummarizing(false); }
  };

  const personal = queues.filter(q => q.ownerType === 'user');
  const team = queues.filter(q => q.ownerType === 'group');

  return (
    <div className="mq-page">
      <div className="mq-layout">
        <div className="mq-sidebar">
          <div className="mq-sidebar-section">{t('aq_my_queues_section', { defaultValue: 'My Queues' })}</div>
          {personal.map(q => (
            <div key={q.id} className={`mq-item${selected?.id === q.id ? ' mq-item-active' : ''}`} onClick={() => select(q)}>{q.name}</div>
          ))}
          {team.length > 0 && <div className="mq-sidebar-section">{t('aq_team_queues_section', { defaultValue: 'Team Queues' })}</div>}
          {team.map(q => (
            <div key={q.id} className={`mq-item${selected?.id === q.id ? ' mq-item-active' : ''}`} onClick={() => select(q)}>{q.name}</div>
          ))}
          {onManageQueues && (
            <div className="mq-manage-link" onClick={onManageQueues}>
              <Settings2 size={12} /> {t('aq_manage_queues_nav_item', { defaultValue: 'Manage Queues' })}
            </div>
          )}
        </div>

        <div className="mq-main">
          {selected ? (
            <>
              <div className="mq-hdr">
                <span className="mq-title">{selected.name} ({tickets.length})</span>
                <button className="mq-ai-btn" onClick={summarize} disabled={summarizing}>
                  {summarizing ? <Loader2 size={13} className="mq-icon-spin" /> : <Sparkles size={13} />}
                  {t('aq_summarize_queue_btn', { defaultValue: 'Summarize Queue' })}
                </button>
              </div>
              {summary && (
                <div className="mq-ai-summary" dangerouslySetInnerHTML={{ __html: summary }} />
              )}
              {loadingTickets ? (
                <div className="mq-loading"><Loader2 size={18} className="mq-icon-spin" /></div>
              ) : tickets.length === 0 ? (
                <div className="mq-empty">{t('aq_no_tickets_in_queue_hint', { defaultValue: 'No tickets in this queue.' })}</div>
              ) : (
                tickets.map(row => (
                  <div key={row.id} className="mq-row" onClick={() => onViewTicket?.(row.id)}>
                    <span className={`mq-pri mq-pri-${row.priority}`}></span>
                    <span className="mq-id">TT-{row.id}</span>
                    <span className="mq-row-title">{row.title}</span>
                    <span className="mq-assignee">{row.responsibleUserDisplayName || '—'}</span>
                  </div>
                ))
              )}
            </>
          ) : (
            <div className="mq-empty">
              {t('aq_no_queues_hint', { defaultValue: 'No queues yet.' })}
              {onManageQueues && (
                <div className="mq-empty-cta" onClick={onManageQueues}>
                  {t('aq_manage_queues_nav_item', { defaultValue: 'Manage Queues' })} →
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
