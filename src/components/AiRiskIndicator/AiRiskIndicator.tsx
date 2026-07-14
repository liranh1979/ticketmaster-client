import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles } from 'lucide-react';
import './AiRiskIndicator.css';

interface Props {
  score: number | null;
  reason: string | null;
}

// Only a warning light for genuinely risky tickets — not shown for every ticket, matching the
// spec's threshold (surfaces early-warning signal the deterministic countdown alone can't show).
const RISK_THRESHOLD = 70;

export const AiRiskIndicator = ({ score, reason }: Props) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (score == null || score <= RISK_THRESHOLD) return null;

  return (
    <div className={`ai-risk${expanded ? ' ai-risk--expanded' : ''}`} onClick={() => setExpanded(v => !v)}>
      <span className="ai-risk-badge">
        <Sparkles size={12} />
        {t('sla_ai_risk_label', { defaultValue: 'AI Breach Risk' })}: {score}%
      </span>
      {expanded && reason && <div className="ai-risk-reason">{reason}</div>}
    </div>
  );
};
