import type { SlaFinding } from '../dashboard.types';

interface Props {
  finding: SlaFinding;
}

export const SlaFindingItem = ({ finding }: Props) => {
  return (
    <div className="arc-problem-item">
      <div className="arc-problem-desc">{finding.observation}</div>
      {finding.recommendation && (
        <div className="arc-fix-block">
          <span className="arc-fix-label">Recommendation:</span>
          {finding.recommendation}
        </div>
      )}
    </div>
  );
};
