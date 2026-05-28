import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Settings2, RefreshCw, Users, UserPlus, Pencil, Trash2 } from 'lucide-react';
import { ConfigureColumnsModal } from '../UsersManager/ConfigureColumnsModal';
import { GroupFormDrawer } from './GroupFormDrawer';
import { GroupMembersDrawer } from './GroupMembersDrawer';
import '../UsersManager/UsersPage.css';
import api from '../../../api';

interface FieldDef {
  id: number;
  fieldKey: string;
  fieldType: string;
  isListVisible: boolean;
  displayOrder: number;
}

interface Group {
  id: number;
  display_name: string;
  member_count: number;
  metadata: Record<string, any> | null;
}

interface GroupsPageProps {
  currentUser?: any;
}

export const GroupsPage = ({ currentUser }: GroupsPageProps) => {
  const { t } = useTranslation();
  const [groups, setGroups]             = useState<Group[]>([]);
  const [fields, setFields]             = useState<FieldDef[]>([]);
  const [loading, setLoading]           = useState(true);
  const [syncing, setSyncing]           = useState(false);
  const [showColumns, setShowColumns]   = useState(false);
  const [drawerGroup, setDrawerGroup]   = useState<Group | null | undefined>(undefined);
  const [membersGroup, setMembersGroup] = useState<Group | null | undefined>(undefined);
  const [deleting, setDeleting]         = useState<number | null>(null);

  const visibleFields = fields.filter(f => f.isListVisible);

  const fetchAll = async () => {
    try {
      const [groupsRes, fieldsRes] = await Promise.all([
        api.get('/groups'),
        api.get('/field-definitions', { params: { entityType: 'group' } }),
      ]);
      setGroups(groupsRes.data);
      setFields(fieldsRes.data);
    } catch (err) {
      console.error('Failed to load groups', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleSyncMetadata = async () => {
    setSyncing(true);
    try { await api.post('/groups/sync-metadata'); }
    catch (err) { console.error('Sync failed', err); }
    finally { setSyncing(false); }
  };

  const handleDelete = async (group: Group) => {
    if (!window.confirm(t('confirm_delete_group', { name: group.display_name }))) return;
    setDeleting(group.id);
    try {
      await api.delete(`/groups/${group.id}`);
      setGroups(prev => prev.filter(g => g.id !== group.id));
    } catch (err) {
      console.error('Delete failed', err);
    } finally {
      setDeleting(null);
    }
  };

  const getMetaValue = (group: Group, fieldKey: string): string => {
    const meta = group.metadata?.[fieldKey];
    if (!meta) return '—';
    if (typeof meta === 'object') return meta.value || '—';
    return String(meta);
  };

  if (loading) {
    return (
      <div className="up-loading">
        <div className="up-spinner" />
        {t('loading_groups')}
      </div>
    );
  }

  return (
    <div className="up-page">
      <div className="up-header">
        <div className="up-header-left">
          <div className="up-header-icon"><Users size={22} /></div>
          <div>
            <h2 className="up-title">{t('group_management_title')}</h2>
            <p className="up-subtitle">
              {t('groups_count', { count: groups.length })} · {visibleFields.length} {t('groups_visible_columns')}
            </p>
          </div>
        </div>
        <div className="up-header-actions">
          <button className="up-btn up-btn-outline" onClick={() => setShowColumns(true)}>
            <Settings2 size={15} /> {t('configure_columns')}
          </button>
          <button className="up-btn up-btn-ghost" onClick={handleSyncMetadata} disabled={syncing}>
            <RefreshCw size={15} className={syncing ? 'icon-spin' : ''} />
            {syncing ? t('sync_starting') : t('sync_fields_to_groups')}
          </button>
          <button className="up-btn up-btn-primary" onClick={() => setDrawerGroup(null)}>
            <UserPlus size={15} /> {t('new_group')}
          </button>
        </div>
      </div>

      <div className="up-table-wrap">
        <table className="up-table">
          <colgroup>
            <col className="col-num" />
            <col className="col-display-name" />
            <col style={{ width: '110px' }} />
            {visibleFields.map(f => <col key={f.id} className="col-field" />)}
            <col className="col-actions" style={{ width: '110px' }} />
          </colgroup>
          <thead>
            <tr>
              <th className="col-num">{t('col_number')}</th>
              <th className="col-display-name">{t('col_group_name')}</th>
              <th style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '.07em' }}>
                {t('members_btn')}
              </th>
              {visibleFields.map(f => (
                <th key={f.id} className="col-field up-th-field">{f.fieldKey}</th>
              ))}
              <th className="col-actions" />
            </tr>
          </thead>
          <tbody>
            {groups.map((group, idx) => (
              <tr key={group.id} className="up-row">
                <td className="col-num">{idx + 1}</td>
                <td className="col-display-name">
                  <div className="up-user-cell">
                    <div className="up-avatar">{group.display_name[0].toUpperCase()}</div>
                    <span className="up-display-name">{group.display_name}</span>
                  </div>
                </td>
                <td>
                  <span className="up-badge up-badge-user" style={{ cursor: 'pointer' }} onClick={() => setMembersGroup(group)}>
                    {t('members_count', { count: group.member_count ?? 0 })}
                  </span>
                </td>
                {visibleFields.map(f => (
                  <td key={f.id} className="col-field">{getMetaValue(group, f.fieldKey)}</td>
                ))}
                <td className="col-actions">
                  <div className="up-row-actions">
                    <button
                      className="up-action-btn"
                      style={{ background: '#f0fdf4', color: '#16a34a' }}
                      title={t('members_btn')}
                      onClick={() => setMembersGroup(group)}
                    >
                      <Users size={14} />
                    </button>
                    <button
                      className="up-action-btn up-action-edit"
                      title={t('edit_group')}
                      onClick={() => setDrawerGroup(group)}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      className="up-action-btn up-action-delete"
                      title={t('confirm_delete')}
                      disabled={deleting === group.id}
                      onClick={() => handleDelete(group)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {groups.length === 0 && (
          <div className="up-empty">{t('no_groups_found')}</div>
        )}
      </div>

      {showColumns && (
        <ConfigureColumnsModal
          fields={fields}
          descriptionKey="configure_columns_group_desc"
          onClose={() => { setShowColumns(false); fetchAll(); }}
        />
      )}

      {drawerGroup !== undefined && (
        <GroupFormDrawer
          group={drawerGroup}
          fields={fields}
          currentUser={currentUser}
          onClose={() => setDrawerGroup(undefined)}
          onSaved={() => { setDrawerGroup(undefined); fetchAll(); }}
        />
      )}

      {membersGroup !== undefined && (
        <GroupMembersDrawer
          group={membersGroup ?? null}
          onClose={() => setMembersGroup(undefined)}
          onChanged={fetchAll}
        />
      )}
    </div>
  );
};
