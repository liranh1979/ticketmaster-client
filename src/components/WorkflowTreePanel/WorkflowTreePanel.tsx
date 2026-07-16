import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, X, ShieldCheck, ShieldX, Clock, ArrowUpRight, Globe2, Plug } from 'lucide-react';
import api from '../../api';
import { UserPickerControl } from '../UserPickerControl/UserPickerControl';
import { SimpleItemFieldsForm } from '../SimpleItemFieldsForm/SimpleItemFieldsForm';
import type { SimpleItemField } from '../../pages/Settings/TicketsTemplates/SimpleItemFieldsEditor';
import './WorkflowTreePanel.css';

/* ── Types ── */

interface WorkflowItem {
  id: number;
  ticketId: number;
  templateNodeId: string;
  parentItemId: number | null;
  title: string;
  status: string;
  type?: string;
  typeConfig?: { levels?: ApprovalLevelConfig[]; calls?: unknown[]; fields?: SimpleItemField[] } | null;
  assignedUserId: number | null;
  assignedUserDisplayName: string | null;
  assignedGroupId: number | null;
  fieldValues?: Record<string, any> | null;
  lastError?: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface ApprovalLevelConfig {
  approverType: 'specific_user' | 'group';
  approverUserId?: number | null;
  approverGroupId?: number | null;
  timeoutHours?: number | null;
  escalateToUserId?: number | null;
}

interface ApprovalDecision {
  id: number;
  workflowItemId: number;
  levelOrder: number;
  approverUserId: number | null;
  approverGroupId: number | null;
  decision: 'pending' | 'approved' | 'rejected' | 'escalated';
  decidedAt: string | null;
  decidedByUserId: number | null;
  rejectionReason: string | null;
  createdAt: string;
}

interface NameLookup { id: number; display_name: string; }

interface Props {
  ticketId: number;
  isAdmin: boolean;
  currentUserId?: number;
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

export const WorkflowTreePanel = ({ ticketId, isAdmin, currentUserId, onClose }: Props) => {
  const { t } = useTranslation();
  const [items, setItems]             = useState<WorkflowItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selectedId, setSelectedId]   = useState<number | null>(null);

  const [draftStatus, setDraftStatus]   = useState('');
  const [draftAssignee, setDraftAssignee] = useState('');
  const [draftFieldValues, setDraftFieldValues] = useState<Record<string, any>>({});
  const [saving, setSaving]             = useState(false);
  const [savedFlash, setSavedFlash]     = useState(false);
  const [childActivated, setChildActivated] = useState<number | null>(null);

  // Approval-type items
  const [decisions, setDecisions]         = useState<ApprovalDecision[]>([]);
  const [decisionsLoading, setDecisionsLoading] = useState(false);
  const [userNames, setUserNames]         = useState<Record<number, string>>({});
  const [groupNames, setGroupNames]       = useState<Record<number, string>>({});
  const [deciding, setDeciding]           = useState(false);
  const [decideError, setDecideError]     = useState('');
  const [rejectReason, setRejectReason]   = useState('');
  const [showRejectBox, setShowRejectBox] = useState(false);

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

  // Name lookups for approver display (approval-type items only render this info, but the
  // lookups are cheap and shared across every item, so fetch once up front).
  useEffect(() => {
    api.get('/ticket-users/assignable').then(r => {
      const map: Record<number, string> = {};
      (r.data as { user_id: number; display_name: string }[]).forEach(u => { map[u.user_id] = u.display_name; });
      setUserNames(map);
    }).catch(() => {});
    api.get('/groups').then(r => {
      const map: Record<number, string> = {};
      (r.data as NameLookup[]).forEach(g => { map[g.id] = g.display_name; });
      setGroupNames(map);
    }).catch(() => {});
  }, []);

