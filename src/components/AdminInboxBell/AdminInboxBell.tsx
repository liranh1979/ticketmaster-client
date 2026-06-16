import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import api from '../../api';
import type { AdminNotification } from '../../pages/Tickets/ticketTypes';
import './AdminInboxBell.css';

interface Props {
  onTicketClick?: (id: number) => void;
}

export const AdminInboxBell = ({ onTicketClick }: Props) => {
  const [unread, setUnread]           = useState(0);
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(() => {
    api.get('/admin-inbox/count').then(r => setUnread(r.data.count)).catch(() => {});
  }, []);

  const fetchAll = useCallback(() => {
    api.get('/admin-inbox').then(r => setNotifications(r.data)).catch(() => {});
  }, []);

  // Poll unread count every 30 s
  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, 30_000);
    return () => clearInterval(t);
  }, [fetchCount]);

  // Load full list when panel opens
  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    await api.post('/admin-inbox/read-all').catch(() => {});
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: number) => {
    await api.post(`/admin-inbox/${id}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleTicketClick = (ticketId: number, notifId: number) => {
    markRead(notifId);
    setOpen(false);
    onTicketClick?.(ticketId);
  };

  return (
    <div className="aib-wrap" ref={panelRef}>
      <button
        className={`aib-bell-btn${unread > 0 ? ' aib-bell-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="aib-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="aib-panel">
          <div className="aib-panel-header">
            <span className="aib-panel-title">Notifications</span>
            {notifications.some(n => !n.isRead) && (
              <button className="aib-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="aib-list">
            {notifications.length === 0 && (
              <div className="aib-empty">No notifications</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`aib-item${n.isRead ? ' aib-item-read' : ''}`}
                onClick={() => handleTicketClick(n.ticketId, n.id)}
              >
                <div className="aib-item-dot" style={{ background: n.isRead ? 'transparent' : '#3b82f6' }} />
                <div className="aib-item-body">
                  <div className="aib-item-msg">{n.message}</div>
                  <div className="aib-item-meta">
                    TT-{n.ticketId} • {new Date(n.createdAt).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
