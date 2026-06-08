import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardList, Search } from 'lucide-react';
import api from '../../api';
import { AIStatusIndicator } from './AIStatusIndicator/AIStatusIndicator';
import { isSuperAdmin } from '../../utils/permissions';
import './Topbar.css';

interface TopbarProps {
  user: any;
  onSettingsClick: () => void;
  onTicketListClick?: () => void;
  onMyTicketsClick?: () => void;
  onTicketJump?: (id: number) => void;
}

export const Topbar = ({ user, onSettingsClick, onTicketListClick, onMyTicketsClick, onTicketJump }: TopbarProps) => {
  const { t } = useTranslation();
  const [jumpInput, setJumpInput] = useState('');
  const [jumpError, setJumpError] = useState('');
  const [jumping, setJumping] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user) {
      console.log("Topbar detected user:", user.display_name, "| Super Admin:", isSuperAdmin(user));
    }
  }, [user]);

  const showError = (msg: string) => {
    setJumpError(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setJumpError(''), 3500);
  };

  const handleJump = async () => {
    const raw = jumpInput.replace(/^TT-/i, '').trim();
    const id = parseInt(raw, 10);
    if (!raw || isNaN(id) || id <= 0) { showError('Enter a valid ticket ID'); return; }
    setJumping(true);
    try {
      await api.get(`/tickets/${id}`);
      setJumpInput('');
      setJumpError('');
      onTicketJump!(id);
    } catch (err: any) {
      if (err?.response?.status === 404) showError(`TT-${id} not found`);
      else if (err?.response?.status === 403) showError('Access denied');
      else showError('Error looking up ticket');
    } finally {
      setJumping(false);
    }
  };

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

        {onMyTicketsClick && (
          <div
            className="topbar-icon-btn"
            onClick={onMyTicketsClick}
            title="My Tickets"
          >
            <ClipboardList size={20} />
          </div>
        )}

        {/* Quick ticket jump — shown only when onTicketJump is provided (admin) */}
        {onTicketJump && (
          <div className="topbar-jump-wrap">
            <div className={`topbar-jump-box${jumpError ? ' topbar-jump-error' : ''}`}>
              <span className="topbar-jump-prefix">TT-</span>
              <input
                className="topbar-jump-input"
                placeholder="ID"
                value={jumpInput}
                onChange={e => { setJumpInput(e.target.value); setJumpError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleJump(); }}
                disabled={jumping}
                maxLength={10}
              />
              <button className="topbar-jump-btn" onClick={handleJump} disabled={jumping || !jumpInput.trim()}>
                <Search size={13} />
              </button>
            </div>
            {jumpError && <span className="topbar-jump-err-msg">{jumpError}</span>}
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
