import { useEffect, useState, useCallback } from 'react';
import api from '../../api';
import './AnnouncementBanner.css';

interface Announcement {
  id: number;
  severity: string;
  severityLabel: string;
  severityColor: string;
  severityIcon: string | null;
  title: string;
  message: string;
  showOnPortal: boolean;
  showOnTicketCreate: boolean;
  showOnAgentDashboard: boolean;
  createdByName: string | null;
  createdAt: string;
}

type Placement = 'portal' | 'ticket-create' | 'agent-dashboard';

const COLOR_CLASS: Record<string, string> = {
  critical: 'ann-critical',
  high: 'ann-high',
  medium: 'ann-medium',
  low: 'ann-low',
  info: 'ann-info',
  neutral: 'ann-neutral',
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

export const AnnouncementBanner = ({ placement }: { placement: Placement }) => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  const fetchActive = useCallback(() => {
    api.get<Announcement[]>('/announcements-public/active')
      .then(r => setAnnouncements(r.data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchActive();
    const t = setInterval(fetchActive, 60_000);
    window.addEventListener('focus', fetchActive);
    return () => {
      clearInterval(t);
      window.removeEventListener('focus', fetchActive);
    };
  }, [fetchActive]);

  const visible = announcements.filter(a => {
    if (placement === 'portal') return a.showOnPortal;
    if (placement === 'ticket-create') return a.showOnTicketCreate;
    return a.showOnAgentDashboard;
  });

  if (visible.length === 0) return null;

  return (
    <div className="ann-banner-stack">
      {visible.map(a => (
        <div key={a.id} className={`ann-banner ${COLOR_CLASS[a.severityColor] ?? 'ann-neutral'}`}>
          <div className="ann-icon">{a.severityIcon || '●'}</div>
          <div className="ann-content">
            <div className="ann-title">{a.severityLabel}: {a.title}</div>
            <div className="ann-body">{a.message}</div>
            <div className="ann-meta">
              {a.createdByName ? `Posted by: ${a.createdByName} · ` : ''}{timeAgo(a.createdAt)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
