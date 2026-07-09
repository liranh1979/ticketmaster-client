import { useTranslation } from 'react-i18next';
import type { CsatAiAnalysis } from '../dashboard.types';
import { CsatImprovementPointItem } from './CsatImprovementPointItem';

interface Props {
  analysis: CsatAiAnalysis;
}

export const CsatAiInsightsCard = ({ analysis }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="arc-card">
      <div className="arc-title-row">
        <h2 className="arc-title">🤖 {t('dashboard_csat_ai_title', { defaultValue: 'CSAT Analysis' })}</h2>
        <span className={`arc-pill ${analysis.cached ? 'arc-pill-cached' : 'arc-pill-fresh'}`}>
          {analysis.cached
            ? t('dashboard_report_cached_label', { defaultValue: 'Cached' })
            : t('dashboard_report_fresh_label', { defaultValue: 'Freshly generated' })}
        </span>
      </div>

      <p className="arc-summary">{analysis.summary}</p>

      {analysis.improvementPoints.length > 0 && (
        <>
          <h3 className="arc-problems-title">
            {t('dashboard_csat_improvement_points', { defaultValue: 'Improvement Points' })}
          </h3>
          <div className="arc-problem-list">
            {analysis.improvementPoints.map((p, i) => (
              <CsatImprovementPointItem key={i} point={p} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
