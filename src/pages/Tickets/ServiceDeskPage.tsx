import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  Search, Plus, Trash2, RefreshCw, Tag, UserCheck, ChevronDown, X, SlidersHorizontal, Bell,
} from 'lucide-react';
import api from '../../api';
import type { TicketListItem, TicketLabel, TicketSseEvent, TemplateLayoutField } from './ticketTypes';
import { formatRelativeTime } from './ticketTypes';
import { TimerProgressBar } from '../../components/TimerProgressBar/TimerProgressBar';
import './ServiceDeskPage.css';

interface Props {
  user: any;
  onNewTicket: () => void;
  onEditTicket: (id: number) => void;
  onSettings?: () => void;
  onMyTasks?: () => void;
  onTicketCountChange?: (count: number, hasMore: boolean) => void;
}

interface TemplateSummary { id: number; name: string; }
interface UserOption { user_id: number; display_name: string; }

type BulkAction = 'status' | 'responsible' | 'add-label' | 'remove-label' | null;
type QuickFilter = 'all' | 'mine' | 'unassigned';

const PAGE_SIZE = 25;

const STATUS_OPTIONS = ['new', 'open', 'in_progress', 'waiting', 'resolved', 'closed'];
const STATUS_LABELS: Record<string, string> = {
  new: 'New', open: 'Open', in_progress: 'In Progress',
  waiting: 'Waiting', resolved: 'Resolved', closed: 'Closed',
};
const STATUS_CHIPS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'open', label: 'Open' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'waiting', label: 'Waiting' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];
const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
};

function initials(name: string = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

function statusPillClass(status: string) {
  return `sd-pill sd-pill--${status.replace(/_/g, '-')}`;
}

function priorityPillClass(priority: string) {
  return `sd-pill sd-pill--${priority}`;
}

// Toolbar chip + dropdown panel, portaled to <body>.
//
// .sd-toolbar has overflow-x:auto for horizontal chip scrolling; per the CSS
// overflow spec, that forces overflow-y to auto too (a "visible" axis paired
// with a non-"visible" one is computed as auto), so a plain absolutely-positioned
// dropdown gets clipped before it can render below the chip row. Portaling to
// <body> with position:fixed (computed from the trigger's bounding rect) escapes
// that clipping entirely.
//
// The outside-click-to-close check must test both the trigger's ref AND the
// portaled panel's ref — the panel is a React-tree descendant of this component
// but NOT a DOM descendant of the trigger, so checking only the trigger ref
// makes every click inside the panel look "outside" and closes it on mousedown,
// before the click on an option can register.
function ToolbarDropdown({ open, onClose, trigger, children }: {
  open: boolean;
  onClose: () => void;
  trigger: React.ReactNode;
  children: React.ReactNode;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef  = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 6, left: rect.left });
    };
    updatePos();
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open, onClose]);

  return (
    <div className="sd-toolbar-group" ref={anchorRef}>
      {trigger}
      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="sd-toolbar-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  );
}

