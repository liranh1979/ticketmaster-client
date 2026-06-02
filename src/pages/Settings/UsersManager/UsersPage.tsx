import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, RefreshCw, Users, UserPlus, UserMinus, Pencil, Trash2, X } from 'lucide-react';
import { ConfigureColumnsModal } from './ConfigureColumnsModal';
import { UserFormDrawer } from './UserFormDrawer';
import { BulkGroupAssignmentModal } from './BulkGroupAssignmentModal';
import './UsersPage.css';
import api from '../../../api';

interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  isListVisible: boolean;
  displayOrder: number;
}

interface User {
  id: number;
  username: string;
  display_name: string;
  is_super_admin: boolean;
  metadata: Record<string, any> | null;
}

interface UsersPageProps {
  currentUser?: any;
}

const PAGE_SIZE = 50;

export const UsersPage = ({ currentUser }: UsersPageProps) => {
  const { t } = useTranslation();
  const [users, setUsers]             = useState<User[]>([]);
  const [fields, setFields]           = useState<FieldDef[]>([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [drawerUser, setDrawerUser]   = useState<User | null | undefined>(undefined);
  const [deleting, setDeleting]       = useState<number | null>(null);

  const [selectedUsers, setSelectedUsers]   = useState<Set<number>>(new Set());
  const [bulkGroupMode, setBulkGroupMode]   = useState<'add' | 'remove' | null>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Lazy loading
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visibleFields = fields.filter(f => f.isListVisible);
  const visibleUsers  = users.slice(0, visibleCount);

  const fetchAll = async () => {
    try {
      const [usersRes, fieldsRes] = await Promise.all([
        api.get('/users'),
        api.get('/field-definitions'),
      ]);
      setUsers(usersRes.data);
      setFields(fieldsRes.data);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Reset visible window when data changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [users]);

  // IntersectionObserver — load more when sentinel scrolls into view
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(n => Math.min(n + PAGE_SIZE, users.length));
        }
      },
      { threshold: 0 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [users.length, visibleCount]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selectedUsers.size > 0 && selectedUsers.size < users.length;
    }
  }, [selectedUsers, users]);

  const handleSyncMetadata = async () => {
    setSyncing(true);
    try { await api.post('/users/sync-metadata'); }
    catch (err) { console.error('Sync failed', err); }
    finally { setSyncing(false); }
  };

  const handleDelete = async (user: User) => {
    if (user.is_super_admin) return;
    if (!window.confirm(t('confirm_delete_user', { name: user.display_name, username: user.username }))) return;
    setDeleting(user.id);
    try {
      await api.delete(`/users/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
      setSelectedUsers(prev => { const next = new Set(prev); next.delete(user.id); return next; });
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeleting(null);
    }
  };

  const toggleUser = (userId: number) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      next.has(userId) ? next.delete(userId) : next.add(userId);
      return next;
    });
  };

  const toggleAll = () => {
    setSelectedUsers(
      selectedUsers.size === users.length ? new Set() : new Set(users.map(u => u.id))
    );
  };

  const handleBulkGroupConfirm = async (groupIds: number[]) => {
    const endpoint = bulkGroupMode === 'add' ? '/groups/bulk-add' : '/groups/bulk-remove';
    await api.post(endpoint, { userIds: Array.from(selectedUsers), groupIds });
    setBulkGroupMode(null);
    setSelectedUsers(new Set());
  };

  const getMetaValue = (user: User, fieldKey: string): string => {
    const meta = user.metadata?.[fieldKey];
    if (!meta) return '—';
    if (typeof meta === 'object') return meta.value || '—';
    return String(meta);
  };

  if (loading) {
    return (
      <div className="up-loading">
        <div className="up-spinner" />
        {t('loading_users')}
      </div>
    );
  }

  return (
    <div className="up-page">
      {/* Header */}
      <div className="up-header">
        <div className="up-header-left">
          <div className="up-header-icon"><Users size={22} /></div>
          <div>
            <h2 className="up-title">{t('user_management_title')}</h2>
            <p className="up-subtitle">
              {t('users_count', { count: users.length })} · {visibleFields.length} {t('users_visible_columns')}
            </p>
          </div>
        </div>
        <div className="up-header-actions">
          <button className="up-btn up-btn-outline" onClick={() => setShowColumns(true)}>
            <Settings2 size={15} /> {t('configure_columns')}
          </button>
          <button className="up-btn up-btn-ghost" onClick={handleSyncMetadata} disabled={syncing}>
            <RefreshCw size={15} className={syncing ? 'icon-spin' : ''} />
            {syncing ? t('sync_starting') : t('sync_fields_to_users')}
          </button>
          <button className="up-btn up-btn-primary" onClick={() => setDrawerUser(null)}>
            <UserPlus size={15} /> {t('new_user')}
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedUsers.size > 0 && (
        <div className="up-bulk-bar">
          <span className="up-bulk-bar-info">
            {t('users_selected_count', { count: selectedUsers.size })}
          </span>
          <button className="up-bulk-btn up-bulk-btn-clear" onClick={() => setSelectedUsers(new Set())}>
            <X size={13} /> {t('clear_selection_btn')}
          </button>
          <div className="up-bulk-divider" />
          <button className="up-bulk-btn up-bulk-btn-add" onClick={() => setBulkGroupMode('add')}>
            <UserPlus size={13} /> {t('bulk_add_to_groups_btn')}
          </button>
          <button className="up-bulk-btn up-bulk-btn-remove" onClick={() => setBulkGroupMode('remove')}>
            <UserMinus size={13} /> {t('bulk_remove_from_groups_btn')}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="up-table-wrap">
        <table className="up-table">
          <colgroup>
            <col className="col-actions" />
            <col className="col-select" />
            <col className="col-num" />
            <col className="col-username" />
            <col className="col-display-name" />
            {visibleFields.map(f => <col key={f.id} className="col-field" />)}
            <col className="col-role" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-actions" />
              <th className="col-select">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                  checked={users.length > 0 && selectedUsers.size === users.length}
                  onChange={toggleAll}
                />
              </th>
              <th className="col-num">{t('col_number')}</th>
              <th className="col-username">{t('col_username')}</th>
              <th className="col-display-name">{t('col_display_name')}</th>
              {visibleFields.map(f => (
                <th key={f.id} className="col-field up-th-field">{f.fieldKey}</th>
              ))}
              <th className="col-role">{t('col_role')}</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((user, idx) => (
              <tr
                key={user.id}
                className={`up-row${selectedUsers.has(user.id) ? ' up-row-selected' : ''}`}
              >
                <td className="col-actions">
                  <div className="up-row-actions">
                    <button
                      className="up-action-btn up-action-edit"
                      title={t('edit_user')}
                      onClick={() => setDrawerUser(user)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`up-action-btn up-action-delete ${user.is_super_admin ? 'up-action-disabled' : ''}`}
                      title={user.is_super_admin ? t('super_admin_no_delete') : t('confirm_delete')}
                      disabled={user.is_super_admin || deleting === user.id}
                      onClick={() => handleDelete(user)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
                <td className="col-select" style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
                    checked={selectedUsers.has(user.id)}
                    onChange={() => toggleUser(user.id)}
                  />
                </td>
                <td className="col-num">{idx + 1}</td>
                <td className="col-username">
                  <div className="up-user-cell">
                    <div className="up-avatar">{(user.display_name || user.username)[0].toUpperCase()}</div>
                    <span className="up-username">{user.username}</span>
                  </div>
                </td>
                <td className="col-display-name up-display-name">{user.display_name}</td>
                {visibleFields.map(f => (
                  <td key={f.id} className="col-field">{getMetaValue(user, f.fieldKey)}</td>
                ))}
                <td className="col-role">
                  {user.is_super_admin
                    ? <span className="up-badge up-badge-admin">{t('badge_super_admin')}</span>
                    : <span className="up-badge up-badge-user">{t('badge_user')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Lazy-load sentinel */}
        {visibleCount < users.length && (
          <div ref={sentinelRef} className="up-lazy-sentinel">
            <div className="up-spinner" />
          </div>
        )}

        {users.length === 0 && (
          <div className="up-empty">{t('no_users_found')}</div>
        )}
      </div>

      {/* Modals / Drawer */}
      {showColumns && (
        <ConfigureColumnsModal
          fields={fields}
          onClose={() => { setShowColumns(false); fetchAll(); }}
        />
      )}

      {drawerUser !== undefined && (
        <UserFormDrawer
          user={drawerUser}
          fields={fields}
          currentUser={currentUser}
          onClose={() => setDrawerUser(undefined)}
          onSaved={() => { setDrawerUser(undefined); fetchAll(); }}
        />
      )}

      {bulkGroupMode !== null && (
        <BulkGroupAssignmentModal
          mode={bulkGroupMode}
          userCount={selectedUsers.size}
          onClose={() => setBulkGroupMode(null)}
          onConfirm={handleBulkGroupConfirm}
        />
      )}
    </div>
  );
};
