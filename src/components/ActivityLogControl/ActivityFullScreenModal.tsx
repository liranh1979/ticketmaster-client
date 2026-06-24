import { useState, useEffect, useCallback } from 'react';
import { X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { FieldUpdateCard } from './FieldUpdateCard';
import type { ActivityEntry } from './ActivityLogControl';
import { useDateTimeFormatter } from '../../hooks/useDateTimeFormatter';
import api from '../../api';
import './ActivityFullScreenModal.css';

const TYPE_COLORS: Record<string, string> = {
  manual:         '#3b82f6',
  ai:             '#8b5cf6',
  ai_solution:    '#059669',
  email_inbound:  '#0891b2',
  email_outbound: '#d97706',
  field_change:   '#6b7280',
  status_change:  '#dc2626',
  file_attached:  '#0ea5e9',
  system:         '#9ca3af',
};

const TYPE_LABELS: Record<string, string> = {
  manual:         'Note',
  ai:             'AI',
  ai_solution:    'AI Solution',
  email_inbound:  'Email In',
  email_outbound: 'Email Out',
  field_change:   'Changed',
  status_change:  'Status',
  file_attached:  'File',
  system:         'System',
};

const ALL_TYPES = Object.keys(TYPE_LABELS); // order matches TYPE_LABELS declaration

interface Props {
  ticketId: number;
  ticketTitle?: string;
  onClose: () => void;
}

export const ActivityFullScreenModal = ({ ticketId, ticketTitle, onClose }: Props) => {
  const { t } = useTranslation();
  const { formatDateTime } = useDateTimeFormatter();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const activeType = activeTypes.size === 1 ? [...activeTypes][0] : 'all';

  const fetchPage = useCallback(async (pageNum: number, type: string, reset: boolean) => {
    setLoading(true);
    try {
      const res = await api.get(`/tickets/${ticketId}/activity`, {
        params: { page: pageNum, size: 30, type },
      });
      const data = res.data;
      const content: ActivityEntry[] = data.content ?? [];
      setEntries(prev => reset ? content : [...prev, ...content]);
      setTotalElements(data.totalElements ?? 0);
      setHasMore(!data.last);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [ticketId]);

  useEffect(() => {
    setPage(0);
    fetchPage(0, activeType, true);
  }, [activeType, fetchPage]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, activeType, false);
  };

  const toggleType = (type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const filtered = search.trim()
    ? entries.filter(e => {
        const q = search.toLowerCase();
        const body = JSON.stringify(e.changes ?? {}).toLowerCase();
        const author = (e.actorDisplayName ?? '').toLowerCase();
        return body.includes(q) || author.includes(q) || e.activityType.includes(q);
      })
    : entries;

  const getEntryContent = (e: ActivityEntry) => {
    if (e.changes?.body) return e.changes.body as string;
    if (e.changes?.solution) return `<p><strong>AI Solution:</strong> ${e.changes.solution}</p>`;
    if (e.changes?.from && e.changes?.subject) {
      return `<p>Email from <strong>${e.changes.from}</strong>: ${e.changes.subject}</p>` +
        (e.changes.body ? `<div>${e.changes.body}</div>` : '');
    }
    if (e.changes?.filenames) {
      const names = (e.changes.filenames as string[]);
      const items = names.map(n => `<li>📎 ${n}</li>`).join('');
      return `<p>${names.length === 1 ? '1 file attached' : `${names.length} files attached`}:</p><ul>${items}</ul>`;
    }
    if (e.changes?.message) return `<p>${e.changes.message}</p>`;
    return `<p><em>${e.operation}</em></p>`;
  };

  const getAuthorLabel = (e: ActivityEntry) => {
    if (e.actorDisplayName) return e.actorDisplayName;
    if (e.actorId === 1) return 'System';
    return `User #${e.actorId}`;
  };

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="afm-overlay">
      <div className="afm-modal">
        {/* Header */}
        <div className="afm-header">
          <div className="afm-header-left">
            <span className="afm-title">Activity Log</span>
            {ticketTitle && (
              <span className="afm-ticket-ref"> — {ticketTitle} [TT-{ticketId}]</span>
            )}
            <span className="afm-count">{totalElements} entries</span>
          </div>
          <button className="afm-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="afm-body">
          {/* Sidebar */}
          <div className="afm-sidebar">
            <div className="afm-search-box">
              <Search size={13} className="afm-search-icon" />
              <input
                className="afm-search-input"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('activity_search_placeholder')}
              />
            </div>
            <div className="afm-filter-section">
              <span className="afm-filter-label">{t('activity_filter_label')}</span>
              {ALL_TYPES.map(type => (
                <label key={type} className="afm-filter-item">
                  <input
                    type="checkbox"
                    checked={activeTypes.has(type)}
                    onChange={() => toggleType(type)}
                    style={{ accentColor: TYPE_COLORS[type] }}
                  />
                  <span className="afm-filter-dot" style={{ background: TYPE_COLORS[type] }} />
                  <span className="afm-filter-text">{TYPE_LABELS[type]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Main timeline */}
          <div className="afm-main">
            {loading && entries.length === 0 ? (
              <div className="afm-loading">Loading activity...</div>
            ) : filtered.length === 0 ? (
              <div className="afm-empty">No activity found.</div>
            ) : (
              <div className="afm-timeline">
                {filtered.map((entry, idx) => (
                  <div key={entry.id} className={`afm-entry ${idx === filtered.length - 1 ? 'last' : ''}`}>
                    <div className="afm-entry-left">
                      <div className="afm-avatar" style={{ background: TYPE_COLORS[entry.activityType] ?? '#3b82f6' }}>
                        {getAuthorLabel(entry).slice(0, 2).toUpperCase()}
                      </div>
                      {idx < filtered.length - 1 && <div className="afm-connector" />}
                    </div>
                    <div className="afm-entry-right">
                      <div className="afm-entry-meta">
                        <span className="afm-entry-author">{getAuthorLabel(entry)}</span>
                        <span className="afm-type-badge"
                          style={{
                            background: `${TYPE_COLORS[entry.activityType] ?? '#6b7280'}22`,
                            color: TYPE_COLORS[entry.activityType] ?? '#6b7280',
                            border: `1px solid ${TYPE_COLORS[entry.activityType] ?? '#6b7280'}44`,
                          }}>
                          {TYPE_LABELS[entry.activityType] ?? entry.activityType}
                        </span>
                        <span className="afm-entry-time">
                          {formatDateTime(entry.createdAt)}
                        </span>
                      </div>
                      <div className={`afm-entry-body${entry.operation === 'FIELD_UPDATE' ? ' afm-entry-body--bare' : ''}`}>
                        {entry.operation === 'FIELD_UPDATE'
                          ? <FieldUpdateCard changes={entry.changes} />
                          : <RichTextEditor content={getEntryContent(entry)} editable={false} />
                        }
                      </div>
                    </div>
                  </div>
                ))}

                {hasMore && !search.trim() && (
                  <div className="afm-load-more">
                    <button className="afm-load-more-btn" onClick={handleLoadMore} disabled={loading}>
                      {loading ? 'Loading...' : t('activity_load_more')}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
