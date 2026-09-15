import { useTranslation } from 'react-i18next';
import './RoutingSuggestionCard.css';

// Agent Queue Management: shared suggestion card for both Tier 1 (AI Smart-Router, on a ticket)
// and Tier 2 (AI Workload Rebalancer, in the Workload panel) — one table, one review UI shape.
// Visual structure mirrors WorkflowFieldSuggestions.tsx's card look, but that component is
// accept-only (no reject) — this one needs a genuine two-button pair, since ignoring a routing
// suggestion is a real, common outcome, not an edge case. Always shows reasoning/confidence, never
// auto-applies. See V2/Agent Queue Management/05-ai-agent-copilot.html.

export interface RoutingSuggestion {
  id: number;
  suggestionType: 'assign' | 'rebalance';
  ticketId: number;
  ticketTitle?: string;
  suggestedUserId?: number;
  suggestedUserName?: string;
  confidence: number; // 0..1
  reasoning: string;
}

interface Props {
  suggestion: RoutingSuggestion;
  onAccept: (id: number) => void;
  onDismiss: (id: number) => void;
  busy?: boolean;
}

export const RoutingSuggestionCard = ({ suggestion, onAccept, onDismiss, busy }: Props) => {
  const { t } = useTranslation();
  const pct = Math.round(suggestion.confidence * 100);

  return (
    <div className="rsc-card">
      <div className="rsc-head">
        {suggestion.suggestionType === 'assign'
          ? t('aq_ai_suggests_assignee', { defaultValue: '✨ AI SUGGESTS AN ASSIGNEE' })
          : t('aq_ai_rebalance_suggestions', { defaultValue: '✨ AI REBALANCE SUGGESTION' })}
      </div>
      <div className="rsc-body">
        <div className="rsc-av">{(suggestion.suggestedUserName || '?').slice(0, 2).toUpperCase()}</div>
        <div className="rsc-text">
          <span className="rsc-name">{suggestion.suggestedUserName || `User #${suggestion.suggestedUserId}`}</span>
          <span className="rsc-conf">{pct}% confidence</span>
          {suggestion.ticketTitle && <div className="rsc-ticket">TT-{suggestion.ticketId} · {suggestion.ticketTitle}</div>}
          <div className="rsc-reason">{suggestion.reasoning}</div>
        </div>
      </div>
      <div className="rsc-actions">
        <button className="rsc-btn rsc-btn-accept" disabled={busy} onClick={() => onAccept(suggestion.id)}>
          {t('aq_accept_btn', { defaultValue: 'Accept' })}
        </button>
        <button className="rsc-btn rsc-btn-dismiss" disabled={busy} onClick={() => onDismiss(suggestion.id)}>
          {t('aq_dismiss_btn', { defaultValue: 'Dismiss' })}
        </button>
      </div>
    </div>
  );
};
