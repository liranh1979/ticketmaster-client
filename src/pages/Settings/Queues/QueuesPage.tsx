import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Trash2 } from 'lucide-react';
import api from '../../../api';
import { hasPermission, PERMISSIONS } from '../../../utils/permissions';
import './QueuesPage.css';

// Agent Queue Management: this page manages queue DEFINITIONS only (create/delete named saved
// filters) — the daily-use ticket-browsing VIEW of a queue lives in the main workspace nav
// (pages/Queues/MyQueuesPage.tsx) now, not here. Settings is for setup/admin config; agents check
// their actual queue contents constantly, which doesn't belong buried behind Settings. A queue
// is a saved filter re-evaluated against the existing ticket list query on every view — never a
// stored membership list. See V2/Agent Queue Management/03-mockup-queues-workload.html.

interface Queue {
  id: number;
  name: string;
  ownerType: 'user' | 'group';
  ownerId: number;
  filterConfig: Record<string, any>;
}

export const QueuesPage = ({ user }: { user: any }) => {
  const { t } = useTranslation();
  const canManage = hasPermission(user, PERMISSIONS.TICKET_MANAGER);

  const [queues, setQueues] = useState<Queue[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newOwnerType, setNewOwnerType] = useState<'user' | 'group'>('user');
  const [newGroupId, setNewGroupId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [newPriority, setNewPriority] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchQueues = async () => {
    const res = await api.get<Queue[]>('/queues');
    setQueues(res.data);
  };

  useEffect(() => { fetchQueues(); }, []);

  const createQueue = async () => {
    const filterConfig: Record<string, any> = {};
    if (newStatus) filterConfig.status = newStatus;
    if (newPriority) filterConfig.priority = newPriority;
    const payload = {
      name: newName,
      ownerType: newOwnerType,
      ownerId: newOwnerType === 'user' ? user.red_id : Number(newGroupId),
      filterConfig,
      displayOrder: 0,
    };
    await api.post('/queues', payload);
    setShowNewForm(false);
    setNewName(''); setNewStatus(''); setNewPriority(''); setNewGroupId('');
    fetchQueues();
  };

  const deleteQueue = async (id: number) => {
    setDeletingId(id);
    try {
      await api.delete(`/queues/${id}`);
      fetchQueues();
    } finally {
      setDeletingId(null);
    }
  };

  const personal = queues.filter(q => q.ownerType === 'user');
  const team = queues.filter(q => q.ownerType === 'group');

  const renderRow = (q: Queue) => (
    <div key={q.id} className="qp-def-row">
      <span className="qp-def-name">{q.name}</span>
      <span className="qp-def-filter">
        {Object.keys(q.filterConfig || {}).length === 0
          ? t('aq_no_filter_hint', { defaultValue: 'no filter' })
          : Object.entries(q.filterConfig).map(([k, v]) => `${k}: ${v}`).join(', ')}
      </span>
      <button
        className="qp-def-delete-btn"
        onClick={() => deleteQueue(q.id)}
        disabled={deletingId === q.id}
        title={t('delete_btn', { defaultValue: 'Delete' }) as string}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );

  return (
    <div className="qp-page">
      <div className="qp-def-section">
        <div className="qp-def-section-title">{t('aq_my_queues_section', { defaultValue: 'My Queues' })}</div>
        {personal.length === 0 ? (
          <div className="qp-def-empty">{t('aq_no_queues_hint', { defaultValue: 'No queues yet.' })}</div>
        ) : personal.map(renderRow)}
      </div>

      <div className="qp-def-section">
        <div className="qp-def-section-title">{t('aq_team_queues_section', { defaultValue: 'Team Queues' })}</div>
        {team.length === 0 ? (
          <div className="qp-def-empty">{t('aq_no_queues_hint', { defaultValue: 'No queues yet.' })}</div>
        ) : team.map(renderRow)}
      </div>

      <div className="qp-def-section">
        <div className="qp-new-link" onClick={() => setShowNewForm(v => !v)}>{t('aq_new_queue_btn', { defaultValue: '+ New Queue' })}</div>
        {showNewForm && (
          <div className="qp-new-form">
            <input className="qp-input" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)} />
            <select className="qp-input" value={newOwnerType} onChange={e => setNewOwnerType(e.target.value as any)}>
              <option value="user">Personal</option>
              {canManage && <option value="group">Team</option>}
            </select>
            {newOwnerType === 'group' && (
              <input className="qp-input" placeholder="Group ID" value={newGroupId} onChange={e => setNewGroupId(e.target.value)} />
            )}
            <input className="qp-input" placeholder="Status filter (optional)" value={newStatus} onChange={e => setNewStatus(e.target.value)} />
            <input className="qp-input" placeholder="Priority filter (optional)" value={newPriority} onChange={e => setNewPriority(e.target.value)} />
            <button className="qp-save-btn" onClick={createQueue} disabled={!newName}>{t('save_btn', { defaultValue: 'Save' })}</button>
          </div>
        )}
      </div>
    </div>
  );
};
