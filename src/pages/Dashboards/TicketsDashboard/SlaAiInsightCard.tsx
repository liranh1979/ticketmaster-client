import { useTranslation } from 'react-i18next';
import type { SlaAiInsight } from '../dashboard.types';
import { getAiPillState, formatRelativeTime } from '../aiReportStatus';
import { SlaFindingItem } from './SlaFindingItem';

interface Props {
  insight: SlaAiInsight;
}

export const SlaAiInsightCard = ({ insight }: Props) => {
  const { t } = useTranslation();
  const pillState = getAiPillState(insight.cached, insight.stale, insight.generatedAt);
  const generatedAgo = formatRelativeTime(insight.generatedAt);

  return (
    <div className="arc-card">
      <div className="arc-title-row">
        <h2 className="arc-title">🤖 {t('dashboard_sla_ai_title', { defaultValue: 'SLA Performance Analysis' })}</h2>
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

      <p className="arc-summary">{insight.summary}</p>

      {insight.findings.length > 0 && (
        <>
          <h3 className="arc-problems-title">
            {t('dashboard_sla_findings_title', { defaultValue: 'Findings' })}
          </h3>
          <div className="arc-problem-list">
            {insight.findings.map((f, i) => (
              <SlaFindingItem key={i} finding={f} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
