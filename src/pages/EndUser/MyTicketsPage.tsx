import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import api from '../../api';
import { formatRelativeTime, priorityColor, PRIORITY_ICONS } from '../Tickets/ticketTypes';
import './MyTicketsPage.css';

interface TicketRow {
  id: number; title: string; status: string; priority: string; templateName?: string; updatedAt: string;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  new:         { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8' },
  open:        { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa' },
  in_progress: { bg: 'rgba(245,158,11,0.12)', text: '#fbbf24' },
  waiting:     { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa' },
  resolved:    { bg: 'rgba(16,185,129,0.12)',  text: '#34d399' },
  closed:      { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' },
};

const PAGE_SIZE = 25;

interface Props {
  user: any;
  onBack: () => void;
  onNewTicket: () => void;
  onViewTicket: (id: number) => void;
}

export const MyTicketsPage = ({ onBack, onNewTicket, onViewTicket }: Props) => {
  const { t } = useTranslation();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [search, setSearch]   = useState('');
  const [status, setStatus]   = useState('');
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const cursor = useRef<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadPage = useCallback(async (reset = false) => {
    const c = reset ? null : cursor.current;
    if (!reset && c === null && tickets.length > 0) return;
    setLoading(true);
    try {
      const r = await api.get('/tickets', {
        params: { size: PAGE_SIZE, cursor: c, search: search || undefined, status: status || undefined },
      });
      const data: TicketRow[] = r.data;
      if (reset) {
        setTickets(data);
      } else {
        setTickets(prev => [...prev, ...data]);
      }
      setHasMore(data.length === PAGE_SIZE);
      cursor.current = data.length > 0 ? data[data.length - 1].id : null;
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    cursor.current = null;
    loadPage(true);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      cursor.current = null;
      loadPage(true);
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [search, status]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) loadPage(false);
    }, { rootMargin: '200px' });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loading, loadPage]);

  const statusCol = STATUS_COLORS;

  return (
    <div className="mtp-page">
      {/* Header */}
      <div className="mtp-header">
        <button className="mtp-back-btn" onClick={onBack}><ArrowLeft size={16} /></button>
        <h1 className="mtp-title">{t('my_tickets_title', { defaultValue: 'My Tickets' })}</h1>
        <button className="mtp-new-btn" onClick={onNewTicket}>
          <Plus size={15} /> {t('eu_new_ticket_btn', { defaultValue: 'New Ticket' })}
        </button>
      </div>

      {/* Filters */}
      <div className="mtp-filters">
        <div className="mtp-search-wrap">
          <Search size={14} className="mtp-search-icon" />
          <input
            className="mtp-search"
            placeholder="Search tickets…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="mtp-status-select" value={status} onChange={e => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {['new','open','in_progress','waiting','resolved','closed'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="mtp-table-wrap">
        <table className="mtp-table">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th style={{ width: 90 }}>Priority</th>
              <th>Title</th>
              <th style={{ width: 130 }}>Status</th>
              <th style={{ width: 120 }}>Updated</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map(ticket => {
              const sc = statusCol[ticket.status] ?? { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8' };
              const pc = priorityColor(ticket.priority);
              return (
                <tr key={ticket.id} className="mtp-row" onClick={() => onViewTicket(ticket.id)}>
                  <td><span className="mtp-id">TT-{ticket.id}</span></td>
                  <td>
                    <span className="mtp-status-pill" style={{ background: pc.bg, color: pc.text }}>
                      {PRIORITY_ICONS[ticket.priority] ?? ''} {ticket.priority?.replace(/^\w/, c => c.toUpperCase())}
                    </span>
                  </td>
                  <td>
                    <span className="mtp-ticket-title">{ticket.title}</span>
                    {ticket.templateName && (
                      <span className="mtp-template-name">{ticket.templateName}</span>
                    )}
                  </td>
                  <td>
                    <span className="mtp-status-pill" style={{ background: sc.bg, color: sc.text }}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td><span className="mtp-time">{formatRelativeTime(ticket.updatedAt)}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && tickets.length === 0 && (
          <div className="mtp-empty">
            <div className="mtp-empty-icon">📋</div>
            <p>{t('no_my_tickets', { defaultValue: 'You have no tickets yet.' })}</p>
            <button className="mtp-empty-cta" onClick={onNewTicket}>
              <Plus size={14} /> {t('eu_new_ticket_btn', { defaultValue: 'New Ticket' })}
            </button>
          </div>
        )}

        <div ref={sentinelRef} style={{ height: 1 }} />

        {loading && (
          <div className="mtp-loading">
            <div className="mtp-spinner" />
          </div>
        )}
      </div>
    </div>
  );
};
