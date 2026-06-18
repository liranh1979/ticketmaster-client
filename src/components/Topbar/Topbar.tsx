import { useRef, useState } from 'react';
import { Search, LogOut } from 'lucide-react';
import api from '../../api';
import { AIStatusIndicator } from './AIStatusIndicator/AIStatusIndicator';
import { AdminInboxBell } from '../AdminInboxBell/AdminInboxBell';
import { isSuperAdmin } from '../../utils/permissions';
import './Topbar.css';

interface TopbarProps {
  user: any;
  onTicketJump?: (id: number) => void;
}

function initials(name: string = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase() || '?';
}

export const Topbar = ({ user, onTicketJump }: TopbarProps) => {
  const [jumpInput, setJumpInput] = useState('');
  const [jumpError, setJumpError] = useState('');
  const [jumping, setJumping] = useState(false);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    try { await api.post('/auth/logout'); } catch {}
    window.location.reload();
  };

  return (
    <header className="sd-header">
      <div className="sd-logo">
        <span className="sd-logo__mark" aria-hidden />
        <span>TurboTickets</span>
      </div>

      <div className="sd-header__right">
        {isSuperAdmin(user) && <AIStatusIndicator />}
        {onTicketJump && <AdminInboxBell onTicketClick={onTicketJump} />}

        {onTicketJump && (
          <div className="tb-jump-wrap">
            <div className={`tb-jump-box${jumpError ? ' tb-jump-box--error' : ''}`}>
              <span className="tb-jump-prefix">TT-</span>
              <input
                className="tb-jump-input"
                placeholder="ID"
                value={jumpInput}
                onChange={e => { setJumpInput(e.target.value); setJumpError(''); }}
                onKeyDown={e => { if (e.key === 'Enter') handleJump(); }}
                disabled={jumping}
                maxLength={10}
              />
              <button className="tb-jump-btn" onClick={handleJump} disabled={jumping || !jumpInput.trim()}>
                <Search size={13} />
              </button>
            </div>
            {jumpError && <span className="tb-jump-err">{jumpError}</span>}
          </div>
        )}

        <div className="sd-user" onClick={handleLogout} title="Logout">
          <div className="sd-avatar">{initials(user?.display_name)}</div>
          <span className="sd-user-name">{user?.display_name}</span>
          <LogOut size={13} strokeWidth={1.75} style={{ color: 'var(--sd-fg-subtle)' }} />
        </div>
      </div>
    </header>
  );
};
