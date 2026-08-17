import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import './KnownErrorBanner.css';

export interface KnownErrorSuggestion {
  problemId: number;
  title: string;
  workaroundPlainText: string;
}

interface Props {
  suggestions: KnownErrorSuggestion[];
  isAdmin: boolean;
}

// Problem Management: shown while typing a new ticket's title, same debounced-suggest shape
// as the Knowledge Base suggestion panel. The workaround text is shown to everyone (that's
// the whole point — deflect a duplicate ticket); the link through to the actual Problem
// record only renders for agents/admins, since end users never see Problem records directly.
// See V2/Problem Management/02-relationships-known-error.html.
export const KnownErrorBanner = ({ suggestions, isAdmin }: Props) => {
  const { t } = useTranslation();
  if (suggestions.length === 0) return null;

  return (
    <div className="keb-panel">
      {suggestions.map(s => (
        <div key={s.problemId} className="keb-item">
          <div className="keb-head">
            <AlertTriangle size={13} />
            {t('known_error_banner_title', { defaultValue: 'Matches a Known Error' })}
          </div>
          <div className="keb-body">{s.workaroundPlainText}</div>
          {isAdmin && (
            <a className="keb-link" href={`?ticket=${s.problemId}`}>
              {t('known_error_banner_link', { defaultValue: `View full Problem record (PROB-${s.problemId})` })}
            </a>
          )}
        </div>
      ))}
    </div>
  );
};
