import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardAiReport } from '../dashboard.types';
import { getAiPillState, formatRelativeTime } from '../aiReportStatus';
import { RecurringProblemItem } from './RecurringProblemItem';

interface Props {
  report: DashboardAiReport | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export const AiReportCard = ({ report, loading, error, onRetry }: Props) => {
  const { t } = useTranslation();
  const pillState = report ? getAiPillState(report.cached, report.stale, report.generatedAt) : null;
  const generatedAgo = report ? formatRelativeTime(report.generatedAt) : null;

  return (
    <div className="arc-card">
      <div className="arc-title-row">
        <h2 className="arc-title">🤖 {t('dashboard_ai_report_title', { defaultValue: 'AI Insights' })}</h2>
        {pillState && (
          <span className={`arc-pill arc-pill-${pillState}`}>
            {pillState === 'pending' && t('dashboard_report_pending_label', { defaultValue: 'Generating…' })}
            {pillState === 'fresh' && t('dashboard_report_up_to_date_label', { defaultValue: 'Up to date' })}
            {pillState === 'stale' && t('dashboard_report_refreshing_label', { defaultValue: 'Refreshing…' })}
          </span>
        )}
      </div>
      {generatedAgo && (
        <div className="arc-generated-at">
          {t('dashboard_report_generated_at_label', { defaultValue: 'as of {{time}}', time: generatedAgo })}
        </div>
      )}

      {loading && (
        <div className="arc-loading">
          <Loader2 className="icon-spin" size={16} />
          {t('dashboard_report_loading', { defaultValue: 'Analyzing your tickets…' })}
        </div>
      )}

      {!loading && error && (
        <div className="arc-error">
          {t('dashboard_report_error', { defaultValue: 'Could not generate the AI report. Try again later.' })}
          <button className="arc-retry-btn" onClick={onRetry}>
            {t('dashboard_retry_btn', { defaultValue: 'Retry' })}
          </button>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <p className="arc-summary">{report.summary}</p>
          {report.recurringProblems.length > 0 && (
            <>
              <h3 className="arc-problems-title">
                {t('dashboard_recurring_problems', { defaultValue: 'Recurring Problems' })}
              </h3>
              <div className="arc-problem-list">
                {report.recurringProblems.map((p, i) => (
                  <RecurringProblemItem key={i} problem={p} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};
