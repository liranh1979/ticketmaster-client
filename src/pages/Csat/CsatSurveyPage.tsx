import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Star } from 'lucide-react';
import api from '../../api';
import './CsatSurveyPage.css';

interface CsatSurveyDto {
  ticketId: number;
  ticketTitle: string | null;
  resolvedBy: string | null;
  resolutionTime: string | null;
  alreadyResponded: boolean;
  expired: boolean;
  existingScore: number | null;
  existingComment: string | null;
}

interface Props {
  token: string;
}

export const CsatSurveyPage = ({ token }: Props) => {
  const { t } = useTranslation();
  const [survey, setSurvey]   = useState<CsatSurveyDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [score, setScore]     = useState(0);
  const [hoverScore, setHoverScore] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    api.get(`/csat-survey/${token}`)
      .then(r => setSurvey(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (score < 1) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      await api.post(`/csat-survey/${token}`, { score, comment: comment.trim() || null });
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="csp-root">
        <div className="csp-spinner" />
      </div>
    );
  }

  if (notFound || !survey) {
    return (
      <div className="csp-root">
        <div className="csp-card">
          <p className="csp-message">Survey not found.</p>
        </div>
      </div>
    );
  }

  const showThanks = submitted || survey.alreadyResponded;

  return (
    <div className="csp-root">
      <div className="csp-card">
        <div className="csp-header">⭐ How did we do?</div>

        {survey.ticketTitle && (
          <div className="csp-ticket-context">
            <div className="csp-ticket-title">TT-{survey.ticketId} — {survey.ticketTitle}</div>
            {survey.resolvedBy && (
              <div className="csp-ticket-meta">
                Resolved by {survey.resolvedBy}
                {survey.resolutionTime && ` · ${survey.resolutionTime} resolution time`}
              </div>
            )}
          </div>
        )}

        {survey.expired && !survey.alreadyResponded ? (
          <p className="csp-message">{t('csat_survey_expired', { defaultValue: 'This survey link has expired.' })}</p>
        ) : showThanks ? (
          <div className="csp-thanks">
            {survey.alreadyResponded && !submitted && survey.existingScore && (
              <div className="csp-stars-readonly">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={28} fill={i <= survey.existingScore! ? '#eab308' : 'none'} color="#eab308" />
                ))}
              </div>
            )}
            <p className="csp-message">
              {t('csat_survey_thanks', { defaultValue: 'Thanks for your feedback!' })}
            </p>
          </div>
        ) : (
          <>
            <p className="csp-question">
              {t('csat_survey_question', { defaultValue: 'Overall, how satisfied are you with this support experience?' })}
            </p>

            <div className="csp-stars">
              {[1, 2, 3, 4, 5].map(i => (
                <button
                  key={i}
                  type="button"
                  className="csp-star-btn"
                  onMouseEnter={() => setHoverScore(i)}
                  onMouseLeave={() => setHoverScore(0)}
                  onClick={() => setScore(i)}
                >
                  <Star size={36} fill={i <= (hoverScore || score) ? '#eab308' : 'none'} color="#eab308" />
                </button>
              ))}
            </div>

            <label className="csp-comment-label">
              {t('csat_survey_comment_prompt', { defaultValue: 'Any additional comments? (optional)' })}
            </label>
            <textarea
              className="csp-comment-input"
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={4}
            />

            {submitError && <p className="csp-error">{submitError}</p>}

            <button
              className="csp-submit-btn"
              disabled={score < 1 || submitting}
              onClick={handleSubmit}
            >
              {submitting ? '…' : t('csat_survey_submit', { defaultValue: 'Submit Feedback' })}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
