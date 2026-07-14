import { useTranslation } from 'react-i18next';
import type { SlaAiInsight } from '../dashboard.types';
import { SlaFindingItem } from './SlaFindingItem';

interface Props {
  insight: SlaAiInsight;
}

export const SlaAiInsightCard = ({ insight }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="arc-card">
      <div className="arc-title-row">
        <h2 className="arc-title">🤖 {t('dashboard_sla_ai_title', { defaultValue: 'SLA Performance Analysis' })}</h2>
        <span className={`arc-pill ${insight.cached ? 'arc-pill-cached' : 'arc-pill-fresh'}`}>
          {insight.cached
            ? t('dashboard_report_cached_label', { defaultValue: 'Cached' })
            : t('dashboard_report_fresh_label', { defaultValue: 'Freshly generated' })}
        </span>
      </div>

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
