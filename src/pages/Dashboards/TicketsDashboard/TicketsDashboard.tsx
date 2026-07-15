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
import { SlaPriorityStatsTable } from './SlaPriorityStatsTable';
import { SlaAiInsightCard } from './SlaAiInsightCard';
import './TicketsDashboard.css';

interface Props {
  onEditTicket?: (id: number) => void;
}

const DEFAULT_SECTION_ORDER = ['ai_report', 'charts', 'csat', 'sla'];

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

  const renderAiReportSection = () => (
    <AiReportCard
      key="ai_report"
      report={data?.aiReport ?? null}
      loading={loading}
      error={error}
      onRetry={load}
    />
  );

  const renderChartsSection = () => data && (
    <div className="td-charts-grid" key="charts">
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
  );

  const renderCsatSection = () => data && (
    <div className="td-csat-section" key="csat">
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
  );

  const renderSlaSection = () => data && (
    <div className="td-sla-section" key="sla">
      <h2 className="td-section-title">
        ⏱ {t('dashboard_sla_section_title', { defaultValue: 'SLA Performance' })}
      </h2>

      <div className="dc-card">
        <div className="dc-card-title-row">
          <h2 className="dc-card-title">
            {t('dashboard_sla_stats_title', { defaultValue: 'Breach Rates by Priority' })}
          </h2>
        </div>
        <SlaPriorityStatsTable stats={data.sla.priorityStats} />
      </div>

      <SlaAiInsightCard insight={data.sla.aiInsight} />
    </div>
  );

  const SECTION_RENDERERS: Record<string, () => React.ReactNode> = {
    ai_report: renderAiReportSection,
    charts: renderChartsSection,
    csat: renderCsatSection,
    sla: renderSlaSection,
  };

  const order = data?.sectionOrder?.length ? data.sectionOrder : DEFAULT_SECTION_ORDER;

  return (
    <div className="td-root">
      <div className="td-header-row">
        <h1 className="td-title">🎫 {t('dashboard_tickets_title', { defaultValue: 'Tickets Dashboard' })}</h1>
      </div>

      {order.map(sectionKey => SECTION_RENDERERS[sectionKey]?.() ?? null)}
    </div>
  );
};
