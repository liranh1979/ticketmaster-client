import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Check, ShieldCheck, ArrowRight } from 'lucide-react';
import api from '../../api';
import './MyWorkflowItemsPage.css';

/* ── Types ── */

interface WorkflowItem {
  id: number;
  ticketId: number;
  title: string;
  status: string;
  type?: string;
  assignedUserDisplayName: string | null;
  displayOrder: number;
  updatedAt: string;
}

interface Props {
  onBack: () => void;
  onViewItem: (itemId: number) => void;
}

/* ── Config ── */

const WF_STATUS: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  pending:     { dot: '#64748b', bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', label: 'Pending'     },
  in_progress: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd', label: 'In Progress' },
  done:        { dot: '#10b981', bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7', label: 'Done'        },
  suspended:   { dot: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  text: '#fcd34d', label: 'Suspended'   },
  blocked:     { dot: '#ef4444', bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5', label: 'Blocked'     },
  canceled:    { dot: '#334155', bg: 'rgba(30,41,59,0.45)',    text: '#64748b', label: 'Canceled'    },
};

const FILTER_DEFS = [
  { key: 'all',         label: 'All'         },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'pending',     label: 'Pending'     },
  { key: 'blocked',     label: 'Blocked'     },
  { key: 'suspended',   label: 'Suspended'   },
  { key: 'done',        label: 'Done'        },
];

/* ── Component ── */

export const MyWorkflowItemsPage = ({ onBack, onViewItem }: Props) => {
  const { t } = useTranslation();
  const [items, setItems]         = useState<WorkflowItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/workflow/my-items');
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (item: WorkflowItem, newStatus: string) => {
    if (newStatus === item.status) return;
    setUpdatingId(item.id);
    try {
      const res = await api.patch(`/workflow/items/${item.id}/status`, { status: newStatus });
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, ...res.data } : i));
    } finally {
      setUpdatingId(null);
    }
  };

  const st = (s: string) => WF_STATUS[s] ?? WF_STATUS.pending;
  const countOf = (key: string) => key === 'all' ? items.length : items.filter(i => i.status === key).length;
  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);

  return (
    <div className="mwi-page">

      {/* Header */}
      <div className="mwi-header">
        <button className="mwi-back-btn" onClick={onBack} title="Back">
          <ArrowLeft size={15} />
        </button>
        <div>
          <div className="mwi-header-title">My Tasks</div>
          <div className="mwi-header-sub">Workflow items assigned to you</div>
        </div>
      </div>

      <div className="mwi-body">

        {/* Sidebar */}
        <div className="mwi-sidebar">
          {FILTER_DEFS.map(f => {
            const count = countOf(f.key);
            return (
              <button
                key={f.key}
                className={`mwi-filter-btn${filter === f.key ? ' active' : ''}`}
                onClick={() => setFilter(f.key)}
              >
                <span className="mwi-filter-label">{f.label}</span>
                {count > 0 && (
                  <span className="mwi-filter-count">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Main */}
        <div className="mwi-main">
          {loading ? (
            <div className="mwi-state">Loading your tasks…</div>
          ) : filtered.length === 0 ? (
            <div className="mwi-empty">
              <div className="mwi-empty-icon">✓</div>
              <div className="mwi-empty-title">
                {filter === 'all'
                  ? 'No tasks assigned to you'
                  : `No ${st(filter).label.toLowerCase()} tasks`}
              </div>
              <div className="mwi-empty-sub">
                {filter === 'all'
                  ? 'Workflow items assigned to you will appear here.'
                  : 'Try a different filter on the left.'}
              </div>
            </div>
          ) : (
            <div className="mwi-card-list">
              {filtered.map(item => {
                const s = st(item.status);
                const isUpdating = updatingId === item.id;
                return (
                  <div key={item.id} className="mwi-card">
                    <div className="mwi-card-left" onClick={() => onViewItem(item.id)}>
                      <span className="mwi-card-dot" style={{ background: s.dot }} />
                      <div className="mwi-card-info">
                        <div className="mwi-card-title">
                          {item.type === 'approval' && <ShieldCheck size={13} className="mwi-approval-icon" />}
                          {item.title}
                        </div>
                        <div className="mwi-card-meta">
                          <span className="mwi-ticket-ref">TT-{item.ticketId}</span>
                          <span
                            className="mwi-status-chip"
                            style={{ color: s.text, background: s.bg }}
                          >
                            {item.type === 'approval' && item.status === 'in_progress' ? t('workflow_item_awaiting_decision', { defaultValue: 'Awaiting your decision' }) : s.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mwi-card-right">
                      {item.type === 'approval' ? (
                        <button
                          className="mwi-approval-cta"
                          onClick={() => onViewItem(item.id)}
                        >
                          {t('workflow_item_review_decide_btn', { defaultValue: 'Review & Decide' })} <ArrowRight size={12} />
                        </button>
                      ) : isUpdating ? (
                        <span className="mwi-updating"><Check size={14} /></span>
                      ) : (
                        <select
                          className="mwi-status-select"
                          value={item.status}
                          disabled={item.status === 'canceled' || item.status === 'done'}
                          onChange={e => handleStatusChange(item, e.target.value)}
                          onClick={e => e.stopPropagation()}
                        >
                          {Object.entries(WF_STATUS)
                            .filter(([k]) => k !== 'canceled')
                            .map(([k, v]) => (
                              <option key={k} value={k}>{v.label}</option>
                            ))}
                        </select>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
