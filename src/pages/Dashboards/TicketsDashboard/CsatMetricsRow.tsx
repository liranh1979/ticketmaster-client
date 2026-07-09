import { useTranslation } from 'react-i18next';
import type { CsatDashboard } from '../dashboard.types';

interface Props {
  csat: CsatDashboard;
}

export const CsatMetricsRow = ({ csat }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="csm-row">
      <div className="csm-tile">
        <div className="csm-value">{csat.avgScore.toFixed(1)}</div>
        <div className="csm-label">{t('dashboard_csat_avg_label', { defaultValue: 'Avg CSAT (30d)' })}</div>
      </div>
      <div className="csm-tile">
        <div className="csm-value">{csat.responseRate.toFixed(0)}%</div>
        <div className="csm-label">{t('dashboard_csat_response_rate_label', { defaultValue: 'Response Rate' })}</div>
      </div>
      <div className="csm-tile csm-tile-warn">
        <div className="csm-value">{csat.lowScorePercent.toFixed(0)}%</div>
        <div className="csm-label">{t('dashboard_csat_low_score_label', { defaultValue: 'Low Score (1–2★)' })}</div>
      </div>
    </div>
  );
};
