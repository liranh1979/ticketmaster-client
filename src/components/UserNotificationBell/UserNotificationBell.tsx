import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell } from 'lucide-react';
import api from '../../api';
import type { UserNotification } from '../../pages/Tickets/ticketTypes';
import './UserNotificationBell.css';

export const UserNotificationBell = () => {
  const [unread, setUnread]           = useState(0);
  const [open, setOpen]               = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(() => {
    api.get('/notifications/count').then(r => setUnread(r.data.count)).catch(() => {});
  }, []);

  const fetchAll = useCallback(() => {
    api.get('/notifications').then(r => setNotifications(r.data)).catch(() => {});
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
    await api.post('/notifications/read-all').catch(() => {});
    setUnread(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: number) => {
    await api.post(`/notifications/${id}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleItemClick = (n: UserNotification) => {
    markRead(n.id);
    setOpen(false);
    if (n.linkUrl) {
      // No client-side router in this app — a full navigation is required so
      // App.tsx's top-level ?csat= bypass check (which only runs at initial
      // load) picks up CSAT survey links correctly, and it also matches the
      // existing ?ticket= deep-link convention used elsewhere.
      window.location.href = n.linkUrl;
    }
  };

  return (
    <div className="unb-wrap" ref={panelRef}>
      <button
        className={`unb-bell-btn${unread > 0 ? ' unb-bell-active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="unb-badge">{unread > 99 ? '99+' : unread}</span>
        )}
      </button>

      {open && (
        <div className="unb-panel">
          <div className="unb-panel-header">
            <span className="unb-panel-title">Notifications</span>
            {notifications.some(n => !n.isRead) && (
              <button className="unb-mark-all" onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="unb-list">
            {notifications.length === 0 && (
              <div className="unb-empty">No notifications</div>
            )}
            {notifications.map(n => (
              <div
                key={n.id}
                className={`unb-item${n.isRead ? ' unb-item-read' : ''}`}
                onClick={() => handleItemClick(n)}
              >
                <div className="unb-item-dot" style={{ background: n.isRead ? 'transparent' : '#3b82f6' }} />
                <div className="unb-item-body">
                  <div className="unb-item-msg">{n.message}</div>
                  <div className="unb-item-meta">
                    {new Date(n.createdAt).toLocaleString()}
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
