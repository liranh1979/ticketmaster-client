import type { CsatImprovementPoint } from '../dashboard.types';

interface Props {
  point: CsatImprovementPoint;
}

export const CsatImprovementPointItem = ({ point }: Props) => {
  return (
    <div className="arc-problem-item">
      <div className="arc-problem-desc">{point.point}</div>
      {point.evidence && (
        <div className="arc-fix-block">
          <span className="arc-fix-label">Evidence:</span>
          {point.evidence}
        </div>
      )}
    </div>
  );
};
