import { useTranslation } from 'react-i18next';
import type { CsatLowScoreTicket } from '../dashboard.types';

interface Props {
  tickets: CsatLowScoreTicket[];
  onTicketClick?: (id: number) => void;
}

export const CsatLowScoreTable = ({ tickets, onTicketClick }: Props) => {
  const { t } = useTranslation();

  if (tickets.length === 0) {
    return (
      <div className="dc-empty">
        {t('dashboard_csat_no_low_scores', { defaultValue: 'No low-score responses in the last 30 days.' })}
      </div>
    );
  }

  return (
    <table className="cst-table">
      <thead>
        <tr>
          <th>Ticket</th>
          <th>Agent</th>
          <th>Score</th>
          <th>Comment</th>
        </tr>
      </thead>
      <tbody>
        {tickets.map(row => (
          <tr key={row.ticketId} onClick={() => onTicketClick?.(row.ticketId)}>
            <td className="cst-ticket-cell">TT-{row.ticketId} — {row.title}</td>
            <td>{row.agent}</td>
            <td>{'⭐'.repeat(row.score)} {row.score}/5</td>
            <td className="cst-comment-cell">{row.comment || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
