import { useTranslation } from 'react-i18next';
import api from '../../api';
import './Topbar.css';

// 1. Add 'onSettingsClick' to the interface
interface TopbarProps {
  user: any;
  onSettingsClick: () => void; 
}

// 2. Destructure 'onSettingsClick' from the props
export const Topbar = ({ user, onSettingsClick }: TopbarProps) => {
  const { t } = useTranslation();

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
        <span className="user-greeting">
          {t('welcome_hello')}, <strong>{user?.display_name}</strong>
        </span>

        {/* 3. Attach the function to the onClick event of the gear icon */}
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
