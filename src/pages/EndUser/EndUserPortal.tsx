import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageSquare, ClipboardList, Plus, LogOut, CheckSquare } from 'lucide-react';
import api from '../../api';
import { AiChatPage } from './AiChatPage';
import { MyTicketsPage } from './MyTicketsPage';
import { MyWorkflowItemsPage } from '../Workflow/MyWorkflowItemsPage';
import { CreateTicketPage } from '../Tickets/CreateTicketPage';
import { TicketEditPage } from '../Tickets/TicketEditPage';
import { formatRelativeTime } from '../Tickets/ticketTypes';
import './EndUserPortal.css';

type PortalView = 'home' | 'ai-chat' | 'my-tickets' | 'create-ticket' | 'view-ticket' | 'my-tasks';

interface RecentTicket { id: number; title: string; status: string; updatedAt: string; }

interface Props { user: any; }

const STATUS_COLORS: Record<string, string> = {
  new: '#6366f1', open: '#3b82f6', in_progress: '#f59e0b',
  waiting: '#8b5cf6', resolved: '#10b981', closed: '#64748b',
};

export const EndUserPortal = ({ user }: Props) => {
  const { t } = useTranslation();
  const [view, setView]           = useState<PortalView>('home');
  const [viewTicketId, setViewTicketId] = useState<number | null>(null);
  const [recentTickets, setRecentTickets] = useState<RecentTicket[]>([]);

  useEffect(() => {
    if (view !== 'home') return;
    api.get('/tickets', { params: { size: 5 } })
      .then(r => setRecentTickets(r.data.slice(0, 5)))
      .catch(() => {});
  }, [view]);

  // Deep-link: ?ticket=NNN
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('ticket');
    if (ticketParam) {
      const id = parseInt(ticketParam, 10);
      if (!isNaN(id) && id > 0) openTicket(id);
    }
  }, []);

  const openTicket = (id: number) => { setViewTicketId(id); setView('view-ticket'); };

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    window.location.reload();
  };

  if (view === 'ai-chat') {
    return <AiChatPage user={user} onBack={() => setView('home')} onTicketCreated={openTicket} />;
  }

  if (view === 'my-tickets') {
    return (
      <MyTicketsPage
        user={user}
        onBack={() => setView('home')}
        onNewTicket={() => setView('create-ticket')}
        onViewTicket={openTicket}
      />
    );
  }

  if (view === 'create-ticket') {
    return (
      <CreateTicketPage
        user={user}
        onBack={() => setView('home')}
        onCreated={() => setView('my-tickets')}
      />
    );
  }

  if (view === 'my-tasks') {
    return (
      <MyWorkflowItemsPage
        onBack={() => setView('home')}
        onViewTicket={openTicket}
      />
    );
  }

  if (view === 'view-ticket' && viewTicketId !== null) {
    return (
      <TicketEditPage
        ticketId={viewTicketId}
        user={user}
        onBack={() => setView('my-tickets')}
      />
    );
  }

  return (
    <div className="eu-root">
      {/* Topbar */}
      <header className="eu-topbar">
        <div className="eu-topbar-logo">
          <img src="/logo.png" alt="Logo" className="eu-logo-img" />
        </div>
        <nav className="eu-topbar-nav">
          <button className="eu-nav-btn" onClick={() => setView('ai-chat')}>
            <MessageSquare size={16} /> {t('eu_chat_btn', { defaultValue: 'Chat with AI' })}
          </button>
          <button className="eu-nav-btn" onClick={() => setView('my-tickets')}>
            <ClipboardList size={16} /> {t('eu_my_tickets_btn', { defaultValue: 'My Tickets' })}
          </button>
          <button className="eu-nav-btn" onClick={() => setView('my-tasks')}>
            <CheckSquare size={16} /> My Tasks
          </button>
        </nav>
        <div className="eu-topbar-right">
          <span className="eu-greeting">👋 {user?.display_name}</span>
          <button className="eu-logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Hero */}
      <main className="eu-main">
        <div className="eu-hero">
          <div className="eu-hero-glow" />
          <p className="eu-hero-eyebrow">Service Desk</p>
          <h1 className="eu-hero-title">
            {t('eu_portal_welcome', { defaultValue: 'How can we help you?' })}
          </h1>
          <p className="eu-hero-sub">
            {t('eu_portal_subtitle', { defaultValue: 'Chat with our AI or create a support ticket.' })}
          </p>

          {/* Action Cards */}
          <div className="eu-action-grid">
            <button className="eu-action-card eu-action-primary" onClick={() => setView('ai-chat')}>
              <div className="eu-action-icon">🤖</div>
              <div className="eu-action-label">{t('eu_chat_btn', { defaultValue: 'Chat with AI' })}</div>
              <div className="eu-action-desc">Describe your problem and get instant help</div>
            </button>

            <button className="eu-action-card" onClick={() => setView('my-tickets')}>
              <div className="eu-action-icon">📋</div>
              <div className="eu-action-label">{t('eu_my_tickets_btn', { defaultValue: 'My Tickets' })}</div>
              <div className="eu-action-desc">View and track your open requests</div>
            </button>

            <button className="eu-action-card" onClick={() => setView('create-ticket')}>
              <div className="eu-action-icon"><Plus size={28} /></div>
              <div className="eu-action-label">{t('eu_new_ticket_btn', { defaultValue: 'New Ticket' })}</div>
              <div className="eu-action-desc">Open a new support request manually</div>
            </button>
          </div>
        </div>

        {/* Recent Tickets */}
        {recentTickets.length > 0 && (
          <section className="eu-recent">
            <div className="eu-recent-header">
              <h2 className="eu-recent-title">Recent Tickets</h2>
              <button className="eu-recent-all" onClick={() => setView('my-tickets')}>
                View all →
              </button>
            </div>
            <div className="eu-recent-list">
              {recentTickets.map(ticket => (
                <button key={ticket.id} className="eu-recent-row" onClick={() => openTicket(ticket.id)}>
                  <span className="eu-recent-id">TT-{ticket.id}</span>
                  <span className="eu-recent-title-text">{ticket.title}</span>
                  <span
                    className="eu-recent-status"
                    style={{ background: STATUS_COLORS[ticket.status] + '22', color: STATUS_COLORS[ticket.status] }}
                  >
                    {ticket.status.replace(/_/g, ' ')}
                  </span>
                  <span className="eu-recent-time">{formatRelativeTime(ticket.updatedAt)}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
};
