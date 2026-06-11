import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Topbar } from '../components/Topbar/Topbar';
import { AppSidebar } from '../components/AppSidebar/AppSidebar';
import { SettingsPage } from './Settings/SettingsPage';
import { TaskProgressPanel } from '../components/TaskProgressPanel/TaskProgressPanel';
import { TicketListPage } from './Tickets/TicketListPage';
import { CreateTicketPage } from './Tickets/CreateTicketPage';
import { TicketEditPage } from './Tickets/TicketEditPage';
import { EndUserPortal } from './EndUser/EndUserPortal';
import { MyTicketsPage } from './EndUser/MyTicketsPage';
import { hasPermission, isSuperAdmin, PERMISSIONS } from '../utils/permissions';
import api from '../api';

interface HomeProps {
  user: {
    display_name: string;
    red_id: number;
    user_name: string;
    is_super_admin?: boolean;
    effective_permissions?: string[];
  } | null;
}

type HomeView = 'welcome' | 'settings' | 'ticket-list' | 'create-ticket' | 'edit-ticket' | 'my-tickets';

export const Home = ({ user }: HomeProps) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<HomeView>('welcome');
  const [editTicketId, setEditTicketId] = useState<number | null>(null);
  const [settingsInitialView, setSettingsInitialView] = useState<string>('menu');

  const canManageTickets = isSuperAdmin(user) || hasPermission(user, PERMISSIONS.TICKET_MANAGER);

  // End users (no permissions, not super admin) get the self-contained portal
  const isEndUserOnly = !isSuperAdmin(user) && !(user?.effective_permissions?.length);

  const goToTicketList   = () => setCurrentView('ticket-list');
  const goToMyTickets    = () => setCurrentView('my-tickets');
  const goToCreateTicket = () => setCurrentView('create-ticket');
  const goToEditTicket   = (id: number) => { setEditTicketId(id); setCurrentView('edit-ticket'); };

  // Deep-link: ?ticket=NNN — admin path only (end users handled inside EndUserPortal)
  useEffect(() => {
    if (isEndUserOnly) return;
    const params = new URLSearchParams(window.location.search);
    const ticketParam = params.get('ticket');
    if (ticketParam) {
      const id = parseInt(ticketParam, 10);
      if (!isNaN(id) && id > 0) goToEditTicket(id);
    }
  }, []);

  // Auto-open Setup Guide for super admins on a fresh unconfigured system
  useEffect(() => {
    if (!isSuperAdmin(user)) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('ticket')) return; // deep-link takes priority
    api.get<{ ai_configured: boolean; template_configured: boolean; email_configured: boolean; users_configured: boolean }>('/setup/status')
      .then(r => {
        const s = r.data;
        if (!s.ai_configured && !s.template_configured) {
          setSettingsInitialView('setup-guide');
          setCurrentView('settings');
        }
      })
      .catch(() => {});
  }, []);

  if (isEndUserOnly) return <EndUserPortal user={user} />;

  return (
    <div className="app-layout">
      <Topbar
        user={user}
        onSettingsClick={() => setCurrentView('settings')}
        onTicketListClick={canManageTickets ? goToTicketList : undefined}
        onMyTicketsClick={!canManageTickets ? goToMyTickets : undefined}
        onTicketJump={canManageTickets ? goToEditTicket : undefined}
      />

      <div className="app-body">
        <AppSidebar
          user={user}
          currentView={currentView}
          onNewTicket={goToCreateTicket}
          onServiceDesk={goToTicketList}
        />

        <div className="app-main">
          <TaskProgressPanel />

          {currentView === 'welcome' && (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div className="welcome-icon">🎫</div>
                <h1 className="welcome-title">{t('welcome_hello')}, {user?.display_name}!</h1>
                <p className="welcome-sub">{t('home_subtitle')}</p>
                {canManageTickets && (
                  <button className="welcome-cta" onClick={goToTicketList}>
                    {t('all_tickets')} →
                  </button>
                )}
              </div>
            </div>
          )}

          {currentView === 'settings' && (
            <SettingsPage
              user={user}
              initialView={settingsInitialView}
              onNavigate={(view) => setCurrentView(view as any)}
            />
          )}

          {currentView === 'ticket-list' && (
            <TicketListPage
              user={user}
              onNewTicket={goToCreateTicket}
              onEditTicket={goToEditTicket}
            />
          )}

          {currentView === 'create-ticket' && (
            <CreateTicketPage
              user={user}
              onBack={goToTicketList}
              onCreated={goToTicketList}
            />
          )}

          {currentView === 'edit-ticket' && editTicketId !== null && (
            <TicketEditPage
              ticketId={editTicketId}
              user={user}
              onBack={canManageTickets ? goToTicketList : goToMyTickets}
            />
          )}

          {currentView === 'my-tickets' && (
            <MyTicketsPage
              user={user}
              onBack={() => setCurrentView('welcome')}
              onNewTicket={goToCreateTicket}
              onViewTicket={goToEditTicket}
            />
          )}
        </div>
      </div>
    </div>
  );
};