export const ServiceDeskPage = ({
  user,
  onNewTicket,
  onEditTicket,
  onTicketCountChange,
}: Props) => {
  const { t } = useTranslation();

  // ── Data state ──────────────────────────────────────────────────────
  const [tickets, setTickets]           = useState<TicketListItem[]>([]);
  const [labels, setLabels]             = useState<TicketLabel[]>([]);
  const [templates, setTemplates]       = useState<TemplateSummary[]>([]);
  const [managers, setManagers]         = useState<UserOption[]>([]);
  const [timerFields, setTimerFields]   = useState<TemplateLayoutField[]>([]);
  const [loading, setLoading]           = useState(true);
  const [loadingMore, setLoadingMore]   = useState(false);
  const [hasMore, setHasMore]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [priorityDropdownOpen, setPriorityDropdownOpen] = useState(false);
  const [templateId, setTemplateId]     = useState('');
  const [templateDropdownOpen, setTemplateDropdownOpen] = useState(false);
  const [selected, setSelected]         = useState<Set<number>>(new Set());
  const [bulkAction, setBulkAction]     = useState<BulkAction>(null);
  const [pendingNew, setPendingNew]     = useState(0);

  // ── V2-specific state ─────────────────────────────────────────────────
  const [quickFilter, setQuickFilter]   = useState<QuickFilter>('all');
  const [cursor, setCursor]             = useState(0);

  const searchRef   = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef   = useRef<number | null>(null);

  // ── Init: labels / templates / managers / timer fields ───────────────
  useEffect(() => {
    api.get('/ticket-labels').then(r => setLabels(r.data)).catch(() => {});
    api.get('/templates').then(r => setTemplates(r.data)).catch(() => {});
    api.get('/ticket-users/managers').then(r => setManagers(r.data)).catch(() => {});
    api.get('/field-definitions?entityType=ticket').then(r => {
      const visible = (r.data as TemplateLayoutField[])
        .filter(f => f.fieldType === 'timer' && f.isListVisible);
      setTimerFields(visible);
    }).catch(() => {});
  }, []);

  // ── SSE: new ticket banner + in-place row updates ─────────────────────
  useEffect(() => {
    const es = new EventSource('/api/v1/tickets/stream', { withCredentials: true });
    es.addEventListener('ticket-event', (e: MessageEvent) => {
      const event: TicketSseEvent = JSON.parse(e.data);
      if (event.operation === 'TICKET_CREATED') {
        setPendingNew(prev => prev + 1);
      } else if (event.type === 'TICKET_UPDATED' && event.ticketId) {
        setTickets(prev => {
          if (!prev.some(t => t.id === event.ticketId)) return prev;
          api.get(`/tickets/${event.ticketId}`).then(r => {
            const td = r.data;
            setTickets(prev2 => prev2.map(t =>
              t.id === event.ticketId
                ? { ...t, title: td.title, status: td.status, priority: td.priority, updatedAt: td.updatedAt,
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

  // ── Pagination / fetching ─────────────────────────────────────────────
  const buildQueryParams = useCallback((cursor: number | null) => {
    const params: Record<string, any> = { size: PAGE_SIZE };
    if (cursor)       params.cursor     = cursor;
    if (search)         params.search     = search;
    if (statusFilter)   params.status     = statusFilter;
    if (priorityFilter) params.priority   = priorityFilter;
    if (templateId)     params.templateId = templateId;
    return params;
  }, [search, statusFilter, priorityFilter, templateId]);

  const loadTickets = useCallback(async (reset = false) => {
    const cur = reset ? null : cursorRef.current;
    if (!reset && !hasMore) return;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const { data } = await api.get('/tickets', { params: buildQueryParams(cur) });
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
  }, [search, statusFilter, priorityFilter, templateId]);

  const handleTableScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 300 && !loadingMore && hasMore) {
      loadTickets(false);
    }
  }, [loadingMore, hasMore, loadTickets]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    if (quickFilter === 'mine')       return tickets.filter(t => t.responsibleUserId === user?.red_id);
    if (quickFilter === 'unassigned') return tickets.filter(t => !t.responsibleUserId);
    return tickets;
  }, [tickets, quickFilter, user]);

  useEffect(() => {
    onTicketCountChange?.(filteredTickets.length, hasMore);
  }, [filteredTickets.length, hasMore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === 'c') onNewTicket();
      else if (e.key === 'j') setCursor(c => Math.min(c + 1, filteredTickets.length - 1));
      else if (e.key === 'k') setCursor(c => Math.max(c - 1, 0));
      else if (e.key === 'x') {
        const row = filteredTickets[cursor];
        if (row) toggleSelect(row.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [filteredTickets, cursor, onNewTicket]);

  // ── Selection ─────────────────────────────────────────────────────────
  const toggleSelect = (id: number) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleSelectAll = () => {
    if (selected.size === filteredTickets.length && filteredTickets.length > 0)
      setSelected(new Set());
    else
      setSelected(new Set(filteredTickets.map(t => t.id)));
  };

  // ── Bulk actions ────────────────────────────────────────────────────
  const closeBulk = () => setBulkAction(null);

  const executeBulk = async (
    action: BulkAction, statusVal?: string, labelId?: number, responsibleId?: number,
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

  // ── Search ────────────────────────────────────────────────────────────
  const handleSearchChange = (value: string) => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(value), 400);
  };

  // ── Filter chips ──────────────────────────────────────────────────────
  const activeChip = quickFilter !== 'all' ? quickFilter : (statusFilter || 'all');

  const handleChipClick = (key: string) => {
    if (key === 'mine' || key === 'unassigned') {
      setStatusFilter('');
      setQuickFilter(key as QuickFilter);
    } else {
      setQuickFilter('all');
      setStatusFilter(key === 'all' ? '' : key);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────
  const hasSelection = selected.size > 0;

  return (
    <main className="sd-main">

        {/* Page head */}
        <div className="sd-page-head">
          <h1 className="sd-page-title">{t('service_desk')}</h1>
          <span className="sd-page-meta">
            · {filteredTickets.length}{hasMore ? '+' : ''} tickets
          </span>
          <div className="sd-search sd-page-search">
            <Search size={14} strokeWidth={1.75} />
            <input
              ref={searchRef}
              placeholder="Search tickets, #ID, label…"
              onChange={e => handleSearchChange(e.target.value)}
            />
            <span className="sd-kbd">/</span>
          </div>
          <div className="sd-page-head__actions">
            <button className="sd-btn sd-btn--ghost">
              <SlidersHorizontal size={13} strokeWidth={1.75} /> Columns
            </button>
            <button className="sd-btn sd-btn--primary" onClick={onNewTicket}>
              <Plus size={14} strokeWidth={2} /> New ticket
              <span className="sd-kbd" style={{ marginLeft: 2 }}>c</span>
            </button>
          </div>
        </div>

        {/* Pending new tickets banner */}
        {pendingNew > 0 && (
          <div className="sd-pending-banner">
            <Bell size={13} />
            <span>{pendingNew} new ticket{pendingNew > 1 ? 's' : ''} available</span>
            <button className="sd-pending-banner__refresh"
              onClick={() => { setPendingNew(0); loadTickets(true); }}>
              Refresh
            </button>
            <button className="sd-pending-banner__dismiss" onClick={() => setPendingNew(0)}>
              ×
            </button>
          </div>
        )}

        {/* Toolbar — filter chips OR bulk action bar */}
        {hasSelection ? (
          <div className="sd-toolbar sd-bulkbar">
            <span className="sd-bulk-count">{selected.size} selected</span>

            {/* Assign */}
            <ToolbarDropdown
              open={bulkAction === 'responsible'}
              onClose={closeBulk}
              trigger={
                <button className={`sd-chip${bulkAction === 'responsible' ? ' sd-chip--active' : ''}`}
                  onClick={() => setBulkAction(bulkAction === 'responsible' ? null : 'responsible')}>
                  <UserCheck size={12} /> Assign… <ChevronDown size={11} />
                </button>
              }
            >
              {managers.map(m => (
                <button key={m.user_id}
                  onClick={() => executeBulk('responsible', undefined, undefined, m.user_id)}>
                  {m.display_name}
                </button>
              ))}
              {managers.length === 0 && (
                <span key="empty" className="sd-toolbar-dropdown-empty">No managers found</span>
              )}
            </ToolbarDropdown>

            {/* Set status */}
            <ToolbarDropdown
              open={bulkAction === 'status'}
              onClose={closeBulk}
              trigger={
                <button className={`sd-chip${bulkAction === 'status' ? ' sd-chip--active' : ''}`}
                  onClick={() => setBulkAction(bulkAction === 'status' ? null : 'status')}>
                  <RefreshCw size={12} /> Set status <ChevronDown size={11} />
                </button>
              }
            >
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => executeBulk('status', s)}>
                  <span className={statusPillClass(s)} style={{ height: 18, fontSize: 11, padding: '0 8px' }}>
                    <span>{STATUS_LABELS[s] ?? s}</span>
                  </span>
                </button>
              ))}
            </ToolbarDropdown>

            {/* Add label */}
            <ToolbarDropdown
              open={bulkAction === 'add-label'}
              onClose={closeBulk}
              trigger={
                <button className={`sd-chip${bulkAction === 'add-label' ? ' sd-chip--active' : ''}`}
                  onClick={() => setBulkAction(bulkAction === 'add-label' ? null : 'add-label')}>
                  <Tag size={12} /> Add label <ChevronDown size={11} />
                </button>
              }
            >
              {labels.map(l => (
                <button key={l.id} onClick={() => executeBulk('add-label', undefined, l.id)}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  {l.labelKey}
                </button>
              ))}
            </ToolbarDropdown>

            {/* Remove label */}
            <ToolbarDropdown
              open={bulkAction === 'remove-label'}
              onClose={closeBulk}
              trigger={
                <button className={`sd-chip${bulkAction === 'remove-label' ? ' sd-chip--active' : ''}`}
                  onClick={() => setBulkAction(bulkAction === 'remove-label' ? null : 'remove-label')}>
                  <Tag size={12} /> Remove label <ChevronDown size={11} />
                </button>
              }
            >
              {labels.map(l => (
                <button key={l.id} onClick={() => executeBulk('remove-label', undefined, l.id)}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: l.color, flexShrink: 0 }} />
                  {l.labelKey}
                </button>
              ))}
            </ToolbarDropdown>

            {/* Delete */}
            <button className="sd-chip sd-chip--danger" onClick={executeBulkDelete}>
              <Trash2 size={12} /> Delete
            </button>

            <div className="sd-toolbar__spacer" />
            <button className="sd-chip" onClick={() => { setSelected(new Set()); closeBulk(); }}>
              <X size={12} /> Clear
            </button>
          </div>
        ) : (
          <div className="sd-toolbar">
            {STATUS_CHIPS.map(({ key, label }) => (
              <button
                key={key}
                className={`sd-chip${activeChip === key ? ' sd-chip--active' : ''}`}
                onClick={() => handleChipClick(key)}
              >
                {label}
              </button>
            ))}
            <div className="sd-toolbar__sep" />
            <button
              className={`sd-chip${quickFilter === 'mine' ? ' sd-chip--active' : ''}`}
              onClick={() => handleChipClick('mine')}
            >
              Mine
            </button>
            <button
              className={`sd-chip${quickFilter === 'unassigned' ? ' sd-chip--active' : ''}`}
              onClick={() => handleChipClick('unassigned')}
            >
              Unassigned
            </button>
            <div className="sd-toolbar__sep" />
            <ToolbarDropdown
              open={priorityDropdownOpen}
              onClose={() => setPriorityDropdownOpen(false)}
              trigger={
                <button
                  className={`sd-chip${priorityFilter ? ' sd-chip--active' : ''}`}
                  onClick={() => setPriorityDropdownOpen(o => !o)}
                >
                  {priorityFilter ? `Priority: ${PRIORITY_LABELS[priorityFilter]}` : 'Priority'} <ChevronDown size={11} />
                </button>
              }
            >
              <button key="any" onClick={() => { setPriorityFilter(''); setPriorityDropdownOpen(false); }}>
                Any priority
              </button>
              {PRIORITY_OPTIONS.map(p => (
                <button key={p} onClick={() => { setPriorityFilter(p); setPriorityDropdownOpen(false); }}>
                  <span className={priorityPillClass(p)} style={{ height: 18, fontSize: 11, padding: '0 8px' }}>
                    <span>{PRIORITY_LABELS[p]}</span>
                  </span>
                </button>
              ))}
            </ToolbarDropdown>
            <div className="sd-toolbar__spacer" />
            {templates.length > 0 && (
              <ToolbarDropdown
                open={templateDropdownOpen}
                onClose={() => setTemplateDropdownOpen(false)}
                trigger={
                  <button
                    className={`sd-chip${templateId ? ' sd-chip--active' : ''}`}
                    onClick={() => setTemplateDropdownOpen(o => !o)}
                  >
                    {templateId ? `Template: ${templates.find(t => String(t.id) === templateId)?.name ?? ''}` : 'Template'} <ChevronDown size={11} />
                  </button>
                }
              >
                <button key="any" onClick={() => { setTemplateId(''); setTemplateDropdownOpen(false); }}>
                  Any template
                </button>
                {templates.map(tpl => (
                  <button key={tpl.id} onClick={() => { setTemplateId(String(tpl.id)); setTemplateDropdownOpen(false); }}>
                    {tpl.name}
                  </button>
                ))}
              </ToolbarDropdown>
            )}
          </div>
        )}

        {/* Table */}
        <div className="sd-table-wrap" onScroll={handleTableScroll}>
          {loading ? (
            <div className="sd-loading-inner">
              <div className="sd-spinner" />
              <span>Loading tickets…</span>
            </div>
          ) : (
            <table className="sd-table">
              <colgroup>
                <col className="sd-col-check" />
                <col className="sd-col-id" />
                <col className="sd-col-priority" />
                <col className="sd-col-title" />
                <col className="sd-col-status" />
                <col className="sd-col-labels" />
                <col className="sd-col-assignee" />
                <col className="sd-col-updated" />
                {timerFields.map(tf => <col key={tf.fieldKey} style={{ width: 130 }} />)}
              </colgroup>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      className="sd-check"
                      checked={selected.size === filteredTickets.length && filteredTickets.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>ID</th>
                  <th>Priority</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Labels</th>
                  <th>Assignee</th>
                  <th>Updated</th>
                  {timerFields.map(tf => (
                    <th key={tf.fieldKey}>{tf.fieldKey.replace(/_/g, ' ')}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredTickets.length === 0 && (
                  <tr>
                    <td colSpan={8 + timerFields.length}>
                      <div className="sd-empty">No tickets found</div>
                    </td>
                  </tr>
                )}
                {filteredTickets.map((ticket, i) => (
                  <tr
                    key={ticket.id}
                    className={[
                      selected.has(ticket.id) ? 'is-selected' : '',
                      i === cursor ? 'is-cursor' : '',
                    ].filter(Boolean).join(' ')}
                    onClick={() => onEditTicket(ticket.id)}
                  >
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="sd-check"
                        checked={selected.has(ticket.id)}
                        onChange={() => toggleSelect(ticket.id)}
                      />
                    </td>

                    <td>
                      <span className="sd-cell-id">TT-{ticket.id}</span>
                    </td>

                    <td>
                      <span className={priorityPillClass(ticket.priority)}>
                        <span>{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</span>
                      </span>
                    </td>

                    <td>
                      <div className="sd-title-wrap">
                        <span className="sd-cell-title">{ticket.title}</span>
                        <span className="sd-cell-sub">{ticket.templateName}</span>
                      </div>
                    </td>

                    <td>
                      <span className={statusPillClass(ticket.status)}>
                        <span>{STATUS_LABELS[ticket.status] ?? ticket.status.replace(/_/g, ' ')}</span>
                      </span>
                    </td>

                    <td>
                      <div className="sd-labels">
                        {ticket.labels.slice(0, 2).map(label => (
                          <span
                            key={label.id}
                            className="sd-label"
                            style={{ '--label-dot': label.color } as React.CSSProperties}
                          >
                            {label.labelKey}
                          </span>
                        ))}
                        {ticket.labels.length > 2 && (
                          <span className="sd-labels__more">+{ticket.labels.length - 2}</span>
                        )}
                      </div>
                    </td>

                    <td>
                      {ticket.responsibleUserDisplayName ? (
                        <span className="sd-assignee">
                          <span className="sd-avatar">{initials(ticket.responsibleUserDisplayName)}</span>
                          <span className="sd-assignee__name">{ticket.responsibleUserDisplayName}</span>
                        </span>
                      ) : (
                        <span className="sd-assignee--empty">+ Assign</span>
                      )}
                    </td>

                    <td>
                      <span className="sd-cell-updated">{formatRelativeTime(ticket.updatedAt)}</span>
                    </td>

                    {timerFields.map(tf => (
                      <td key={tf.fieldKey}>
                        <TimerProgressBar value={ticket.ticketData?.[tf.fieldKey]} compact />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {loadingMore && (
            <div className="sd-loading-more">
              <div className="sd-spinner-sm" />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sd-foot">
          <span>
            Showing {filteredTickets.length}{hasMore ? '+' : ''} tickets
          </span>
          <div className="sd-foot__pages">
            <button className="sd-btn sd-btn--ghost" style={{ width: 32, padding: 0, justifyContent: 'center' }}>‹</button>
            <button className="sd-btn sd-btn--ghost" style={{ width: 32, padding: 0, justifyContent: 'center' }}>›</button>
          </div>
        </div>
      </main>
  );
};
