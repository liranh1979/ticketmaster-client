import { useState, useEffect, useCallback } from 'react';
import { PlusCircle, MessageSquare, Maximize2, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RichTextEditor } from '../RichTextEditor/RichTextEditor';
import { ActivityFullScreenModal } from './ActivityFullScreenModal';
import api from '../../api';
import './ActivityLogControl.css';

export interface ActivityEntry {
  id: number;
  ticketId: number;
  actorId: number;
  actorDisplayName?: string;
  operation: string;
  activityType: string;
  changes: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  manual:         '#3b82f6',
  ai:             '#8b5cf6',
  ai_solution:    '#059669',
  email_inbound:  '#0891b2',
  email_outbound: '#d97706',
  field_change:   '#6b7280',
  status_change:  '#dc2626',
  system:         '#9ca3af',
};

const TYPE_LABELS: Record<string, string> = {
  all:            'All',
  manual:         'Note',
  ai:             'AI',
  ai_solution:    'AI Solution',
  email_inbound:  'Email In',
  email_outbound: 'Email Out',
  field_change:   'Changed',
  status_change:  'Status',
  system:         'System',
};

const FILTER_TYPES = ['all', 'manual', 'email_inbound', 'email_outbound', 'ai_solution', 'field_change', 'status_change'];

interface Props {
  ticketId?: number;
  previewMode?: boolean;
  readonly?: boolean;
  user?: any;
  ticketTitle?: string;
  isAdmin?: boolean;
  refreshSignal?: number;
}

