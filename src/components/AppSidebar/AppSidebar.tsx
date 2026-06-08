import { useTranslation } from 'react-i18next';
import { ClipboardList, Plus } from 'lucide-react';
import { isSuperAdmin, hasPermission, PERMISSIONS } from '../../utils/permissions';
import './AppSidebar.css';

type HomeView = 'welcome' | 'settings' | 'ticket-list' | 'create-ticket' | 'edit-ticket' | 'my-tickets';

interface Props {
  user: any;
  currentView: HomeView;
  onNewTicket: () => void;
  onServiceDesk: () => void;
}

export const AppSidebar = ({ user, currentView, onNewTicket, onServiceDesk }: Props) => {
  const { t } = useTranslation();
  const canTickets = isSuperAdmin(user) || hasPermission(user, PERMISSIONS.TICKET_MANAGER);

  if (!canTickets) return null;

  const inDesk = currentView === 'ticket-list' || currentView === 'edit-ticket';

  return (
    <nav className="app-sidebar">
      <button
        className={`asb-item${inDesk ? ' asb-item-active' : ''}`}
        onClick={onServiceDesk}
      >
        <ClipboardList size={17} />
        <span>{t('service_desk')}</span>
      </button>

      <button
        className={`asb-item asb-new-btn${currentView === 'create-ticket' ? ' asb-new-btn-active' : ''}`}
        onClick={onNewTicket}
      >
        <Plus size={17} />
        <span>{t('new_ticket')}</span>
      </button>
    </nav>
  );
};
