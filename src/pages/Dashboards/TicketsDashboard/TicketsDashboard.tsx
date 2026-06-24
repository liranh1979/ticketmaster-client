import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api';
import type { TicketsDashboardResponse } from '../dashboard.types';
import { AiReportCard } from './AiReportCard';
import { DashboardChartCard } from './DashboardChartCard';
import './TicketsDashboard.css';

export const TicketsDashboard = () => {
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
    </div>
  );
};
