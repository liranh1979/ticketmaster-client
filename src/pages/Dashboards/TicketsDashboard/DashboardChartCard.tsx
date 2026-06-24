import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardRange, DashboardSeries } from '../dashboard.types';

interface Props {
  titleKey: string;
  defaultTitle: string;
  series: DashboardSeries;
  barColorVar: string;
}

const RANGES: DashboardRange[] = ['day', 'week', 'month'];

export const DashboardChartCard = ({ titleKey, defaultTitle, series, barColorVar }: Props) => {
  const { t } = useTranslation();
  const [range, setRange] = useState<DashboardRange>('day');

  const data = series[range];
  const barColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(barColorVar).trim() || undefined
    : undefined;

  return (
    <div className="dc-card">
      <div className="dc-card-title-row">
        <h2 className="dc-card-title">{t(titleKey, { defaultValue: defaultTitle })}</h2>
      </div>

      <div className="dc-tab-row">
        {RANGES.map(r => (
          <button
            key={r}
            className={`dc-tab-btn${range === r ? ' active' : ''}`}
            onClick={() => setRange(r)}
          >
            {t(`dashboard_tab_${r}`, { defaultValue: r.charAt(0).toUpperCase() + r.slice(1) })}
          </button>
        ))}
      </div>

      {data.length === 0 ? (
        <div className="dc-empty">{t('dashboard_no_data', { defaultValue: 'Not enough ticket activity yet to show this chart.' })}</div>
      ) : (
        <div className="dc-chart-area">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="bucket" tick={{ fontSize: 10, fill: 'var(--sd-fg-subtle)' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--sd-fg-subtle)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ background: 'var(--sd-surface-2)', border: '1px solid var(--sd-border)', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'var(--sd-fg)' }}
                itemStyle={{ color: 'var(--sd-fg-muted)' }}
              />
              <Bar dataKey="count" fill={barColor} radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
