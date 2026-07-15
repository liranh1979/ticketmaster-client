import { useTranslation } from 'react-i18next';
import type { CsatAiAnalysis } from '../dashboard.types';
import { getAiPillState, formatRelativeTime } from '../aiReportStatus';
import { CsatImprovementPointItem } from './CsatImprovementPointItem';

interface Props {
  analysis: CsatAiAnalysis;
}

export const CsatAiInsightsCard = ({ analysis }: Props) => {
  const { t } = useTranslation();
  const pillState = getAiPillState(analysis.cached, analysis.stale, analysis.generatedAt);
  const generatedAgo = formatRelativeTime(analysis.generatedAt);

  return (
    <div className="arc-card">
      <div className="arc-title-row">
        <h2 className="arc-title">🤖 {t('dashboard_csat_ai_title', { defaultValue: 'CSAT Analysis' })}</h2>
        <span className={`arc-pill arc-pill-${pillState}`}>
          {pillState === 'pending' && t('dashboard_report_pending_label', { defaultValue: 'Generating…' })}
          {pillState === 'fresh' && t('dashboard_report_up_to_date_label', { defaultValue: 'Up to date' })}
          {pillState === 'stale' && t('dashboard_report_refreshing_label', { defaultValue: 'Refreshing…' })}
        </span>
      </div>
      {generatedAgo && (
        <div className="arc-generated-at">
          {t('dashboard_report_generated_at_label', { defaultValue: 'as of {{time}}', time: generatedAgo })}
        </div>
      )}

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
