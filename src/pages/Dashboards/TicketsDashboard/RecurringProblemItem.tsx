import { useTranslation } from 'react-i18next';
import type { RecurringProblem } from '../dashboard.types';

interface Props {
  problem: RecurringProblem;
}

const MIN_CONFIDENCE_FOR_SOLUTION = 60;

export const RecurringProblemItem = ({ problem }: Props) => {
  const { t } = useTranslation();
  const hasSolution = problem.confidencePercent >= MIN_CONFIDENCE_FOR_SOLUTION && !!problem.solution;

  return (
    <div className="arc-problem-item">
      <div className="arc-problem-head">
        <div className="arc-problem-desc">{problem.description}</div>
        <span className={`arc-confidence-badge ${hasSolution ? 'arc-confidence-high' : 'arc-confidence-low'}`}>
          {problem.confidencePercent}% {t('dashboard_confidence_label', { defaultValue: 'confidence' })}
        </span>
      </div>
      {hasSolution ? (
        <div className="arc-fix-block">
          <span className="arc-fix-label">{t('dashboard_suggested_fix', { defaultValue: 'Suggested fix' })}:</span>
          {problem.solution}
        </div>
      ) : (
        <div className="arc-flag-block">
          {t('dashboard_no_fix_flag', { defaultValue: 'Not enough certainty to suggest a fix — flagged for review.' })}
        </div>
      )}
    </div>
  );
};
