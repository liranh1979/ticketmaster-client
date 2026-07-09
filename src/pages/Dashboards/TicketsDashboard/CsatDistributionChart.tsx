import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { CsatDashboard } from '../dashboard.types';

interface Props {
  distribution: CsatDashboard['distribution'];
}

export const CsatDistributionChart = ({ distribution }: Props) => {
  const total = Object.values(distribution).reduce((a, b) => a + b, 0);
  const data = [5, 4, 3, 2, 1].map(score => {
    const count = distribution[score] ?? 0;
    return {
      star: '⭐'.repeat(score),
      count,
      percent: total === 0 ? 0 : Math.round((count / total) * 100),
    };
  });

  return (
    <div className="dc-chart-area">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
          <CartesianGrid horizontal={false} stroke="var(--sd-border)" />
          <XAxis type="number" allowDecimals={false} tick={{ fontSize: 10, fill: 'var(--sd-fg-subtle)' }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="star" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={90} />
          <Tooltip
            contentStyle={{ background: 'var(--sd-surface-2)', border: '1px solid var(--sd-border)', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: 'var(--sd-fg)' }}
            itemStyle={{ color: 'var(--sd-fg-muted)' }}
            formatter={(value, _name, item) => [`${value} (${item.payload.percent}%)`, 'Responses']}
          />
          <Bar dataKey="count" fill="#eab308" radius={[0, 4, 4, 0]} maxBarSize={20} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
