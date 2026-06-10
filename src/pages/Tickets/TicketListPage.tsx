import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2, RefreshCw, Tag, UserCheck, ChevronDown, X, Plus, Bell } from 'lucide-react';
import api from '../../api';
import type { TicketListItem, TicketLabel, TicketSseEvent } from './ticketTypes';
import { statusColor, formatRelativeTime } from './ticketTypes';
import './TicketListPage.css';

interface Props {
  user: any;
  onNewTicket: () => void;
  onEditTicket: (id: number) => void;
}

interface TemplateSummary { id: number; name: string; }
interface UserOption { userId: number; display_name: string; }

type BulkAction = 'status' | 'responsible' | 'add-label' | 'remove-label' | null;

export const TicketListPage = ({
  onNewTicket,
  onEditTicket,
}: Props) => {
  const { t } = useTranslation();

  const [tickets, setTickets]       = useState<TicketListItem[]>([]);
  const [labels, setLabels]         = useState<TicketLabel[]>([]);
  const [templates, setTemplates]   = useState<TemplateSummary[]>([]);
  const [managers, setManagers]     = useState<UserOption[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const [search, setSearch]         = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>(null);

  const [pendingNew, setPendingNew] = useState(0);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef   = useRef<number | null>(null);
  const PAGE_SIZE   = 25;

  useEffect(() => {
    api.get('/ticket-labels').then(r => setLabels(r.data)).catch(() => {});
    api.get('/templates').then(r => setTemplates(r.data)).catch(() => {});
    api.get('/ticket-users/managers').then(r => setManagers(r.data)).catch(() => {});
  }, []);

  // SSE subscription — new tickets / in-place row updates
  useEffect(() => {
    const es = new EventSource('/api/v1/tickets/stream', { withCredentials: true });
    es.addEventListener('ticket-event', (e: MessageEvent) => {
      const event: TicketSseEvent = JSON.parse(e.data);
      if (event.operation === 'TICKET_CREATED') {
        setPendingNew(prev => prev + 1);
      } else if (event.type === 'TICKET_UPDATED' && event.ticketId) {
        // Update the row in-place if it's currently loaded
        setTickets(prev => {
          if (!prev.some(t => t.id === event.ticketId)) return prev;
          api.get(`/tickets/${event.ticketId}`).then(r => {
            const td = r.data;
            setTickets(prev2 => prev2.map(t =>
              t.id === event.ticketId
                ? { ...t, title: td.title, status: td.status, updatedAt: td.updatedAt,
                    labels: td.labels, responsibleUserId: td.responsibleUserId,
                    responsibleUserDisplayName: td.responsibleUserDisplayName, version: td.version }
                : t
            ));
          }).catch(() => {});
          return prev;
        });
      }
    });
    return () => es.close();
  }, []);

  const buildQueryParams = useCallback((cursor: number | null) => {
    const params: Record<string, any> = { size: PAGE_SIZE };
    if (cursor)       params.cursor = cursor;
    if (search)       params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (templateId)   params.templateId = templateId;
    return params;
  }, [search, statusFilter, templateId]);

  const loadTickets = useCallback(async (reset = false) => {
    const cursor = reset ? null : cursorRef.current;
    if (!reset && !hasMore) return;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const { data } = await api.get('/tickets', { params: buildQueryParams(cursor) });
      const items: TicketListItem[] = data;
      setTickets(prev => reset ? items : [...prev, ...items]);
      setHasMore(items.length === PAGE_SIZE);
      cursorRef.current = items.length ? items[items.length - 1].id : cursorRef.current;
      if (reset) setSelected(new Set());
    } catch (e) { console.error(e); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [buildQueryParams, hasMore]);

  useEffect(() => {
    cursorRef.current = null;
    setHasMore(true);
    loadTickets(true);
  }, [search, statusFilter, templateId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !loadingMore && hasMore) loadTickets(false); },
      { rootMargin: '200px' }
    );
    if (sentinelRef.current) observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadTickets, loadingMore, hasMore]);

  const handleSearchChange = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value), 400);
  };

  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const toggleSelectAll = () => {
    if (selected.size === tickets.length) setSelected(new Set());
    else setSelected(new Set(tickets.map(t => t.id)));
  };

  const closeBulk = () => setBulkAction(null);

  const executeBulk = async (
    action: BulkAction,
    statusVal?: string,
    labelId?: number,
    responsibleId?: number,
  ) => {
    const ids = [...selected];
    try {
      if (action === 'status' && statusVal)
        await api.post('/tickets/bulk-update-status', { ids, status: statusVal });
      else if (action === 'responsible' && responsibleId != null)
        await api.post('/tickets/bulk-update-responsible', { ids, responsibleUserId: responsibleId });
      else if (action === 'add-label' && labelId != null)
        await api.post('/tickets/bulk-add-label', { ids, labelId });
      else if (action === 'remove-label' && labelId != null)
        await api.post('/tickets/bulk-remove-label', { ids, labelId });
      closeBulk();
      setSelected(new Set());
      setTimeout(() => loadTickets(true), 800);
    } catch (e) { console.error(e); }
  };

  const executeBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} ticket(s)?`)) return;
    await api.post('/tickets/bulk-delete', { ids: [...selected] });
    setSelected(new Set());
    loadTickets(true);
  };

  const STATUS_OPTIONS = ['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];

  if (loading) return (
    <div className="tl-page tl-page-flat">
      <div className="tl-loading">
        <div className="tl-spinner" /><span>{t('loading_tickets')}</span>
      </div>
    </div>
  );

  return (
    <div className="tl-page tl-page-flat">
      <main className="tl-main tl-main-full">
        {/* New-ticket banner */}
        {pendingNew > 0 && (
          <div className="tl-new-banner">
            <Bell size={14} />
            <span>{pendingNew} new ticket{pendingNew > 1 ? 's' : ''} available</span>
            <button className="tl-new-banner-btn" onClick={() => { setPendingNew(0); loadTickets(true); }}>
              Refresh
            </button>
            <button className="tl-new-banner-dismiss" onClick={() => setPendingNew(0)}>×</button>
          </div>
        )}

        {/* Header */}
        <div className="tl-header">
          <div className="tl-header-left">
            <h1 className="tl-title">{t('service_desk')}</h1>
            <p className="tl-subtitle">{tickets.length}{hasMore ? '+' : ''} tickets</p>
          </div>
          <button className="tl-new-btn" onClick={onNewTicket}>
            <Plus size={15} /> {t('new_ticket')}
          </button>
        </div>

        {/* Filter toolbar */}
        <div className="tl-filter-bar">
          <div className="tl-search-box">
            <span>🔎</span>
            <input
              className="tl-search-input"
              placeholder={t('ticket_search_placeholder')}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>

          <select className="tl-filter-select" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}>
            <option value="">{t('ticket_filter_status')}: Any</option>
            {STATUS_OPTIONS.map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>

          <select className="tl-filter-select" value={templateId}
            onChange={e => setTemplateId(e.target.value)}>
            <option value="">{t('ticket_filter_template')}: Any</option>
            {templates.map(tpl => (
              <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="tl-table-card">
          <div className="tl-table-header">
            <div>
              <input type="checkbox"
                checked={selected.size === tickets.length && tickets.length > 0}
                onChange={toggleSelectAll} />
            </div>
            <div>{t('ticket_id_col')}</div>
            <div>{t('ticket_title_col')}</div>
            <div>{t('ticket_status_col')}</div>
            <div>{t('ticket_labels_col')}</div>
            <div>{t('ticket_assignee_col')}</div>
            <div>{t('ticket_updated_col')}</div>
          </div>

          <div className="tl-table-body">
            {tickets.length === 0 && (
              <div className="tl-empty">{t('no_tickets')}</div>
            )}
            {tickets.map(ticket => {
              const sc = statusColor(ticket.status);
              return (
                <div
                  key={ticket.id}
                  className={`tl-row${selected.has(ticket.id) ? ' tl-row-selected' : ''}`}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).tagName === 'INPUT') return;
                    onEditTicket(ticket.id);
                  }}
                >
                  <div onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(ticket.id)}
                      onChange={() => toggleSelect(ticket.id)} />
                  </div>
                  <div className="tl-ticket-id">TT-{ticket.id}</div>
                  <div className="tl-ticket-title-cell">
                    <div className="tl-ticket-title">{ticket.title}</div>
                    <div className="tl-ticket-sub">
                      {ticket.templateName} • {formatRelativeTime(ticket.updatedAt)}
                    </div>
                  </div>
                  <div>
                    <span className="tl-status-pill"
                      style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                      {ticket.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="tl-labels-cell">
                    {ticket.labels.map(label => (
                      <span key={label.id} className="tl-label-pill">
                        <span className="tl-label-dot" style={{ background: label.color }} />
                        {label.labelKey}
                      </span>
                    ))}
                  </div>
                  <div className="tl-assignee">
                    {ticket.responsibleUserDisplayName ? (
                      <span className="tl-avatar" title={ticket.responsibleUserDisplayName}>
                        {ticket.responsibleUserDisplayName.slice(0, 2).toUpperCase()}
                      </span>
                    ) : <span className="tl-unassigned">—</span>}
                  </div>
                  <div className="tl-updated">{formatRelativeTime(ticket.updatedAt)}</div>
                </div>
              );
            })}
          </div>

          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadingMore && <div className="tl-loading-more"><div className="tl-spinner-sm" /></div>}
        </div>
      </main>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="tl-bulk-bar">
          <span className="tl-bulk-count">{selected.size} {t('selected_count')}</span>

          <button className="tl-bulk-btn tl-bulk-danger" onClick={executeBulkDelete}>
            <Trash2 size={14} /> {t('bulk_delete')}
          </button>

          {/* Status */}
          <div className="tl-bulk-action-group">
            <button className={`tl-bulk-btn${bulkAction === 'status' ? ' tl-bulk-btn-active' : ''}`}
              onClick={() => setBulkAction(bulkAction === 'status' ? null : 'status')}>
              <RefreshCw size={14} /> {t('bulk_update_status')} <ChevronDown size={12} />
            </button>
            {bulkAction === 'status' && (
              <div className="tl-bulk-dropdown">
                {STATUS_OPTIONS.map(s => (
                  <button key={s} className="tl-bulk-dropdown-item"
                    onClick={() => executeBulk('status', s)}>
                    {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Responsible */}
          <div className="tl-bulk-action-group">
            <button className={`tl-bulk-btn${bulkAction === 'responsible' ? ' tl-bulk-btn-active' : ''}`}
              onClick={() => setBulkAction(bulkAction === 'responsible' ? null : 'responsible')}>
              <UserCheck size={14} /> {t('bulk_update_responsible')} <ChevronDown size={12} />
            </button>
            {bulkAction === 'responsible' && (
              <div className="tl-bulk-dropdown">
                {managers.map(m => (
                  <button key={m.userId} className="tl-bulk-dropdown-item"
                    onClick={() => executeBulk('responsible', undefined, undefined, m.userId)}>
                    {m.display_name}
                  </button>
                ))}
                {managers.length === 0 && (
                  <span className="tl-bulk-dropdown-empty">No managers found</span>
                )}
              </div>
            )}
          </div>

          {/* Add label */}
          <div className="tl-bulk-action-group">
            <button className={`tl-bulk-btn${bulkAction === 'add-label' ? ' tl-bulk-btn-active' : ''}`}
              onClick={() => setBulkAction(bulkAction === 'add-label' ? null : 'add-label')}>
              <Tag size={14} /> {t('bulk_add_label')} <ChevronDown size={12} />
            </button>
            {bulkAction === 'add-label' && (
              <div className="tl-bulk-dropdown">
                {labels.map(l => (
                  <button key={l.id} className="tl-bulk-dropdown-item"
                    onClick={() => executeBulk('add-label', undefined, l.id)}>
                    <span className="tl-label-dot" style={{ background: l.color }} /> {l.labelKey}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Remove label */}
          <div className="tl-bulk-action-group">
            <button className={`tl-bulk-btn${bulkAction === 'remove-label' ? ' tl-bulk-btn-active' : ''}`}
              onClick={() => setBulkAction(bulkAction === 'remove-label' ? null : 'remove-label')}>
              <Tag size={14} /> {t('bulk_remove_label')} <ChevronDown size={12} />
            </button>
            {bulkAction === 'remove-label' && (
              <div className="tl-bulk-dropdown">
                {labels.map(l => (
                  <button key={l.id} className="tl-bulk-dropdown-item"
                    onClick={() => executeBulk('remove-label', undefined, l.id)}>
                    <span className="tl-label-dot" style={{ background: l.color }} /> {l.labelKey}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className="tl-bulk-btn" onClick={closeBulk}><X size={14} /></button>
        </div>
      )}
    </div>
  );
};
