import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList } from 'lucide-react';
import api from '../../api';
import { AIStatusIndicator } from './AIStatusIndicator/AIStatusIndicator';
import { isSuperAdmin } from '../../utils/permissions';
import './Topbar.css';

interface TopbarProps {
  user: any;
  onSettingsClick: () => void;
  onTicketListClick?: () => void;
}

export const Topbar = ({ user, onSettingsClick, onTicketListClick }: TopbarProps) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (user) {
      console.log("Topbar detected user:", user.display_name, "| Super Admin:", isSuperAdmin(user));
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      window.location.reload();
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <img src="/logo.png" alt="TicketMaster" className="small-logo" />
      </div>

      <div className="topbar-right">
        {isSuperAdmin(user) && <AIStatusIndicator />}

        <span className="user-greeting">
          {t('welcome_hello')}, <strong>{user?.display_name || 'Guest'}</strong>
        </span>

        {onTicketListClick && (
          <div
            className="topbar-icon-btn"
            onClick={onTicketListClick}
            title={t('all_tickets')}
          >
            <ClipboardList size={20} />
          </div>
        )}

        <div
          className="settings-container"
          onClick={onSettingsClick}
          title={t('settings_tooltip')}
        >
          <img src="/settings.png" alt="Settings" className="settings-icon" />
        </div>

        <button onClick={handleLogout} className="btn-logout">
          {t('logout_btn')}
        </button>
      </div>
    </header>
  );
};
