import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, RefreshCw, Users, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { ConfigureColumnsModal } from './ConfigureColumnsModal';
import { UserFormDrawer } from './UserFormDrawer';
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

export const UsersPage = () => {
  const { t } = useTranslation();
  const [users, setUsers]             = useState<User[]>([]);
  const [fields, setFields]           = useState<FieldDef[]>([]);
  const [loading, setLoading]         = useState(true);
  const [syncing, setSyncing]         = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [drawerUser, setDrawerUser]   = useState<User | null | undefined>(undefined); // undefined=closed, null=create, User=edit
  const [deleting, setDeleting]       = useState<number | null>(null);

  const visibleFields = fields.filter(f => f.isListVisible);

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

  const handleSyncMetadata = async () => {
    setSyncing(true);
    try { await api.post('/users/sync-metadata'); }
    catch (err) { console.error('Sync failed', err); }
    finally { setSyncing(false); }
  };

  const handleDelete = async (user: User) => {
    if (user.is_super_admin) return;
    if (!window.confirm(`Delete user "${user.display_name}" (@${user.username})? This cannot be undone.`)) return;
    setDeleting(user.id);
    try {
      await api.delete(`/users/${user.id}`);
      setUsers(prev => prev.filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeleting(null);
    }
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
              {users.length} user{users.length !== 1 ? 's' : ''} · {visibleFields.length} {t('users_visible_columns')}
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
            <UserPlus size={15} /> New User
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="up-table-wrap">
        <table className="up-table">
          <colgroup>
            <col className="col-num" />
            <col className="col-username" />
            <col className="col-display-name" />
            {visibleFields.map(f => <col key={f.id} className="col-field" />)}
            <col className="col-role" />
            <col className="col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="col-num">{t('col_number')}</th>
              <th className="col-username">{t('col_username')}</th>
              <th className="col-display-name">{t('col_display_name')}</th>
              {visibleFields.map(f => (
                <th key={f.id} className="col-field up-th-field">{f.fieldKey}</th>
              ))}
              <th className="col-role">{t('col_role')}</th>
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <tr key={user.id} className="up-row">
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
                <td className="col-actions">
                  <div className="up-row-actions">
                    <button
                      className="up-action-btn up-action-edit"
                      title="Edit"
                      onClick={() => setDrawerUser(user)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className={`up-action-btn up-action-delete ${user.is_super_admin ? 'up-action-disabled' : ''}`}
                      title={user.is_super_admin ? 'Super admins cannot be deleted' : 'Delete'}
                      disabled={user.is_super_admin || deleting === user.id}
                      onClick={() => handleDelete(user)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

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
          onClose={() => setDrawerUser(undefined)}
          onSaved={() => { setDrawerUser(undefined); fetchAll(); }}
        />
      )}
    </div>
  );
};