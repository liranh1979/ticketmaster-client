import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, ShieldX, Clock, ArrowUpRight, Hourglass } from 'lucide-react';
import api from '../../api';
import './TicketApprovalStatusPanel.css';

interface WorkflowItem {
  id: number;
  ticketId: number;
  parentItemId: number | null;
  title: string;
  status: string;
  type?: string;
  typeConfig?: { levels?: { approverType: string }[] } | null;
}

interface ApprovalDecision {
  id: number;
  workflowItemId: number;
  levelOrder: number;
  approverUserId: number | null;
  approverGroupId: number | null;
  decision: 'pending' | 'approved' | 'rejected' | 'escalated';
  decidedAt: string | null;
}

interface NameLookup { id: number; display_name: string; }

interface Props {
  ticketId: number;
}

export const TicketApprovalStatusPanel = ({ ticketId }: Props) => {
  const { t } = useTranslation();
  const [approvalItems, setApprovalItems] = useState<WorkflowItem[]>([]);
  const [decisionsByItem, setDecisionsByItem] = useState<Record<number, ApprovalDecision[]>>({});
  const [userNames, setUserNames] = useState<Record<number, string>>({});
  const [groupNames, setGroupNames] = useState<Record<number, string>>({});

  useEffect(() => {
    let cancelled = false;

    api.get(`/tickets/${ticketId}/workflow`).then(async res => {
      if (cancelled) return;
      const items: WorkflowItem[] = res.data;
      // Only show approval items that have actually started (skip ones still waiting on an
      // earlier branch — nothing useful to show yet, and it'd falsely imply chain position).
      const approvals = items.filter(i => i.type === 'approval' && i.status !== 'pending');
      setApprovalItems(approvals);
      if (approvals.length === 0) return;

      const entries = await Promise.all(approvals.map(async item => {
        const dRes = await api.get(`/workflow/items/${item.id}/approval-decisions`);
        return [item.id, dRes.data as ApprovalDecision[]] as const;
      }));
      if (!cancelled) setDecisionsByItem(Object.fromEntries(entries));
    }).catch(() => {});

    api.get('/ticket-users/assignable').then(r => {
      if (cancelled) return;
      const map: Record<number, string> = {};
      (r.data as { user_id: number; display_name: string }[]).forEach(u => { map[u.user_id] = u.display_name; });
      setUserNames(map);
    }).catch(() => {});
    api.get('/groups').then(r => {
      if (cancelled) return;
      const map: Record<number, string> = {};
      (r.data as NameLookup[]).forEach(g => { map[g.id] = g.display_name; });
      setGroupNames(map);
    }).catch(() => {});

    return () => { cancelled = true; };
  }, [ticketId]);

  if (approvalItems.length === 0) return null;

  const approverLabel = (d: ApprovalDecision) => {
    if (d.approverGroupId != null) {
      return groupNames[d.approverGroupId] ?? t('workflow_approver_group_fallback', { defaultValue: 'Group #{{id}}', id: d.approverGroupId });
    }
    if (d.approverUserId != null) {
      return userNames[d.approverUserId] ?? t('workflow_approver_user_fallback', { defaultValue: 'User #{{id}}', id: d.approverUserId });
    }
    return t('workflow_approver_unassigned', { defaultValue: 'Unassigned' });
  };

  const decisionLabel = (decision: ApprovalDecision['decision']) => {
    switch (decision) {
      case 'approved': return t('workflow_decision_approved', { defaultValue: 'Approved' });
      case 'rejected': return t('workflow_decision_rejected', { defaultValue: 'Rejected' });
      case 'escalated': return t('workflow_decision_escalated', { defaultValue: 'Escalated' });
      default: return t('workflow_decision_pending', { defaultValue: 'Pending' });
    }
  };

  return (
    <div className="tap-wrap">
      {approvalItems.map(item => {
        const decisions = decisionsByItem[item.id] ?? [];
        const totalLevels = item.typeConfig?.levels?.length ?? decisions.length;
        // "Current step" = 1-based count of levels reached so far (escalations don't count twice —
        // they share a levelOrder with the row they replaced).
        const distinctLevelsReached = new Set(decisions.map(d => d.levelOrder)).size;
        const isDone = item.status === 'done';
        const outcome = isDone
          ? (decisions.some(d => d.decision === 'rejected') ? 'rejected' : 'approved')
          : null;

        return (
          <div key={item.id} className={`tap-card${outcome ? ` tap-card--${outcome}` : ''}`}>
            <div className="tap-header">
              {outcome === 'approved' && <ShieldCheck size={15} className="tap-header-icon" />}
              {outcome === 'rejected' && <ShieldX size={15} className="tap-header-icon" />}
              {!outcome && <Hourglass size={15} className="tap-header-icon" />}
              <span className="tap-header-title">{item.title}</span>
              <span className="tap-header-status">
                {outcome === 'approved' && t('workflow_decision_approved', { defaultValue: 'Approved' })}
                {outcome === 'rejected' && t('workflow_decision_rejected', { defaultValue: 'Rejected' })}
                {!outcome && t('workflow_approval_step_of', { defaultValue: 'Step {{current}} of {{total}}', current: distinctLevelsReached, total: totalLevels || '?' })}
              </span>
            </div>

            <div className="tap-levels">
              {decisions.map((d, idx) => {
                const isLast = idx === decisions.length - 1;
                const stateCls = d.decision === 'pending' ? 'active'
                  : d.decision === 'approved' ? 'done'
                  : d.decision === 'rejected' ? 'rejected'
                  : 'escalated';
                return (
                  <div key={d.id} className={`tap-level tap-level--${stateCls}`}>
                    <span className="tap-level-icon">
                      {d.decision === 'approved' && <ShieldCheck size={12} />}
                      {d.decision === 'rejected' && <ShieldX size={12} />}
                      {d.decision === 'escalated' && <ArrowUpRight size={12} />}
                      {d.decision === 'pending' && <Clock size={12} />}
                    </span>
                    <span className="tap-level-label">{t('workflow_level_label_with_approver', { defaultValue: 'Level {{level}} — {{approver}}', level: d.levelOrder + 1, approver: approverLabel(d) })}</span>
                    <span className="tap-level-state">
                      {d.decision === 'pending' && isLast ? t('workflow_decision_pending', { defaultValue: 'Pending' }) : decisionLabel(d.decision)}
                    </span>
                  </div>
                );
              })}
              {/* Not-yet-reached levels, shown dimmed */}
              {totalLevels > distinctLevelsReached && Array.from({ length: totalLevels - distinctLevelsReached }).map((_, i) => (
                <div key={`future-${i}`} className="tap-level tap-level--future">
                  <span className="tap-level-icon"><Clock size={12} /></span>
                  <span className="tap-level-label">{t('workflow_level_label', { defaultValue: 'Level {{level}}', level: distinctLevelsReached + i + 1 })}</span>
                  <span className="tap-level-state">{t('workflow_level_not_started', { defaultValue: 'Not started' })}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