  const loadDecisions = useCallback(async (itemId: number) => {
    setDecisionsLoading(true);
    try {
      const res = await api.get(`/workflow/items/${itemId}/approval-decisions`);
      setDecisions(res.data);
    } finally {
      setDecisionsLoading(false);
    }
  }, []);

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
      setDraftFieldValues(selected.fieldValues ?? {});
      setChildActivated(null);
      setSavedFlash(false);
      setDecideError('');
      setShowRejectBox(false);
      setRejectReason('');
      if (selected.type === 'approval') {
        loadDecisions(selected.id);
      } else {
        setDecisions([]);
      }
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const wasDone = selected.status === 'done';
    try {
      let res;
      if (isAdmin) {
        const hasFields = (selected.typeConfig?.fields?.length ?? 0) > 0;
        res = await api.patch(`/workflow/items/${selected.id}`, {
          status: draftStatus,
          assignedUserId: draftAssignee ? Number(draftAssignee) : null,
          ...(hasFields ? { fieldValues: draftFieldValues } : {}),
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

  const handleDecision = async (decision: 'approved' | 'rejected') => {
    if (!selected) return;
    setDecideError('');
    setDeciding(true);
    try {
      await api.post(`/workflow/items/${selected.id}/approval-decision`, {
        decision,
        reason: decision === 'rejected' ? rejectReason : undefined,
      });
      setShowRejectBox(false);
      setRejectReason('');
      const [freshRes] = await Promise.all([
        api.get(`/tickets/${ticketId}/workflow`),
        loadDecisions(selected.id),
      ]);
      setItems(freshRes.data);
    } catch (err: any) {
      setDecideError(err?.response?.data?.message || t('workflow_decision_record_failed', { defaultValue: 'Failed to record decision' }));
    } finally {
      setDeciding(false);
    }
  };

  const approverLabel = (d: ApprovalDecision) => {
    if (d.approverGroupId != null) {
      return groupNames[d.approverGroupId] ?? t('workflow_approver_group_fallback', { defaultValue: 'Group #{{id}}', id: d.approverGroupId });
    }
    if (d.approverUserId != null) {
      return userNames[d.approverUserId] ?? t('workflow_approver_user_fallback', { defaultValue: 'User #{{id}}', id: d.approverUserId });
    }
    return t('workflow_approver_unassigned', { defaultValue: 'Unassigned' });
  };

  const DECISION_META: Record<ApprovalDecision['decision'], { icon: React.ReactNode; label: string; cls: string }> = {
    pending:   { icon: <Clock size={12} />,       label: t('workflow_decision_pending', { defaultValue: 'Pending' }),   cls: 'pending' },
    approved:  { icon: <ShieldCheck size={12} />, label: t('workflow_decision_approved', { defaultValue: 'Approved' }),  cls: 'approved' },
    rejected:  { icon: <ShieldX size={12} />,      label: t('workflow_decision_rejected', { defaultValue: 'Rejected' }),  cls: 'rejected' },
    escalated: { icon: <ArrowUpRight size={12} />, label: t('workflow_decision_escalated', { defaultValue: 'Escalated' }), cls: 'escalated' },
  };

  const canDecide = (d: ApprovalDecision) =>
    d.decision === 'pending' && currentUserId != null &&
    (d.approverUserId === currentUserId || d.approverGroupId != null);

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
                      <span className="wtp-node-title">
                        {item.type === 'approval' && <ShieldCheck size={11} className="wtp-node-approval-icon" />}
                        {item.type === 'external_api' && <Globe2 size={11} className="wtp-node-approval-icon" />}
                        {item.type === 'mcp_tool' && <Plug size={11} className="wtp-node-approval-icon" />}
                        {item.title}
                      </span>
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

                {selected.type === 'external_api' && (
                  <div className="wtp-field-group">
                    <label className="wtp-field-label">{t('workflow_external_api_action_label', { defaultValue: 'External API Action' })}</label>
                    <p className="wtp-approval-empty">
                      {t('workflow_calls_configured_count', {
                        defaultValue: '{{count}} call{{s}} configured — runs automatically, no manual status change needed.',
                        count: selected.typeConfig?.calls?.length ?? 0,
                        s: (selected.typeConfig?.calls?.length ?? 0) !== 1 ? 's' : '',
                      })}
                    </p>
                    {selected.status === 'blocked' && selected.lastError && (
                      <div className="wtp-approval-reason">{selected.lastError}</div>
                    )}
                  </div>
                )}

                {selected.type === 'mcp_tool' && (
                  <div className="wtp-field-group">
                    <label className="wtp-field-label">{t('workflow_mcp_tool_action_label', { defaultValue: 'MCP Tool Action' })}</label>
                    <p className="wtp-approval-empty">
                      {t('workflow_tool_calls_configured_count', {
                        defaultValue: '{{count}} tool call{{s}} configured — runs automatically, no manual status change needed.',
                        count: selected.typeConfig?.calls?.length ?? 0,
                        s: (selected.typeConfig?.calls?.length ?? 0) !== 1 ? 's' : '',
                      })}
                    </p>
                    {selected.status === 'blocked' && selected.lastError && (
                      <div className="wtp-approval-reason">{selected.lastError}</div>
                    )}
                  </div>
                )}

                {selected.type === 'approval' ? (
                  <>
                    {/* Approval chain progress */}
                    <div className="wtp-field-group">
                      <label className="wtp-field-label">{t('workflow_approval_chain_label', { defaultValue: 'Approval Chain' })}</label>
                      {decisionsLoading ? (
                        <div className="wtp-loading">{t('loading_ellipsis', { defaultValue: 'Loading…' })}</div>
                      ) : decisions.length === 0 ? (
                        <p className="wtp-approval-empty">{t('workflow_no_decisions_yet', { defaultValue: 'No decisions recorded yet.' })}</p>
                      ) : (
                        <div className="wtp-approval-chain">
                          {decisions.map(d => {
                            const meta = DECISION_META[d.decision];
                            return (
                              <div key={d.id} className={`wtp-approval-row wtp-approval-${meta.cls}`}>
                                <div className="wtp-approval-row-top">
                                  <span className="wtp-approval-level">{t('workflow_level_label', { defaultValue: 'Level {{level}}', level: d.levelOrder + 1 })}</span>
                                  <span className="wtp-approval-badge">{meta.icon} {meta.label}</span>
                                </div>
                                <div className="wtp-approval-approver">{approverLabel(d)}</div>
                                {d.decidedAt && (
                                  <div className="wtp-approval-decided-at">{t('workflow_decided_on', { defaultValue: 'on {{date}}', date: fmtDt(d.decidedAt) })}</div>
                                )}
                                {d.rejectionReason && (
                                  <div className="wtp-approval-reason">"{d.rejectionReason}"</div>
                                )}
                                {canDecide(d) && (
                                  <div className="wtp-approval-actions">
                                    {showRejectBox ? (
                                      <div className="wtp-approval-reject-box">
                                        <textarea
                                          className="wtp-approval-reason-input"
                                          placeholder={t('workflow_rejection_reason_placeholder', { defaultValue: 'Reason for rejection (optional)…' }) as string}
                                          value={rejectReason}
                                          onChange={e => setRejectReason(e.target.value)}
                                        />
                                        <div className="wtp-approval-reject-btns">
                                          <button className="wtp-approval-btn-cancel" onClick={() => setShowRejectBox(false)} disabled={deciding}>
                                            {t('cancel_btn', { defaultValue: 'Cancel' })}
                                          </button>
                                          <button className="wtp-approval-btn-reject" onClick={() => handleDecision('rejected')} disabled={deciding}>
                                            <ShieldX size={13} /> {t('workflow_confirm_reject_btn', { defaultValue: 'Confirm Reject' })}
                                          </button>
                                        </div>
                                      </div>
                                    ) : (
                                      <>
                                        <button className="wtp-approval-btn-approve" onClick={() => handleDecision('approved')} disabled={deciding}>
                                          <ShieldCheck size={13} /> {t('workflow_approve_btn', { defaultValue: 'Approve' })}
                                        </button>
                                        <button className="wtp-approval-btn-reject" onClick={() => setShowRejectBox(true)} disabled={deciding}>
                                          <ShieldX size={13} /> {t('workflow_reject_btn', { defaultValue: 'Reject' })}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {decideError && <p className="wtp-approval-error">{decideError}</p>}
                    </div>
                  </>
                ) : (
                  <>
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

                    {/* Item's own mini-fields (from the Action Item Library / Workflow Designer) */}
                    {isAdmin && (selected.typeConfig?.fields?.length ?? 0) > 0 && (
                      <div className="wtp-field-group">
                        <label className="wtp-field-label">{t('simple_item_fields_label', { defaultValue: 'FIELDS (optional)' })}</label>
                        <SimpleItemFieldsForm
                          fields={selected.typeConfig!.fields!}
                          values={draftFieldValues}
                          onChange={(key, value) => setDraftFieldValues(prev => ({ ...prev, [key]: value }))}
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
                  </>
                )}

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
