import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api';
import type { TicketsDashboardResponse } from '../dashboard.types';
import { AiReportCard } from './AiReportCard';
import { DashboardChartCard } from './DashboardChartCard';
import { CsatMetricsRow } from './CsatMetricsRow';
import { CsatDistributionChart } from './CsatDistributionChart';
import { CsatAiInsightsCard } from './CsatAiInsightsCard';
import { CsatLowScoreTable } from './CsatLowScoreTable';
import './TicketsDashboard.css';

interface Props {
  onEditTicket?: (id: number) => void;
}

export const TicketsDashboard = ({ onEditTicket }: Props) => {
  const { t } = useTranslation();
  const [data, setData] = useState<TicketsDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(false);
    api.get<TicketsDashboardResponse>('/dashboard/tickets')
      .then(r => setData(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="td-root">
      <div className="td-header-row">
        <h1 className="td-title">🎫 {t('dashboard_tickets_title', { defaultValue: 'Tickets Dashboard' })}</h1>
      </div>

      <AiReportCard
        report={data?.aiReport ?? null}
        loading={loading}
        error={error}
        onRetry={load}
      />

      {data && (
        <div className="td-charts-grid">
          <DashboardChartCard
            titleKey="dashboard_tickets_chart_title"
            defaultTitle="Tickets Created"
            series={data.tickets}
            barColorVar="--status-open-dot"
          />
          <DashboardChartCard
            titleKey="dashboard_actions_chart_title"
            defaultTitle="Action Items Created"
            series={data.actionItems}
            barColorVar="--status-in-progress-dot"
          />
        </div>
      )}

      {data && (
        <div className="td-csat-section">
          <h2 className="td-section-title">
            🌟 {t('dashboard_csat_section_title', { defaultValue: 'Customer Satisfaction' })}
          </h2>

          <CsatMetricsRow csat={data.csat} />

          <div className="td-charts-grid">
            <div className="dc-card">
              <div className="dc-card-title-row">
                <h2 className="dc-card-title">
                  {t('dashboard_csat_distribution_title', { defaultValue: 'Score Distribution (Last 30 Days)' })}
                </h2>
              </div>
              <CsatDistributionChart distribution={data.csat.distribution} />
            </div>

            <CsatAiInsightsCard analysis={data.csat.aiAnalysis} />
          </div>

          <div className="dc-card">
            <div className="dc-card-title-row">
              <h2 className="dc-card-title">
                {t('dashboard_csat_low_score_table_title', { defaultValue: 'Low Score Tickets — Need Follow-Up' })}
              </h2>
            </div>
            <CsatLowScoreTable tickets={data.csat.lowScoreTickets} onTicketClick={onEditTicket} />
          </div>
        </div>
      )}
    </div>
  );
};
