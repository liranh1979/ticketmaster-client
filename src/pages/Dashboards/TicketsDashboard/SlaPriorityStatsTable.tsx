import { useTranslation } from 'react-i18next';
import type { SlaPriorityStat } from '../dashboard.types';

interface Props {
  stats: SlaPriorityStat[];
}

export const SlaPriorityStatsTable = ({ stats }: Props) => {
  const { t } = useTranslation();

  if (stats.length === 0) {
    return (
      <div className="dc-empty">
        {t('dashboard_sla_no_data', { defaultValue: 'No SLA-tracked tickets yet.' })}
      </div>
    );
  }

  return (
    <table className="spt-table">
      <thead>
        <tr>
          <th>{t('sla_col_priority', { defaultValue: 'Priority' })}</th>
          <th>{t('dashboard_sla_col_total', { defaultValue: 'Total' })}</th>
          <th>{t('dashboard_sla_col_resolved', { defaultValue: 'Resolved' })}</th>
          <th>{t('dashboard_sla_col_fr_breached', { defaultValue: 'First Response Breached' })}</th>
          <th>{t('dashboard_sla_col_res_breached', { defaultValue: 'Resolution Breached' })}</th>
          <th>{t('dashboard_sla_col_breach_rate', { defaultValue: 'Breach Rate' })}</th>
        </tr>
      </thead>
      <tbody>
        {stats.map(row => (
          <tr key={row.priority}>
            <td>
              <span className={`spt-priority-chip spt-priority-chip--${row.priority}`}>{row.priority}</span>
            </td>
            <td>{row.total}</td>
            <td>{row.resolvedCount}</td>
            <td>{row.firstResponseBreached}</td>
            <td>{row.resolutionBreached}</td>
            <td className={row.resolutionBreachRatePercent >= 20 ? 'spt-rate-warn' : undefined}>
              {row.resolutionBreachRatePercent.toFixed(1)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
