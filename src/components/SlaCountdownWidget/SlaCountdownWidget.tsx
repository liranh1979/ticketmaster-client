import { useTranslation } from 'react-i18next';
import { useDateTimeFormatter } from '../../hooks/useDateTimeFormatter';
import { tierColor } from '../TimerProgressBar/TimerProgressBar';
import { AiRiskIndicator } from '../AiRiskIndicator/AiRiskIndicator';
import type { SlaState } from '../../pages/Tickets/ticketTypes';
import './SlaCountdownWidget.css';

interface Props {
  slaState: SlaState | null;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.round(ms / 60000);
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = totalMinutes % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// A clock is "currently breaching" the moment now passes its target, even before the response/
// resolution action actually happens and the backend retroactively stamps its breached flag (that
// flag only ever gets set at the moment the action occurs, comparing its timestamp to the target —
// it can't know about a breach that's happening *right now* with no action taken yet). Both need
// to be checked so a ticket that's overdue but still untouched still shows as breached.
function isLiveOverdue(targetAt: string | null, doneAt: string | null, now: number): boolean {
  return !doneAt && targetAt != null && now > new Date(targetAt).getTime();
}

export const SlaCountdownWidget = ({ slaState }: Props) => {
  const { t } = useTranslation();
  const { formatDateTime } = useDateTimeFormatter();

  if (!slaState || !slaState.slaPolicyId) {
    return (
      <div className="slacw-no-policy">
        {t('sla_no_policy_note', { defaultValue: 'No SLA policy configured for this priority.' })}
      </div>
    );
  }

  const paused = slaState.pausedAt != null;
  const now = Date.now();

  const firstResponseOverdue = isLiveOverdue(slaState.firstResponseTargetAt, slaState.firstResponseAt, now);
  const resolutionOverdue = isLiveOverdue(slaState.resolutionTargetAt, slaState.resolutionAt, now);
  const firstResponseIsBreached = slaState.firstResponseBreached || firstResponseOverdue;
  const resolutionIsBreached = slaState.resolutionBreached || resolutionOverdue;

  const renderMetric = (
    label: string,
    targetAt: string | null,
    doneAt: string | null,
    breached: boolean,
    liveOverdue: boolean,
    percentUsed: number | null,
  ) => {
    if (!targetAt) {
      return (
        <div className="slacw-metric">
          <div className="slacw-metric-label">{label}</div>
          <div className="slacw-metric-val">—</div>
        </div>
      );
    }

    const target = new Date(targetAt).getTime();

    if (doneAt) {
      const color = breached ? tierColor(100, true) : tierColor(0, false);
      return (
        <div className="slacw-metric" style={{ borderColor: color }}>
          <div className="slacw-metric-label">{label}</div>
          <div className="slacw-metric-val" style={{ color }}>✓ {t('sla_done_label', { defaultValue: 'Done' })}</div>
          <div className="slacw-metric-sub">{formatDateTime(doneAt)}</div>
        </div>
      );
    }

    const color = paused ? '#94a3b8' : tierColor(percentUsed ?? 0, liveOverdue);

    return (
      <div className={`slacw-metric${paused ? ' slacw-metric--paused' : ''}`} style={{ borderColor: color }}>
        <div className="slacw-metric-label">{label}</div>
        <div className="slacw-metric-val" style={{ color }}>
          {paused ? `⏸ ${t('sla_paused_label', { defaultValue: 'SLA Paused' })}`
            : liveOverdue ? `+${formatDuration(now - target)}`
            : `${formatDuration(target - now)} left`}
        </div>
        <div className="slacw-metric-sub">
          {liveOverdue
            ? `${t('sla_was_due_label', { defaultValue: 'Was due' })} ${formatDateTime(targetAt)}`
            : `${t('sla_due_by_label', { defaultValue: 'Due by' })} ${formatDateTime(targetAt)}`}
        </div>
      </div>
    );
  };

  const resolutionBarColor = paused ? '#94a3b8' : tierColor(slaState.resolutionPercentUsed ?? 0, resolutionIsBreached);
  const resolutionBarPct = slaState.resolutionAt ? 100 : Math.min(100, Math.max(0, slaState.resolutionPercentUsed ?? 0));

  return (
    <div className="slacw-root">
      {(firstResponseIsBreached || resolutionIsBreached) && (
        <div className="slacw-breach-banner">
          ⚠ {t('sla_breached_label', { defaultValue: 'SLA BREACHED' })}
          {resolutionIsBreached && slaState.resolutionTargetAt && !slaState.resolutionAt &&
            ` — ${t('sla_resolution_label', { defaultValue: 'Resolution SLA' })} overdue by ${formatDuration(now - new Date(slaState.resolutionTargetAt).getTime())}`}
          {!resolutionIsBreached && firstResponseIsBreached && slaState.firstResponseTargetAt && !slaState.firstResponseAt &&
            ` — ${t('sla_first_response_label', { defaultValue: 'First Response SLA' })} overdue by ${formatDuration(now - new Date(slaState.firstResponseTargetAt).getTime())}`}
        </div>
      )}

      <div className="slacw-clock">
        {renderMetric(
          t('sla_first_response_label', { defaultValue: 'First Response SLA' }),
          slaState.firstResponseTargetAt, slaState.firstResponseAt, slaState.firstResponseBreached,
          firstResponseOverdue, slaState.firstResponsePercentUsed,
        )}
        {renderMetric(
          t('sla_resolution_label', { defaultValue: 'Resolution SLA' }),
          slaState.resolutionTargetAt, slaState.resolutionAt, slaState.resolutionBreached,
          resolutionOverdue, slaState.resolutionPercentUsed,
        )}
      </div>

      {!slaState.resolutionAt && slaState.resolutionTargetAt && (
        <div className="slacw-progress">
          <div className="slacw-progress-row">
            <span>{t('sla_time_used_label', { defaultValue: 'Resolution time used' })}</span>
            <span>{Math.round(resolutionBarPct)}%</span>
          </div>
          <div className="slacw-bar-bg">
            <div
              className={`slacw-bar-fill${paused ? ' slacw-bar-fill--paused' : ''}`}
              style={{ width: `${resolutionBarPct}%`, background: resolutionBarColor }}
            />
          </div>
        </div>
      )}

      <AiRiskIndicator score={slaState.aiBreachRiskScore} reason={slaState.aiRiskReason} />
    </div>
  );
};