export const ActivityLogControl = ({
  ticketId,
  previewMode = false,
  readonly = false,
  user,
  ticketTitle,
  isAdmin = false,
  refreshSignal,
}: Props) => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [totalElements, setTotalElements] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [isAdding, setIsAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [fullScreen, setFullScreen] = useState(false);
  const [sendModal, setSendModal] = useState<ActivityEntry | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const fetchPage = useCallback(async (pageNum: number, type: string, reset: boolean) => {
    if (!ticketId) return;
    if (pageNum > 0) setLoadingMore(true);
    try {
      const res = await api.get(`/tickets/${ticketId}/activity`, {
        params: { page: pageNum, size: 20, type },
      });
      const data = res.data;
      const content: ActivityEntry[] = data.content ?? [];
      setEntries(prev => reset ? content : [...prev, ...content]);
      setTotalElements(data.totalElements ?? 0);
      setHasMore(!data.last);
    } catch { /* ignore */ }
    finally { setLoadingMore(false); }
  }, [ticketId]);

  useEffect(() => {
    if (previewMode) return;
    setPage(0);
    fetchPage(0, activeFilter, true);
  }, [ticketId, activeFilter, previewMode, fetchPage]);

  useEffect(() => {
    if (refreshSignal && refreshSignal > 0 && !previewMode) {
      setPage(0);
      fetchPage(0, activeFilter, true);
    }
  }, [refreshSignal]);

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next, activeFilter, false);
  };

  const submitEntry = async () => {
    if (!ticketId) return;
    const stripped = draft.replace(/<[^>]*>/g, '').trim();
    if (!stripped) return;
    try {
      // Post a manual note via the queue mechanism — for now write direct to activity log
      // (existing ticket patch endpoint doesn't support notes yet, so optimistically add local)
      const newEntry: ActivityEntry = {
        id: Date.now(),
        ticketId,
        actorId: user?.userId ?? 0,
        actorDisplayName: user?.display_name ?? 'You',
        operation: 'NOTE',
        activityType: 'manual',
        changes: { body: draft },
        createdAt: new Date().toISOString(),
      };
      setEntries(prev => [newEntry, ...prev]);
      setTotalElements(t => t + 1);
    } catch { /* ignore */ }
    setDraft('');
    setIsAdding(false);
  };

  const handleSendEmail = async () => {
    if (!sendModal || !ticketId) return;
    setSendingEmail(true);
    setSendResult(null);
    try {
      const res = await api.post(`/tickets/${ticketId}/activity/${sendModal.id}/send-solution-email`);
      setSendResult(res.data);
      if (res.data.success) {
        setTimeout(() => {
          setSendModal(null);
          setSendResult(null);
          setPage(0);
          fetchPage(0, activeFilter, true);
        }, 1800);
      }
    } catch (e: any) {
      setSendResult({ success: false, message: e?.response?.data?.message ?? 'Failed to send email' });
    } finally {
      setSendingEmail(false);
    }
  };

  const getAuthorLabel = (e: ActivityEntry) => {
    if (e.actorDisplayName) return e.actorDisplayName;
    if (e.actorId === 1) return 'System';
    return `User #${e.actorId}`;
  };

  const getEntryContent = (e: ActivityEntry) => {
    if (e.changes?.body) return e.changes.body as string;
    if (e.changes?.solution) return `<p><strong>AI Solution:</strong> ${e.changes.solution}</p>`;
    if (e.changes?.from && e.changes?.subject) {
      return `<p>Email from <strong>${e.changes.from}</strong>: ${e.changes.subject}</p>` +
        (e.changes.body ? `<div>${e.changes.body}</div>` : '');
    }
    if (e.changes?.message) return `<p>${e.changes.message}</p>`;
    return `<p><em>${e.operation}</em></p>`;
  };

  const TypeBadge = ({ type }: { type: string }) => (
    <span className="alc-type-badge" style={{ background: `${TYPE_COLORS[type] ?? '#6b7280'}22`, color: TYPE_COLORS[type] ?? '#6b7280', border: `1px solid ${TYPE_COLORS[type] ?? '#6b7280'}44` }}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );

  const displayedEntries = previewMode ? [
    { id: 1, ticketId: 0, actorId: 0, actorDisplayName: 'Alex Chen', operation: 'NOTE', activityType: 'manual', changes: { body: '<p>Ticket triaged and assigned to support team.</p>' }, createdAt: new Date().toISOString() },
    { id: 2, ticketId: 0, actorId: 0, actorDisplayName: 'System', operation: 'EMAIL_RECEIVED', activityType: 'email_inbound', changes: { from: 'user@example.com', subject: 'Login issue' }, createdAt: new Date().toISOString() },
  ] as ActivityEntry[] : entries;

  return (
    <>
      <div className="alc-container">
        {/* Header bar */}
        <div className="alc-header">
          <div className="alc-header-left">
            <MessageSquare size={15} className="alc-header-icon" />
            <span className="alc-title">{t('ticket_activity_log')}</span>
            {previewMode && <span className="alc-preview-chip">Sample Preview</span>}
            <span className="alc-count-chip">{previewMode ? displayedEntries.length : totalElements}</span>
          </div>
          <div className="alc-header-right">
            {!readonly && !previewMode && (
              <button className="alc-add-btn" onClick={() => setIsAdding(true)} disabled={isAdding}>
                <PlusCircle size={13} /> Add Update
              </button>
            )}
            {ticketId && !previewMode && (
              <button className="alc-expand-btn" onClick={() => setFullScreen(true)} title={t('activity_expand_btn')}>
                <Maximize2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Type filter pills */}
        {!previewMode && (
          <div className="alc-filter-bar">
            {FILTER_TYPES.map(ft => (
              <button
                key={ft}
                className={`alc-filter-pill ${activeFilter === ft ? 'active' : ''}`}
                style={activeFilter === ft && ft !== 'all' ? {
                  background: `${TYPE_COLORS[ft]}22`,
                  color: TYPE_COLORS[ft],
                  borderColor: `${TYPE_COLORS[ft]}44`,
                } : {}}
                onClick={() => setActiveFilter(ft)}
              >
                {TYPE_LABELS[ft]}
              </button>
            ))}
          </div>
        )}

        {/* Inline composer */}
        {isAdding && (
          <div className="alc-composer">
            <div className="alc-composer-avatar" style={{ background: '#3b82f6' }}>
              {user?.display_name?.slice(0, 2).toUpperCase() ?? 'YO'}
            </div>
            <div className="alc-composer-body">
              <RichTextEditor
                content={draft}
                onChange={setDraft}
                placeholder="Write an update, comment, or resolution note..."
              />
              <div className="alc-composer-actions">
                <button className="alc-post-btn" onClick={submitEntry}>Post Update</button>
                <button className="alc-cancel-btn" onClick={() => { setIsAdding(false); setDraft(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {displayedEntries.length === 0 && !isAdding && (
          <div className="alc-empty">
            <MessageSquare size={38} className="alc-empty-icon" />
            <p className="alc-empty-title">No activity yet</p>
            <p className="alc-empty-sub">
              Updates, comments, and resolution notes will appear here as the ticket progresses.
            </p>
            {!readonly && !previewMode && (
              <button className="alc-empty-cta" onClick={() => setIsAdding(true)}>
                <PlusCircle size={13} /> Be the first to add an update
              </button>
            )}
          </div>
        )}

        {/* Timeline */}
        {displayedEntries.length > 0 && (
          <div className="alc-timeline">
            {displayedEntries.map((entry, idx) => (
              <div key={entry.id} className={`alc-entry ${idx === displayedEntries.length - 1 && !hasMore ? 'last' : ''}`}>
                <div className="alc-entry-left">
                  <div className="alc-avatar" style={{ background: TYPE_COLORS[entry.activityType] ?? '#3b82f6' }}>
                    {getAuthorLabel(entry).slice(0, 2).toUpperCase()}
                  </div>
                  {(idx < displayedEntries.length - 1 || hasMore) && <div className="alc-connector" />}
                </div>
                <div className="alc-entry-right">
                  <div className="alc-entry-meta">
                    <span className="alc-entry-author">{getAuthorLabel(entry)}</span>
                    <TypeBadge type={entry.activityType} />
                    <span className="alc-entry-sep">·</span>
                    <span className="alc-entry-time">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                    {isAdmin && entry.activityType === 'ai_solution' && (
                      <button
                        className="alc-send-btn"
                        onClick={() => { setSendModal(entry); setSendResult(null); }}
                        title="Send this AI solution to the ticket requester via email"
                      >
                        <Send size={11} /> Send to User
                      </button>
                    )}
                  </div>
                  <div className="alc-entry-body">
                    <RichTextEditor content={getEntryContent(entry)} editable={false} />
                  </div>
                </div>
              </div>
            ))}

            {hasMore && (
              <div className="alc-load-more">
                <button className="alc-load-more-btn" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : t('activity_load_more')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {fullScreen && ticketId && (
        <ActivityFullScreenModal
          ticketId={ticketId}
          ticketTitle={ticketTitle}
          onClose={() => setFullScreen(false)}
        />
      )}

      {sendModal && (
        <div className="alc-modal-overlay" onClick={() => { if (!sendingEmail) { setSendModal(null); setSendResult(null); } }}>
          <div className="alc-modal" onClick={e => e.stopPropagation()}>
            <h3 className="alc-modal-title">
              <Send size={15} /> Send AI Solution to User
            </h3>
            <p className="alc-modal-desc">
              An email will be sent to the ticket requester with the ticket details and this AI solution:
            </p>
            <div className="alc-modal-preview" dangerouslySetInnerHTML={{ __html: getEntryContent(sendModal) }} />
            {sendResult && (
              <div className={`alc-send-result ${sendResult.success ? 'success' : 'error'}`}>
                {sendResult.message}
              </div>
            )}
            <div className="alc-modal-actions">
              <button
                className="alc-send-confirm-btn"
                onClick={handleSendEmail}
                disabled={sendingEmail || sendResult?.success === true}
              >
                {sendResult?.success ? '✓ Sent!' : sendingEmail ? 'Sending…' : 'Send Email'}
              </button>
              <button
                className="alc-cancel-btn"
                onClick={() => { setSendModal(null); setSendResult(null); }}
                disabled={sendingEmail}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
