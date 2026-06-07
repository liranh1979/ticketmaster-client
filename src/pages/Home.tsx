import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Topbar } from '../components/Topbar/Topbar';
import { AppSidebar } from '../components/AppSidebar/AppSidebar';
import { SettingsPage } from './Settings/SettingsPage';
import { TaskProgressPanel } from '../components/TaskProgressPanel/TaskProgressPanel';
import { TicketListPage } from './Tickets/TicketListPage';
import { CreateTicketPage } from './Tickets/CreateTicketPage';
import { TicketEditPage } from './Tickets/TicketEditPage';
import { hasPermission, isSuperAdmin, PERMISSIONS } from '../utils/permissions';

interface HomeProps {
  user: {
    display_name: string;
    red_id: number;
    user_name: string;
    is_super_admin?: boolean;
    effective_permissions?: string[];
  } | null;
}

type HomeView = 'welcome' | 'settings' | 'ticket-list' | 'create-ticket' | 'edit-ticket';

export const Home = ({ user }: HomeProps) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<HomeView>('welcome');
  const [editTicketId, setEditTicketId] = useState<number | null>(null);

  const canManageTickets = isSuperAdmin(user) || hasPermission(user, PERMISSIONS.TICKET_MANAGER);

  const goToTicketList   = () => setCurrentView('ticket-list');
  const goToCreateTicket = () => setCurrentView('create-ticket');
  const goToEditTicket   = (id: number) => { setEditTicketId(id); setCurrentView('edit-ticket'); };

  return (
    <div className="app-layout">
      <Topbar
        user={user}
        onSettingsClick={() => setCurrentView('settings')}
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
            <SettingsPage user={user} onNavigate={(view) => setCurrentView(view as any)} />
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
              onBack={goToTicketList}
            />
          )}
        </div>
      </div>
    </div>
  );
};
