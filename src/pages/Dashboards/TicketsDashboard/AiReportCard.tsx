import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { DashboardAiReport } from '../dashboard.types';
import { RecurringProblemItem } from './RecurringProblemItem';

interface Props {
  report: DashboardAiReport | null;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}

export const AiReportCard = ({ report, loading, error, onRetry }: Props) => {
  const { t } = useTranslation();

  return (
    <div className="arc-card">
      <div className="arc-title-row">
        <h2 className="arc-title">🤖 {t('dashboard_ai_report_title', { defaultValue: 'AI Insights' })}</h2>
        {report && (
          <span className={`arc-pill ${report.cached ? 'arc-pill-cached' : 'arc-pill-fresh'}`}>
            {report.cached
              ? t('dashboard_report_cached_label', { defaultValue: 'Cached' })
              : t('dashboard_report_fresh_label', { defaultValue: 'Freshly generated' })}
          </span>
        )}
      </div>

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
