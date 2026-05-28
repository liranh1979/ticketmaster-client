import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Users, UserMinus } from 'lucide-react';
import api from '../../../api';
import '../UsersManager/UserFormDrawer.css';

interface GroupInfo { id: number; display_name: string; }

interface Member { user_id: number; username: string; display_name: string; }
interface User   { id: number; username: string; display_name: string; }

interface GroupMembersDrawerProps {
  group: GroupInfo | null;
  onClose: () => void;
  onChanged: () => void;
}

export const GroupMembersDrawer = ({ group, onClose, onChanged }: GroupMembersDrawerProps) => {
  const { t } = useTranslation();

  const [members, setMembers]   = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch]     = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [removing, setRemoving] = useState<number | null>(null);

  useEffect(() => {
    if (!group) return;
    setLoading(true);
    setSelected(new Set());
    setSearch('');
    Promise.all([
      api.get(`/groups/${group.id}/members`),
      api.get('/users'),
    ]).then(([membersRes, usersRes]) => {
      setMembers(membersRes.data);
      setAllUsers(usersRes.data);
    }).catch(err => console.error('Failed to load members', err))
      .finally(() => setLoading(false));
  }, [group]);

  const memberIds = new Set(members.map(m => m.user_id));

  const nonMembers = allUsers.filter(u =>
    !memberIds.has(u.id) &&
    (u.display_name.toLowerCase().includes(search.toLowerCase()) ||
     u.username.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleSelect = (userId: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const handleAddSelected = async () => {
    if (!group || selected.size === 0) return;
    setSaving(true);
    try {
      await api.post(`/groups/${group.id}/members`, Array.from(selected));
      const res = await api.get(`/groups/${group.id}/members`);
      setMembers(res.data);
      setSelected(new Set());
      onChanged();
    } catch (err) {
      console.error('Failed to add members', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (userId: number) => {
    if (!group) return;
    setRemoving(userId);
    try {
      await api.delete(`/groups/${group.id}/members`, { data: [userId] });
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      onChanged();
    } catch (err) {
      console.error('Failed to remove member', err);
    } finally {
      setRemoving(null);
    }
  };

  if (!group) return null;

  return (
    <div className="ufd-overlay" onClick={onClose}>
      <aside className="ufd-drawer" onClick={e => e.stopPropagation()}>

        <div className="ufd-header">
          <div className="ufd-header-left">
            <div className="ufd-header-icon"><Users size={18} /></div>
            <div>
              <h3 className="ufd-title">{t('group_members_title')}</h3>
              <p className="ufd-subtitle">{group.display_name}</p>
            </div>
          </div>
          <button className="ufd-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="ufd-body">

          {/* Current Members */}
          <div className="ufd-section">
            <p className="ufd-section-label">
              <Users size={13} /> {t('current_members_section')} ({members.length})
            </p>

            {loading ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', padding: '8px 0' }}>...</div>
            ) : members.length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                {t('no_members_yet')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {members.map(m => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                    <div className="up-avatar" style={{ width: 30, height: 30, fontSize: '0.75rem', flexShrink: 0 }}>
                      {(m.display_name || m.username)[0].toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.display_name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>@{m.username}</div>
                    </div>
                    <button
                      className="ufd-btn ufd-btn-cancel"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 4 }}
                      disabled={removing === m.user_id}
                      onClick={() => handleRemove(m.user_id)}
                    >
                      <UserMinus size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Members */}
          <div className="ufd-section">
            <p className="ufd-section-label">{t('add_members_section')}</p>

            {!loading && allUsers.filter(u => !memberIds.has(u.id)).length === 0 ? (
              <div style={{ color: '#94a3b8', fontSize: '0.85rem', fontStyle: 'italic' }}>
                {t('no_users_to_add')}
              </div>
            ) : (
              <>
                <input
                  className="ufd-input"
                  placeholder={t('member_search_placeholder')}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                  {nonMembers.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 8px', borderRadius: 8, cursor: 'pointer', border: '1px solid #f1f5f9', transition: 'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#fafbff')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}
                    >
                      <input
                        type="checkbox"
                        style={{ width: 17, height: 17, accentColor: '#6366f1', cursor: 'pointer', flexShrink: 0 }}
                        checked={selected.has(u.id)}
                        onChange={() => toggleSelect(u.id)}
                      />
                      <div className="up-avatar" style={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0 }}>
                        {(u.display_name || u.username)[0].toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.display_name}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>@{u.username}</div>
                      </div>
                    </label>
                  ))}
                  {nonMembers.length === 0 && search && (
                    <div style={{ color: '#94a3b8', fontSize: '0.82rem', fontStyle: 'italic', padding: '8px' }}>
                      No users match "{search}"
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

        </div>

        <div className="ufd-footer">
          <button className="ufd-btn ufd-btn-cancel" onClick={onClose}>{t('cancel_btn')}</button>
          <button
            className="ufd-btn ufd-btn-save"
            onClick={handleAddSelected}
            disabled={saving || selected.size === 0}
          >
            {saving ? t('saving') : `${t('add_selected_btn')}${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>

      </aside>
    </div>
  );
};
