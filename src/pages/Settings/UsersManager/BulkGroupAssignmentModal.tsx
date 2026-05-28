import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Users } from 'lucide-react';
import './UsersPage.css';
import api from '../../../api';

interface Group { id: number; display_name: string; member_count: number; }

interface BulkGroupAssignmentModalProps {
  mode: 'add' | 'remove';
  userCount: number;
  onClose: () => void;
  onConfirm: (groupIds: number[]) => Promise<void>;
}

export const BulkGroupAssignmentModal = ({ mode, userCount, onClose, onConfirm }: BulkGroupAssignmentModalProps) => {
  const { t } = useTranslation();
  const [groups, setGroups]     = useState<Group[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    api.get('/groups')
      .then(res => setGroups(res.data))
      .catch(err => console.error('Failed to load groups', err))
      .finally(() => setLoading(false));
  }, []);

  const allSelected = groups.length > 0 && selected.size === groups.length;

  const toggleGroup = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(groups.map(g => g.id)));
  };

  const handleConfirm = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await onConfirm(Array.from(selected));
    } catch (err) {
      console.error('Bulk group operation failed', err);
      setSaving(false);
    }
  };

  const isAdd       = mode === 'add';
  const titleKey    = isAdd ? 'bulk_group_modal_add_title' : 'bulk_group_modal_rem_title';
  const descKey     = isAdd ? 'bulk_group_modal_add_desc'  : 'bulk_group_modal_rem_desc';
  const confirmKey  = isAdd ? 'bulk_group_confirm_add'     : 'bulk_group_confirm_remove';
  const confirmStyle = isAdd
    ? { background: '#16a34a', color: '#fff', boxShadow: '0 2px 8px rgba(22,163,74,.25)' }
    : { background: '#dc2626', color: '#fff', boxShadow: '0 2px 8px rgba(220,38,38,.25)' };

  return (
    <div className="ccm-overlay" onClick={onClose}>
      <div className="ccm-modal" onClick={e => e.stopPropagation()}>

        <div className="ccm-header">
          <h3 className="ccm-title">{t(titleKey)}</h3>
          <button className="ccm-close" onClick={onClose}><X size={18} /></button>
        </div>
        <p className="ccm-subtitle">{t(descKey, { count: userCount })}</p>

        {loading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>...</div>
        ) : groups.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontStyle: 'italic' }}>
            {t('bulk_group_no_groups')}
          </div>
        ) : (
          <>
            <div style={{ padding: '0 22px 8px' }}>
              <label className="ccm-field-row" style={{ borderColor: '#e0e7ff', background: '#f5f3ff' }}>
                <input type="checkbox" className="ccm-checkbox" checked={allSelected} onChange={toggleAll} />
                <Users size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#4338ca' }}>
                  {t('bulk_group_select_all')}
                </span>
              </label>
            </div>

            <div className="ccm-field-list">
              {groups.map(g => (
                <label key={g.id} className="ccm-field-row">
                  <input
                    type="checkbox"
                    className="ccm-checkbox"
                    checked={selected.has(g.id)}
                    onChange={() => toggleGroup(g.id)}
                  />
                  <div className="up-avatar" style={{ width: 26, height: 26, fontSize: '0.7rem', flexShrink: 0 }}>
                    {g.display_name[0].toUpperCase()}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1e293b', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.display_name}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: '#94a3b8', flexShrink: 0 }}>
                    {t('members_count', { count: g.member_count ?? 0 })}
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="ccm-footer">
          <button className="ccm-btn ccm-btn-cancel" onClick={onClose} disabled={saving}>
            {t('cancel_btn')}
          </button>
          <button
            className="ccm-btn"
            style={saving || selected.size === 0 ? { ...confirmStyle, opacity: 0.6, cursor: 'not-allowed' } : confirmStyle}
            onClick={handleConfirm}
            disabled={saving || selected.size === 0}
          >
            {saving ? t('saving') : `${t(confirmKey)}${selected.size > 0 ? ` (${selected.size})` : ''}`}
          </button>
        </div>

      </div>
    </div>
  );
};
