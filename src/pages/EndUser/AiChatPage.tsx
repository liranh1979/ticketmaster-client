import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Send, ArrowLeft, Ticket, CheckCircle } from 'lucide-react';
import api from '../../api';
import './AiChatPage.css';

interface AiChatMessage { id: number; role: string; content: string; createdAt: string; }
interface AiChatSession {
  id: number; title: string | null; status: string;
  sessionType: string; createdAt: string; messages?: AiChatMessage[];
}

interface Props {
  user: any;
  onBack: () => void;
  onTicketCreated: (id: number) => void;
  onSolutionSaved?: () => void;
  sessionType?: string;
  ticketId?: number;
  inline?: boolean;
}

const formatSessionDate = (isoDate: string) => {
  const d = new Date(isoDate);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return d.toLocaleDateString();
};

export const AiChatPage = ({
  onBack, onTicketCreated, onSolutionSaved,
  sessionType = 'user_help', ticketId, inline = false,
}: Props) => {
  const { t } = useTranslation();
  const [sessions, setSessions]         = useState<AiChatSession[]>([]);
  const [activeId, setActiveId]         = useState<number | null>(null);
  const [messages, setMessages]         = useState<AiChatMessage[]>([]);
  const [input, setInput]               = useState('');
  const [sending, setSending]           = useState(false);
  const [escalating, setEscalating]     = useState(false);
  const [escalatedTicketId, setEscalatedTicketId] = useState<number | null>(null);
  const [savedIds, setSavedIds]         = useState<Set<number>>(new Set());
  const [savingId, setSavingId]         = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const isConsult = sessionType === 'ticket_consult';

  const loadSessions = useCallback(async () => {
    if (isConsult && ticketId) {
      const r = await api.get(`/ai-chat/sessions/ticket-consult/${ticketId}`);
      const session: AiChatSession = r.data;
      setSessions([session]);
      setActiveId(session.id);
      setMessages(session.messages ?? []);
    } else {
      const r = await api.get('/ai-chat/sessions', { params: { type: sessionType } });
      setSessions(r.data);
      if (r.data.length > 0) loadSession(r.data[0].id);
    }
  }, [sessionType, ticketId, isConsult]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  const loadSession = async (id: number) => {
    setActiveId(id);
    const r = await api.get(`/ai-chat/sessions/${id}`);
    setMessages(r.data.messages ?? []);
    setEscalatedTicketId(r.data.status === 'escalated' ? r.data.ticketId : null);
  };

  const newSession = async () => {
    const r = await api.post('/ai-chat/sessions', { sessionType, ticketId: ticketId ?? null });
    const session: AiChatSession = r.data;
    setSessions(prev => [session, ...prev]);
    setActiveId(session.id);
    setMessages([]);
    setEscalatedTicketId(null);
    inputRef.current?.focus();
  };

  const send = async () => {
    const content = input.trim();
    if (!content || sending || !activeId) return;

    setInput('');
    setSending(true);

    const optimisticUser: AiChatMessage = {
      id: Date.now(), role: 'user', content, createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimisticUser]);

    try {
      const r = await api.post(`/ai-chat/sessions/${activeId}/messages`, { content });
      const assistantMsg: AiChatMessage = r.data;
      setMessages(prev => [...prev.slice(0, -1), optimisticUser, assistantMsg]);
      setSessions(prev => prev.map(s =>
        s.id === activeId ? { ...s, title: s.title || content.slice(0, 60) } : s
      ));
    } catch {
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setSending(false);
    }
  };

  const escalate = async () => {
    if (!activeId) return;
    setEscalating(true);
    try {
      const r = await api.post(`/ai-chat/sessions/${activeId}/escalate`);
      const newTicketId: number = r.data.ticketId;
      setEscalatedTicketId(newTicketId);
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, status: 'escalated' } : s));
    } catch {
      alert('Failed to create ticket. Please try again.');
    } finally {
      setEscalating(false);
    }
  };

  const saveAsSolution = async (messageId: number, content: string) => {
    if (!ticketId || savingId !== null) return;
    setSavingId(messageId);
    try {
      await api.post(`/tickets/${ticketId}/activity/ai-solution`, { solution: content });
      setSavedIds(prev => new Set([...prev, messageId]));
      onSolutionSaved?.();
    } catch { /* ignore */ }
    finally { setSavingId(null); }
  };

  const aiMessages = messages.filter(m => m.role !== 'system');

  const wrapper = inline ? 'chat-inline' : 'chat-page';

  return (
    <div className={`chat-root ${wrapper}`}>
      {/* Sidebar — hidden in inline/consult mode */}
      {!inline && (
        <aside className="chat-sidebar">
          <div className="chat-sidebar-top">
            <button className="chat-back-btn" onClick={onBack}>
              <ArrowLeft size={15} /> Back
            </button>
            {!isConsult && (
              <button className="chat-new-btn" onClick={newSession}>
                <Plus size={14} /> {t('chat_new_session', { defaultValue: 'New Chat' })}
              </button>
            )}
          </div>

          <div className="chat-session-list">
            {sessions.length === 0 && (
              <p className="chat-no-sessions">No conversations yet</p>
            )}
            {sessions.map(s => (
              <button
                key={s.id}
                className={`chat-session-item${s.id === activeId ? ' chat-session-active' : ''}`}
                onClick={() => loadSession(s.id)}
              >
                <span className="chat-session-title">
                  {s.title || 'New conversation'}
                  {s.status === 'escalated' && <span className="chat-session-badge">ticket</span>}
                </span>
                <span className="chat-session-date">{formatSessionDate(s.createdAt)}</span>
              </button>
            ))}
          </div>
        </aside>
      )}

      {/* Main chat area */}
      <div className="chat-main">
        {/* Header */}
        <div className="chat-header">
          {inline && (
            <button className="chat-close-btn" onClick={onBack}>✕</button>
          )}
          <div className="chat-header-info">
            <span className="chat-header-title">
              {isConsult ? t('ai_consult_title', { defaultValue: 'AI Consultation' }) : 'AI Assistant'}
            </span>
            {isConsult && (
              <span className="chat-saved-indicator">
                <span className="chat-saved-dot" />
                {t('ai_consult_saved', { defaultValue: 'Conversation saved — resume anytime' })}
              </span>
            )}
          </div>
          {!isConsult && activeId && !escalatedTicketId && aiMessages.length >= 2 && (
            <button
              className="chat-escalate-btn"
              onClick={escalate}
              disabled={escalating}
              title={t('chat_escalate_hint', { defaultValue: "AI couldn't fully resolve your issue? Let us open a ticket." })}
            >
              <Ticket size={14} />
              {escalating ? 'Creating…' : t('chat_escalate_btn', { defaultValue: 'Create a Ticket' })}
            </button>
          )}
        </div>

        {/* No active session */}
        {!activeId ? (
          <div className="chat-empty">
            <div className="chat-empty-icon">🤖</div>
            <p>Start a new conversation to get help</p>
            {!isConsult && (
              <button className="chat-new-btn-lg" onClick={newSession}>
                <Plus size={16} /> New Chat
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Messages */}
            <div className="chat-messages">
              {/* Welcome message */}
              {aiMessages.length === 0 && !sending && (
                <div className="chat-message chat-ai">
                  <div className="chat-avatar">AI</div>
                  <div className="chat-bubble">
                    {isConsult
                      ? "I've loaded the ticket context. What would you like to analyze or ask about?"
                      : "Hi! I'm your AI support assistant. How can I help you today?"}
                  </div>
                </div>
              )}

              {aiMessages.map(m => (
                <div key={m.id} className={`chat-message chat-${m.role}`}>
                  {m.role === 'assistant' && <div className="chat-avatar">AI</div>}
                  <div className="chat-message-body">
                    <div className="chat-bubble">
                      {m.content.split('\n').map((line, i) => (
                        <span key={i}>{line}{i < m.content.split('\n').length - 1 && <br />}</span>
                      ))}
                    </div>
                    {isConsult && m.role === 'assistant' && (
                      <button
                        className={`chat-save-solution-btn${savedIds.has(m.id) ? ' saved' : ''}`}
                        onClick={() => saveAsSolution(m.id, m.content)}
                        disabled={savedIds.has(m.id) || savingId !== null}
                      >
                        {savedIds.has(m.id) ? '✓ Saved as AI Solution' : savingId === m.id ? 'Saving…' : '💾 Save as AI Solution'}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {sending && (
                <div className="chat-message chat-assistant">
                  <div className="chat-avatar">AI</div>
                  <div className="chat-bubble chat-typing">
                    <span /><span /><span />
                  </div>
                </div>
              )}

              {/* Escalated banner */}
              {escalatedTicketId && (
                <div className="chat-escalated-banner">
                  <CheckCircle size={16} />
                  <span>{t('chat_escalated_banner', { defaultValue: 'Ticket created from this conversation' })}</span>
                  <button className="chat-view-ticket-btn" onClick={() => onTicketCreated(escalatedTicketId)}>
                    View TT-{escalatedTicketId} →
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            {!escalatedTicketId && (
              <div className="chat-input-bar">
                <textarea
                  ref={inputRef}
                  className="chat-textarea"
                  placeholder={t('chat_send_placeholder', { defaultValue: 'Type a message… (Enter to send)' })}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
                  }}
                  rows={1}
                  disabled={sending}
                />
                <button className="chat-send-btn" onClick={send} disabled={sending || !input.trim()}>
                  <Send size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
