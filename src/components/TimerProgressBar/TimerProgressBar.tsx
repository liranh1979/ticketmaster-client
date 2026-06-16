import { useMemo } from 'react';
import './TimerProgressBar.css';

interface TimerValue {
  duration_value?: number;
  duration_unit?: string;
  started_at?: string;
  target_datetime?: string;
}

interface Props {
  value: TimerValue | null | undefined;
  compact?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0m';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export const TimerProgressBar = ({ value, compact = false }: Props) => {
  const info = useMemo(() => {
    if (!value?.started_at || !value?.target_datetime) return null;
    const now      = Date.now();
    const start    = new Date(value.started_at).getTime();
    const target   = new Date(value.target_datetime).getTime();
    const total    = target - start;
    const elapsed  = now - start;
    if (total <= 0) return null;
    const pct      = Math.min(100, Math.max(0, (elapsed / total) * 100));
    const remaining = Math.max(0, (target - now) / 1000);
    const overdue   = now > target;
    const overdueBy = overdue ? (now - target) / 1000 : 0;
    return { pct, remaining, overdue, overdueBy };
  }, [value]);

  if (!value) return <span className="tpb-not-set">—</span>;
  if (!info)  return <span className="tpb-not-set">Not set</span>;

  const color = info.overdue       ? '#ef4444'
              : info.pct >= 80     ? '#f97316'
              : info.pct >= 50     ? '#eab308'
              :                      '#22c55e';

  if (compact) {
    return (
      <div className="tpb-compact" title={
        info.overdue
          ? `Overdue by ${formatDuration(info.overdueBy)}`
          : `${formatDuration(info.remaining)} remaining`
      }>
        <div className="tpb-bar-wrap-compact">
          <div className="tpb-bar-fill" style={{ width: `${info.pct}%`, background: color }} />
        </div>
      </div>
    );
  }

  return (
    <div className="tpb-root">
      <div className="tpb-bar-wrap">
        <div className="tpb-bar-fill" style={{ width: `${info.pct}%`, background: color }} />
      </div>
      <div className="tpb-label" style={{ color }}>
        {info.overdue
          ? `Overdue by ${formatDuration(info.overdueBy)}`
          : `${formatDuration(info.remaining)} remaining`}
      </div>
      <div className="tpb-sublabel">
        Target: {new Date(value.target_datetime!).toLocaleString()}
      </div>
    </div>
  );
};
