import { useTranslation } from 'react-i18next';
import { LayoutDashboard, Inbox, Plus, CheckSquare, Settings, Info, BookOpen } from 'lucide-react';
import { isSuperAdmin, hasPermission, PERMISSIONS } from '../../utils/permissions';
import './AppSidebar.css';

type HomeView = 'welcome' | 'settings' | 'ticket-list' | 'create-ticket' | 'edit-ticket' | 'my-tickets' | 'my-tasks' | 'action-item' | 'knowledge-base' | 'kb-categories';

interface Props {
  user: any;
  currentView: HomeView;
  onNewTicket: () => void;
  onDashboard: () => void;
  onServiceDesk: () => void;
  onMyTasks?: () => void;
  onKnowledgeBase?: () => void;
  onSettings: () => void;
  onAbout?: () => void;
  ticketCount?: number;
  hasMoreTickets?: boolean;
}

export const AppSidebar = ({
  user,
  currentView,
  onNewTicket,
  onDashboard,
  onServiceDesk,
  onMyTasks,
  onKnowledgeBase,
  onSettings,
  onAbout,
  ticketCount,
  hasMoreTickets,
}: Props) => {
  const { t } = useTranslation();
  const canTickets = isSuperAdmin(user) || hasPermission(user, PERMISSIONS.TICKET_MANAGER);

  const inDesk = currentView === 'ticket-list' || currentView === 'edit-ticket' || currentView === 'create-ticket';

  return (
    <aside className="sd-sidebar">
      <nav>
        <div className="sd-nav__label">Workspace</div>

        {canTickets && (
          <button
            className={`sd-nav__item${currentView === 'welcome' ? ' sd-nav__item--active' : ''}`}
            onClick={onDashboard}
          >
            <LayoutDashboard size={15} strokeWidth={1.75} />
            {t('dashboard_nav_item', { defaultValue: 'Dashboard' })}
          </button>
        )}

        {canTickets && (
          <button
            className={`sd-nav__item${inDesk ? ' sd-nav__item--active' : ''}`}
            onClick={onServiceDesk}
          >
            <Inbox size={15} strokeWidth={1.75} />
            {t('service_desk')}
            {ticketCount != null && inDesk && (
              <span className="sd-nav__count">{ticketCount}{hasMoreTickets ? '+' : ''}</span>
            )}
          </button>
        )}

        {onMyTasks && (
          <button
            className={`sd-nav__item${currentView === 'my-tasks' ? ' sd-nav__item--active' : ''}`}
            onClick={onMyTasks}
          >
            <CheckSquare size={15} strokeWidth={1.75} />
            My Tasks
          </button>
        )}

        {onKnowledgeBase && (
          <button
            className={`sd-nav__item${(currentView === 'knowledge-base' || currentView === 'kb-categories') ? ' sd-nav__item--active' : ''}`}
            onClick={onKnowledgeBase}
          >
            <BookOpen size={15} strokeWidth={1.75} />
            {t('kb_nav_item', { defaultValue: 'Knowledge Base' })}
          </button>
        )}

        <button
          className={`sd-nav__item${currentView === 'settings' ? ' sd-nav__item--active' : ''}`}
          onClick={onSettings}
        >
          <Settings size={15} strokeWidth={1.75} />
          {t('settings') || 'Settings'}
        </button>
      </nav>

      {canTickets && (
        <div className="sd-sidebar__foot">
          <button className="sd-new-ticket-btn" onClick={onNewTicket}>
            <Plus size={14} strokeWidth={2} />
            {t('new_ticket')}
          </button>
        </div>
      )}

      <div className="sd-sidebar__about">
        <button className="sd-sidebar__about-btn" onClick={onAbout}>
          <Info size={13} strokeWidth={1.6} />
          {t('about_btn')}
        </button>
      </div>
    </aside>
  );
};
