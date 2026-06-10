import { AiChatPage } from '../../pages/EndUser/AiChatPage';
import './AiTicketConsultPanel.css';

interface Props {
  ticketId: number;
  open: boolean;
  onClose: () => void;
  onSolutionSaved?: () => void;
  user: any;
}

export const AiTicketConsultPanel = ({ ticketId, open, onClose, onSolutionSaved, user }: Props) => {
  return (
    <>
      {open && <div className="atcp-overlay" onClick={onClose} />}
      <div className={`atcp-drawer${open ? ' atcp-drawer-open' : ''}`}>
        {open && (
          <AiChatPage
            user={user}
            onBack={onClose}
            onTicketCreated={() => {}}
            onSolutionSaved={onSolutionSaved}
            sessionType="ticket_consult"
            ticketId={ticketId}
            inline
          />
        )}
      </div>
    </>
  );
};
