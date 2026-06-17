import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import api from '../../api';
import { UserPickerControl } from '../UserPickerControl/UserPickerControl';
import './WorkflowTreePanel.css';

/* ── Types ── */

interface WorkflowItem {
  id: number;
  ticketId: number;
  templateNodeId: string;
  parentItemId: number | null;
  title: string;
  status: string;
  assignedUserId: number | null;
  assignedUserDisplayName: string | null;
  assignedGroupId: number | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  ticketId: number;
  isAdmin: boolean;
  onClose: () => void;
}

/* ── Status config ── */

const WF_STATUS: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  pending:     { dot: '#64748b', bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', label: 'Pending'     },
  in_progress: { dot: '#3b82f6', bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd', label: 'In Progress' },
  done:        { dot: '#10b981', bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7', label: 'Done'        },
  suspended:   { dot: '#f59e0b', bg: 'rgba(245,158,11,0.15)',  text: '#fcd34d', label: 'Suspended'   },
  canceled:    { dot: '#334155', bg: 'rgba(30,41,59,0.45)',    text: '#64748b', label: 'Canceled'    },
  blocked:     { dot: '#ef4444', bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5', label: 'Blocked'     },
};

const ADMIN_STATUSES  = ['pending', 'in_progress', 'done', 'suspended', 'canceled', 'blocked'];
const USER_STATUSES   = ['in_progress', 'done', 'blocked'];

const DEPTH_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#64748b'];

/* ── Helpers ── */

function flattenTree(items: WorkflowItem[]): Array<{ item: WorkflowItem; depth: number }> {
  const result: Array<{ item: WorkflowItem; depth: number }> = [];
  const visited = new Set<number>();

  function recurse(parentId: number | null, depth: number) {
    items
      .filter(i => i.parentItemId === parentId)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .forEach(item => {
        if (visited.has(item.id)) return;
        visited.add(item.id);
        result.push({ item, depth });
        recurse(item.id, depth + 1);
      });
  }

  recurse(null, 0);
  return result;
}

function fmtDt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/* ── Component ── */

export const WorkflowTreePanel = ({ ticketId, isAdmin, onClose }: Props) => {
  const [items, setItems]             = useState<WorkflowItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  const [draftStatus, setDraftStatus]   = useState('');
  const [draftAssignee, setDraftAssignee] = useState('');
  const [saving, setSaving]             = useState(false);
  const [savedFlash, setSavedFlash]     = useState(false);
  const [childActivated, setChildActivated] = useState<number | null>(null);

  const flatTree = useMemo(() => flattenTree(items), [items]);
  const selected = items.find(i => i.id === selectedId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/tickets/${ticketId}/workflow`);
      setItems(res.data);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Sync drafts when selection changes
  useEffect(() => {
    if (selected) {
      setDraftStatus(selected.status);
      setDraftAssignee(selected.assignedUserId?.toString() ?? '');
      setChildActivated(null);
      setSavedFlash(false);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const wasDone = selected.status === 'done';
    try {
      let res;
      if (isAdmin) {
        res = await api.patch(`/workflow/items/${selected.id}`, {
          status: draftStatus,
          assignedUserId: draftAssignee ? Number(draftAssignee) : null,
        });
      } else {
        res = await api.patch(`/workflow/items/${selected.id}/status`, { status: draftStatus });
      }

      const updated: WorkflowItem = res.data;
      setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);

      if (!wasDone && updated.status === 'done') {
        const prevPendingChildren = items.filter(
          i => i.parentItemId === selected.id && i.status === 'pending'
        ).length;
        setTimeout(async () => {
          const freshRes = await api.get(`/tickets/${ticketId}/workflow`);
          const fresh: WorkflowItem[] = freshRes.data;
          setItems(fresh);
          const nowActive = fresh.filter(
            i => i.parentItemId === selected.id && i.status === 'in_progress'
          ).length;
          setChildActivated(prevPendingChildren > 0 ? nowActive : 0);
        }, 600);
      }
    } finally {
      setSaving(false);
    }
  };

  const st = (s: string) => WF_STATUS[s] ?? WF_STATUS.pending;
  const statusOptions = isAdmin ? ADMIN_STATUSES : USER_STATUSES;

  return (
    <div className="wtp-overlay" onClick={onClose}>
      <div className="wtp-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="wtp-header">
          <div className="wtp-header-left">
            <span className="wtp-header-icon">⚙</span>
            <div>
              <div className="wtp-header-title">Approval Flow</div>
              <div className="wtp-header-sub">Ticket #{ticketId}</div>
            </div>
          </div>
          <button className="wtp-close-btn" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="wtp-body">

          {/* Left: Tree */}
          <div className="wtp-tree-panel">
            <div className="wtp-section-label">WORKFLOW ITEMS</div>

            {loading ? (
              <div className="wtp-loading">Loading…</div>
            ) : flatTree.length === 0 ? (
              <div className="wtp-empty">No workflow items for this ticket.</div>
            ) : (
              <div className="wtp-node-list">
                {flatTree.map(({ item, depth }) => {
                  const s = st(item.status);
                  const isSelected = item.id === selectedId;
                  return (
                    <div
                      key={item.id}
                      className={`wtp-node-row${isSelected ? ' selected' : ''}`}
                      style={{ paddingLeft: `${depth * 20 + 8}px` }}
                      onClick={() => setSelectedId(item.id)}
                    >
                      {depth > 0 && <span className="wtp-connector">└─</span>}
                      <span className="wtp-status-dot" style={{ background: s.dot }} />
                      <span
                        className="wtp-depth-badge"
                        style={{ background: DEPTH_COLORS[Math.min(depth, 4)] }}
                      >
                        L{depth}
                      </span>
                      <span className="wtp-node-title">{item.title}</span>
                      {item.assignedUserDisplayName && (
                        <span className="wtp-node-assignee" title={item.assignedUserDisplayName}>
                          {item.assignedUserDisplayName}
                        </span>
                      )}
                      <span className="wtp-status-chip" style={{ color: s.text, background: s.bg }}>
                        {s.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right: Inspector */}
          <div className="wtp-inspector">
            {!selected ? (
              <div className="wtp-inspector-empty">
                <div className="wtp-inspector-empty-icon">⚙</div>
                <div>Select an item to view details</div>
                <div className="wtp-inspector-empty-hint">
                  Click any item in the tree on the left
                </div>
              </div>
            ) : (
              <div className="wtp-inspector-content">
                <div className="wtp-section-label">ITEM DETAILS</div>

                {/* Current status indicator */}
                <div className="wtp-current-status" style={{ background: st(selected.status).bg }}>
                  <span className="wtp-current-dot" style={{ background: st(selected.status).dot }} />
                  <span className="wtp-item-title">{selected.title}</span>
                </div>

                {/* Status selector */}
                <div className="wtp-field-group">
                  <label className="wtp-field-label">Status</label>
                  <select
                    className="wtp-select"
                    value={draftStatus}
                    onChange={e => setDraftStatus(e.target.value)}
                  >
                    {statusOptions.map(s => (
                      <option key={s} value={s}>{st(s).label}</option>
                    ))}
                  </select>
                </div>

                {/* Assignee — admin only */}
                {isAdmin && (
                  <div className="wtp-field-group">
                    <label className="wtp-field-label">Assignee</label>
                    <UserPickerControl
                      mode="all"
                      value={draftAssignee}
                      onChange={v => setDraftAssignee(v)}
                      compact
                    />
                  </div>
                )}

                {/* Child activation notice */}
                {childActivated !== null && (
                  <div className={`wtp-child-notice${childActivated > 0 ? ' active' : ''}`}>
                    <Check size={13} />
                    {childActivated > 0
                      ? `${childActivated} child item${childActivated === 1 ? '' : 's'} now active`
                      : 'No pending children to activate'}
                  </div>
                )}

                {/* Save button */}
                <button
                  className={`wtp-save-btn${savedFlash ? ' saved' : ''}`}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {savedFlash
                    ? <><Check size={13} /> Saved</>
                    : saving ? 'Saving…' : 'Save Changes'}
                </button>

                {/* Timestamps */}
                <div className="wtp-timestamps">
                  <div className="wtp-ts-row">
                    <span className="wtp-ts-label">Created</span>
                    <span className="wtp-ts-value">{fmtDt(selected.createdAt)}</span>
                  </div>
                  <div className="wtp-ts-row">
                    <span className="wtp-ts-label">Updated</span>
                    <span className="wtp-ts-value">{fmtDt(selected.updatedAt)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
