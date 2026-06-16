import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, AlertCircle, RefreshCw, MessageSquare, Link2 } from 'lucide-react';
import api from '../../api';
import { TicketFormRenderer } from '../../components/TicketFormRenderer/TicketFormRenderer';
import { isSuperAdmin, hasPermission, PERMISSIONS } from '../../utils/permissions';
import { ActivityLogControl } from '../../components/ActivityLogControl/ActivityLogControl';
import { AiTicketConsultPanel } from '../../components/AiTicketConsultPanel/AiTicketConsultPanel';
import type {
  TicketDetail,
  TemplateTab,
  TicketSseEvent,
} from './ticketTypes';
import { formatRelativeTime } from './ticketTypes';
import './TicketEditPage.css';

interface Props {
  ticketId: number;
  user: any;
  onBack: () => void;
}

interface PresenceUser {
  userId: number;
  displayName: string;
  expiresAt: number;
}

export const TicketEditPage = ({ ticketId, user, onBack }: Props) => {
  const { t } = useTranslation();

  const [ticket, setTicket]         = useState<TicketDetail | null>(null);
  const [layoutTabs, setLayoutTabs] = useState<TemplateTab[]>([]);
  const [values, setValues]         = useState<Record<string, any>>({});
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [isDirty, setIsDirty]       = useState(false);
  const [conflict, setConflict]     = useState<TicketDetail | null>(null);
  const [presenceUsers, setPresenceUsers] = useState<PresenceUser[]>([]);
  const [aiProcessing, setAiProcessing]   = useState(false);
  const [syncedToast, setSyncedToast]     = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [consultOpen, setConsultOpen]     = useState(false);
  const [linkCopied, setLinkCopied]       = useState(false);
  const [solutionSavedCount, setSolutionSavedCount] = useState(0);
  const [saveCount, setSaveCount] = useState(0);

  const autoSaveTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const presencePinger = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef         = useRef<EventSource | null>(null);
  const serverVersion  = useRef(1);

  // Load ticket + template
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data: td }: { data: TicketDetail } = await api.get(`/tickets/${ticketId}`);
        setTicket(td);
        serverVersion.current = td.version;

        // Load template layout
        const { data: tpl } = await api.get(`/templates/${td.templateId}`);
        setLayoutTabs((tpl.layout?.tabs ?? []) as TemplateTab[]);

        // Seed values from ticket
        const vals: Record<string, any> = { ...td.ticketData };
        vals.title       = td.title;
        vals.description = td.description;
        vals.status      = td.status;
        vals.labels      = td.labels.map((l: any) => l.id);
        // Seed request_user from top-level fields if not already in ticketData
        if (!vals.request_user && td.requestUserId) {
          vals.request_user = String(td.requestUserId);
        }
        setValues(vals);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [ticketId]);

  // SSE subscription for real-time updates
  useEffect(() => {
    const es = new EventSource('/api/v1/tickets/stream', { withCredentials: true });
    sseRef.current = es;

    es.addEventListener('ticket-event', (e: MessageEvent) => {
      const event: TicketSseEvent = JSON.parse(e.data);
      if (event.ticketId !== ticketId) return;

      if (event.type === 'AI_PROCESSING') {
        setAiProcessing(true);
      }

      if (event.type === 'TICKET_EDITING' && event.userId !== user?.red_id) {
        const expiresAt = Date.now() + 10000;
        setPresenceUsers(prev => {
          const others = prev.filter(p => p.userId !== event.userId!);
          return [...others, { userId: event.userId!, displayName: event.displayName ?? 'Someone', expiresAt }];
        });
      }

      if (event.type === 'TICKET_PRESENCE_LEFT') {
        setPresenceUsers(prev => prev.filter(p => p.userId !== event.userId));
      }

      if (event.type === 'TICKET_UPDATED') {
        setAiProcessing(false);
        setSaveCount(c => c + 1);
        if (event.newVersion && event.newVersion > serverVersion.current) {
          serverVersion.current = event.newVersion;
          if (!isDirty) {
            // Auto-refresh silently
            api.get(`/tickets/${ticketId}`).then(r => {
              setTicket(r.data);
              const td: TicketDetail = r.data;
              const vals: Record<string, any> = { ...td.ticketData };
              vals.title       = td.title;
              vals.description = td.description;
              vals.status      = td.status;
              vals.labels      = td.labels.map((l: any) => l.id);
              if (!vals.request_user && td.requestUserId) {
                vals.request_user = String(td.requestUserId);
              }
              setValues(vals);
              setSyncedToast(true);
              setTimeout(() => setSyncedToast(false), 3000);
            });
          } else {
            // Show conflict banner with server data
            api.get(`/tickets/${ticketId}`).then(r => setConflict(r.data));
          }
        }
      }
    });

    return () => es.close();
  }, [ticketId, user?.red_id, isDirty]);

  // Expire stale presence entries
  useEffect(() => {
    const interval = setInterval(() => {
      setPresenceUsers(prev => prev.filter(p => p.expiresAt > Date.now()));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Presence ping every 30s
  useEffect(() => {
    if (!user || loading) return;
    const ping = () => api.put(`/tickets/${ticketId}/presence`).catch(() => {});
    ping();
    presencePinger.current = setInterval(ping, 30000);
    return () => {
      if (presencePinger.current) clearInterval(presencePinger.current);
      api.delete(`/tickets/${ticketId}/presence`).catch(() => {});
    };
  }, [ticketId, user, loading]);

  // Keep URL in sync so the ticket is shareable via ?ticket={id}
  useEffect(() => {
    window.history.replaceState(null, '', `?ticket=${ticketId}`);
    return () => { window.history.replaceState(null, '', window.location.pathname); };
  }, [ticketId]);

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}?ticket=${ticketId}`);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const triggerTypingSSE = useCallback(() => {
    api.post(`/tickets/${ticketId}/presence/typing`, {
      displayName: user?.display_name,
    }).catch(() => {});
  }, [ticketId, user]);

  // Auto-save on 15s debounce
  const handleChange = (key: string, val: any) => {
    setValues(prev => ({ ...prev, [key]: val }));
    setIsDirty(true);
    setTouchedFields(prev => new Set([...prev, key]));
    triggerTypingSSE();

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => save(), 15000);
  };

  const save = useCallback(async () => {
    if (!ticket || !isDirty) return;
    setSaving(true);
    try {
      const labelIds = Array.isArray(values.labels)
        ? values.labels.map((l: any) => (typeof l === 'number' ? l : l?.id ?? l))
        : [];

      const { data }: { data: TicketDetail } = await api.patch(`/tickets/${ticketId}`, {
        title:               values.title,
        description:         values.description,
        status:              values.status,
        requestUserId:       values.request_user ? Number(values.request_user) : undefined,
        responsibleUserId:   values.responsible?.id ?? null,
        responsibleGroupId:  null,
        ticketData:          values,
        labelIds,
        version:             serverVersion.current,
      });

      setTicket(data);
      serverVersion.current = data.version;
      setIsDirty(false);
      setConflict(null);
      setTouchedFields(new Set());
      setSaveCount(c => c + 1);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setConflict(err.response.data as TicketDetail);
      }
    } finally {
      setSaving(false);
    }
  }, [ticket, isDirty, values, ticketId]);

  // Conflict resolution: refresh & merge (keep user changes to touched fields)
  const handleMerge = async () => {
    if (!conflict) return;
    const merged: Record<string, any> = { ...conflict.ticketData };
    merged.title       = conflict.title;
    merged.description = conflict.description;
    merged.status      = conflict.status;
    merged.labels      = conflict.labels.map((l: any) => l.id);

    // Restore user's touched fields
    for (const key of touchedFields) {
      merged[key] = values[key];
    }
    serverVersion.current = conflict.version;
    setValues(merged);
    setTicket(conflict);
    setConflict(null);
    setIsDirty(true);
  };

  const handleKeepDraft = () => setConflict(null);

  const handleBack = useCallback(async () => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    await save();
    onBack();
  }, [save, onBack]);

  const isAdmin = isSuperAdmin(user) || hasPermission(user, PERMISSIONS.TICKET_MANAGER);

  if (loading) {
    return (
      <div className="te-page">
        <div className="te-loading">
          <div className="te-spinner" />
        </div>
      </div>
    );
  }

  return (
    <div className="te-page">
      {/* Header */}
      <div className="te-header">
        <button className="te-back-btn" onClick={handleBack}><ArrowLeft size={16} /></button>
        <div className="te-header-center">
          <span className="te-ticket-id">TT-{ticketId}</span>
          <button className="te-copy-link-btn" onClick={copyLink} title="Copy shareable link">
            <Link2 size={13} />
            {linkCopied ? '✓ Copied!' : 'Copy link'}
          </button>
          <span className="te-template-name">{ticket?.templateName}</span>
          <span className="te-updated">{ticket?.updatedAt ? formatRelativeTime(ticket.updatedAt) : ''}</span>
        </div>
        <div className="te-header-right">
          {/* Presence avatars */}
          {presenceUsers.map(p => (
            <div key={p.userId} className="te-presence-avatar" title={p.displayName}>
              {p.displayName.slice(0, 2).toUpperCase()}
            </div>
          ))}
          {presenceUsers.length > 0 && (
            <span className="te-editing-indicator">
              {presenceUsers.map(p => p.displayName).join(', ')} {t('ticket_editing_indicator')}
            </span>
          )}
          {/* AI processing indicator */}
          {aiProcessing && (
            <span className="te-ai-indicator">
              <Sparkles size={13} /> {t('ai_processing_indicator')}
            </span>
          )}
          {/* Save state */}
          {saving && <span className="te-saving">Saving…</span>}
          {!saving && isDirty && (
            <button className="te-save-btn" onClick={save}>Save now</button>
          )}
          {!isDirty && syncedToast && (
            <span className="te-synced-toast">✓ {t('ticket_synced_toast')}</span>
          )}
          {/* AI consult button — admins only */}
          {isAdmin && (
            <button className="te-consult-btn" onClick={() => setConsultOpen(true)}>
              <MessageSquare size={14} /> {t('ai_consult_btn', { defaultValue: 'Consult AI' })}
            </button>
          )}
        </div>
      </div>

      {isAdmin && (
        <AiTicketConsultPanel
          ticketId={ticketId}
          open={consultOpen}
          onClose={() => setConsultOpen(false)}
          onSolutionSaved={() => setSolutionSavedCount(c => c + 1)}
          user={user}
        />
      )}

      {/* Editing indicator bar */}
      {presenceUsers.length > 0 && (
        <div className="te-presence-bar">
          {presenceUsers.map(p => (
            <span key={p.userId} className="te-presence-pill">
              👤 <strong>{p.displayName}</strong> {t('ticket_editing_indicator')}
            </span>
          ))}
        </div>
      )}

      {/* AI processing overlay */}
      {aiProcessing && (
        <div className="te-ai-bar">
          <Sparkles size={14} />
          <span>{t('ai_processing_indicator')}</span>
          <div className="te-ai-bar-spinner" />
        </div>
      )}

      {/* Conflict banner */}
      {conflict && (
        <div className="te-conflict-banner">
          <AlertCircle size={16} />
          <span>{t('ticket_conflict_banner')}</span>
          <div className="te-conflict-actions">
            <button className="te-conflict-btn te-conflict-merge" onClick={handleMerge}>
              <RefreshCw size={12} /> {t('refresh_and_merge')}
            </button>
            <button className="te-conflict-btn" onClick={handleKeepDraft}>
              {t('keep_my_draft')}
            </button>
          </div>
        </div>
      )}

      {/* Form body */}
      <div className="te-body">
        {layoutTabs.length > 0 && (
          <TicketFormRenderer
            tabs={layoutTabs}
            values={values}
            onChange={handleChange}
            isAdmin={isAdmin}
            entityId={ticketId}
          />
        )}

        {/* Activity log section */}
        <div className="te-activity-section">
          <h3 className="te-activity-title">{t('ticket_activity_log')}</h3>
          <ActivityLogControl
            ticketId={ticketId}
            ticketTitle={ticket?.title}
            readonly={false}
            user={user}
            isAdmin={isAdmin}
            refreshSignal={solutionSavedCount + saveCount}
          />
        </div>
      </div>
    </div>
  );
};
