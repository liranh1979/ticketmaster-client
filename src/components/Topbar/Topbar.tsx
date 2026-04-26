import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { AIStatusIndicator } from './AIStatusIndicator/AIStatusIndicator';
import './Topbar.css';

interface TopbarProps {
  user: any;
  onSettingsClick: () => void; 
}

export const Topbar = ({ user, onSettingsClick }: TopbarProps) => {
  const { t } = useTranslation();

  // Logic: Check if the user is a super admin based on your DB column (TINYINT 1/0)
  const isSuperAdmin = !!user?.is_super_admin;

  // Debugging: This will run every time the 'user' prop changes
  useEffect(() => {
    if (user) {
      console.log("Topbar detected user:", user.display_name, "| Admin Status:", isSuperAdmin);
    }
  }, [user, isSuperAdmin]);

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout');
      // Full reload to clear all states/caches
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
        {/* The AI Status Indicator will only render if user exists AND is_super_admin is 1 */}
        {isSuperAdmin && <AIStatusIndicator />}

        <span className="user-greeting">
          {t('welcome_hello')}, <strong>{user?.display_name || 'Guest'}</strong>
        </span>

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