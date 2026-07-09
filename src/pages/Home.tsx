import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Topbar } from '../components/Topbar/Topbar';
import { AppSidebar } from '../components/AppSidebar/AppSidebar';
import { SettingsPage } from './Settings/SettingsPage';
import { TaskProgressPanel } from '../components/TaskProgressPanel/TaskProgressPanel';
import { ServiceDeskPage } from './Tickets/ServiceDeskPage';
import { CreateTicketPage } from './Tickets/CreateTicketPage';
import { TicketEditPage } from './Tickets/TicketEditPage';
import { EndUserPortal } from './EndUser/EndUserPortal';
import { MyTicketsPage } from './EndUser/MyTicketsPage';
import { MyWorkflowItemsPage } from './Workflow/MyWorkflowItemsPage';
import { hasPermission, isSuperAdmin, PERMISSIONS } from '../utils/permissions';
import { TicketsDashboard } from './Dashboards/TicketsDashboard/TicketsDashboard';
import { AboutModal } from '../components/AboutModal/AboutModal';
import api from '../api';

interface HomeProps {
  user: {
    display_name: string;
    red_id: number;
    user_name: string;
    is_super_admin?: boolean;
    effective_permissions?: string[];
  } | null;
  onUserUpdate?: (partial: Record<string, any>) => void;
}

type HomeView = 'welcome' | 'settings' | 'ticket-list' | 'create-ticket' | 'edit-ticket' | 'my-tickets' | 'my-tasks';

export const Home = ({ user, onUserUpdate }: HomeProps) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<HomeView>('welcome');
  const [editTicketId, setEditTicketId] = useState<number | null>(null);
  const [settingsInitialView, setSettingsInitialView] = useState<string>('menu');
  const [ticketCount, setTicketCount] = useState<number | undefined>(undefined);
  const [hasMoreTickets, setHasMoreTickets] = useState(false);
  const [showAbout, setShowAbout] = useState(false);

  const canManageTickets = isSuperAdmin(user) || hasPermission(user, PERMISSIONS.TICKET_MANAGER);
  const isEndUserOnly = !isSuperAdmin(user) && !(user?.effective_permissions?.length);

  const goToDashboard    = () => setCurrentView('welcome');
  const goToTicketList   = () => setCurrentView('ticket-list');
  const goToMyTickets    = () => setCurrentView('my-tickets');
  const goToMyTasks      = () => setCurrentView('my-tasks');
  const goToCreateTicket = () => setCurrentView('create-ticket');
  const goToEditTicket   = (id: number) => { setEditTicketId(id); setCurrentView('edit-ticket'); };

  // Deep-link: ?ticket=NNN
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
    if (params.get('ticket')) return;
    api.get<{ ai_configured: boolean; template_configured: boolean; email_configured: boolean; users_configured: boolean }>('/setup/status')
      .then(r => {
        const s = r.data;
        // ai_configured is no longer a useful "untouched install" signal — Gemma 4 is
        // seeded active on every fresh install (see V67__add_gemma_provider.sql), so it's
        // never false. users_configured (only the seed admin exists) is the fresh-install
        // signal now.
        if (!s.users_configured && !s.template_configured) {
          setSettingsInitialView('setup-guide');
          setCurrentView('settings');
        }
      })
      .catch(() => {});
  }, []);

  if (isEndUserOnly) return <EndUserPortal user={user} onUserUpdate={onUserUpdate} />;

  return (
    <div className="sd-shell">
      <TaskProgressPanel />

      <Topbar
        user={user}
        onUserUpdate={onUserUpdate}
        onTicketJump={canManageTickets ? goToEditTicket : undefined}
      />

      <AppSidebar
        user={user}
        currentView={currentView}
        onNewTicket={goToCreateTicket}
        onDashboard={goToDashboard}
        onServiceDesk={goToTicketList}
        onMyTasks={goToMyTasks}
        onSettings={() => setCurrentView('settings')}
        onAbout={() => setShowAbout(true)}
        ticketCount={ticketCount}
        hasMoreTickets={hasMoreTickets}
      />

      <div className="sd-app-content">
        {currentView === 'welcome' && (
          canManageTickets ? (
            <TicketsDashboard onEditTicket={goToEditTicket} />
          ) : (
            <div className="welcome-screen">
              <div className="welcome-content">
                <div className="welcome-icon">🎫</div>
                <h1 className="welcome-title">{t('welcome_hello')}, {user?.display_name}!</h1>
                <p className="welcome-sub">{t('home_subtitle')}</p>
              </div>
            </div>
          )
        )}

        {currentView === 'ticket-list' && (
          <ServiceDeskPage
            user={user}
            onNewTicket={goToCreateTicket}
            onEditTicket={goToEditTicket}
            onSettings={() => setCurrentView('settings')}
            onMyTasks={goToMyTasks}
            onTicketCountChange={(count, hasMore) => { setTicketCount(count); setHasMoreTickets(hasMore); }}
          />
        )}

        {currentView === 'settings' && (
          <SettingsPage
            user={user}
            initialView={settingsInitialView}
            onNavigate={(view) => setCurrentView(view as any)}
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
            onCloned={goToEditTicket}
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

        {currentView === 'my-tasks' && (
          <MyWorkflowItemsPage
            onBack={() => setCurrentView('welcome')}
            onViewTicket={goToEditTicket}
          />
        )}
      </div>

      {showAbout && <AboutModal onClose={() => setShowAbout(false)} />}
    </div>
  );
};
