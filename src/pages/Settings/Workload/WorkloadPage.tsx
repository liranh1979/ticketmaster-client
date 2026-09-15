import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import api from '../../../api';
import { RoutingSuggestionCard } from '../../../components/RoutingSuggestionCard/RoutingSuggestionCard';
import type { RoutingSuggestion } from '../../../components/RoutingSuggestionCard/RoutingSuggestionCard';
import './WorkloadPage.css';

// Agent Queue Management: agent grid (open-ticket count per group member) + Tier 2 "AI Rebalance
// Suggestions" panel. Gated by TICKET_MANAGER (checked by SettingsPage.tsx; the backend
// independently enforces it too). See V2/Agent Queue Management/03-mockup-queues-workload.html.

interface WorkloadEntry { userId: number; displayName: string; openTicketCount: number; overloaded: boolean; }
interface Group { id: number; display_name: string; }
interface Queue { id: number; name: string; ownerType: 'user' | 'group'; ownerId: number; }

export const WorkloadPage = () => {
  const { t } = useTranslation();
  const [groups, setGroups] = useState<Group[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [entries, setEntries] = useState<WorkloadEntry[]>([]);
  const [suggestions, setSuggestions] = useState<RoutingSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  // GET /groups requires MANAGE_GROUPS, which a plain TICKET_MANAGER holder (the population this
  // page is actually gated for) very often doesn't also have — found live while testing as a
  // TICKET_MANAGER-only user, whose group dropdown came back silently empty. Derive the candidate
  // group list from /queues instead: any team queue the caller can already see (group-membership-
  // scoped, no extra permission) names a real group they have legitimate reason to view workload
  // for.
  useEffect(() => {
    api.get<Queue[]>('/queues').then(r => {
      const teamGroups = r.data
        .filter(q => q.ownerType === 'group')
        .map(q => ({ id: q.ownerId, display_name: q.name }));
      const deduped = Array.from(new Map(teamGroups.map(g => [g.id, g])).values());
      setGroups(deduped);
      if (deduped.length > 0) setGroupId(deduped[0].id);
    }).catch(() => {});
  }, []);

  const fetchAll = async (gid: number) => {
    setLoading(true);
    try {
      const [wl, sug] = await Promise.all([
        api.get<WorkloadEntry[]>('/agents/workload', { params: { groupId: gid } }),
        api.get<RoutingSuggestion[]>('/routing-suggestions', { params: { type: 'rebalance' } }),
      ]);
      setEntries(wl.data);
      setSuggestions(sug.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (groupId != null) fetchAll(groupId); /* eslint-disable-next-line */ }, [groupId]);

  const maxCount = Math.max(1, ...entries.map(e => e.openTicketCount));

  const accept = async (id: number) => {
    setBusyId(id);
    try { await api.post(`/routing-suggestions/${id}/accept`); if (groupId != null) fetchAll(groupId); }
    finally { setBusyId(null); }
  };
  const dismiss = async (id: number) => {
    setBusyId(id);
    try { await api.post(`/routing-suggestions/${id}/dismiss`); if (groupId != null) fetchAll(groupId); }
    finally { setBusyId(null); }
  };

  return (
    <div className="wl-page">
      <div className="wl-header">
        <h2 className="wl-title">{t('aq_workload_nav_item', { defaultValue: 'Agent Workload' })}</h2>
        <select className="wl-group-sel" value={groupId ?? ''} onChange={e => setGroupId(Number(e.target.value))}>
          {groups.map(g => <option key={g.id} value={g.id}>{g.display_name}</option>)}
        </select>
      </div>

      {loading ? <div className="wl-loading"><Loader2 size={18} className="icon-spin" /></div> : (
        <div className="wl-grid">
          {entries.map(e => (
            <div className="wl-card" key={e.userId}>
              <div className="wl-av">{e.displayName.slice(0, 2).toUpperCase()}</div>
              <div className="wl-name">{e.displayName}</div>
              <div className="wl-count" style={{ color: e.overloaded ? '#ef4444' : '#22c55e' }}>{e.openTicketCount}</div>
              <div className="wl-sub">open tickets</div>
              <div className="wl-bar"><div className="wl-fill" style={{ width: `${(e.openTicketCount / maxCount) * 100}%`, background: e.overloaded ? '#ef4444' : '#22c55e' }} /></div>
              {e.overloaded && <div className="wl-overloaded">{t('aq_overloaded_badge', { defaultValue: '⚠ Overloaded' })}</div>}
            </div>
          ))}
        </div>
      )}

      <div className="wl-ai-panel">
        <div className="wl-ai-panel-head">{t('aq_ai_rebalance_suggestions', { defaultValue: '✨ AI REBALANCE SUGGESTIONS' })} <span className="wl-ai-hint">· never auto-applied</span></div>
        {suggestions.length === 0 ? (
          <div className="wl-ai-empty">No rebalance suggestions right now.</div>
        ) : (
          <div className="wl-ai-list">
            {suggestions.map(s => (
              <RoutingSuggestionCard key={s.id} suggestion={s} onAccept={accept} onDismiss={dismiss} busy={busyId === s.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
