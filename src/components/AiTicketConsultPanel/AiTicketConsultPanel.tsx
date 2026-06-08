import { AiChatPage } from '../../pages/EndUser/AiChatPage';
import './AiTicketConsultPanel.css';

interface Props {
  ticketId: number;
  open: boolean;
  onClose: () => void;
  user: any;
}

export const AiTicketConsultPanel = ({ ticketId, open, onClose, user }: Props) => {
  return (
    <>
      {open && <div className="atcp-overlay" onClick={onClose} />}
      <div className={`atcp-drawer${open ? ' atcp-drawer-open' : ''}`}>
        {open && (
          <AiChatPage
            user={user}
            onBack={onClose}
            onTicketCreated={() => {}}
            sessionType="ticket_consult"
            ticketId={ticketId}
            inline
          />
        )}
      </div>
    </>
  );
};
