import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, User, X } from 'lucide-react';
import api from '../../api';
import './UserPickerControl.css';

interface UserItem {
  user_id: number;
  display_name: string;
}

interface Props {
  mode: 'all' | 'managers';
  value?: string;
  onChange?: (userId: string) => void;
  readonly?: boolean;
  compact?: boolean;
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

const avatarColor = (name: string) => {
  const palette = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % palette.length;
  return palette[Math.abs(h)];
};

export const UserPickerControl = ({
  mode,
  value = '',
  onChange,
  readonly = false,
  compact = false,
}: Props) => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const url = mode === 'all' ? '/ticket-users/assignable' : '/ticket-users/managers';
    api.get(url).then(r => setUsers(r.data)).catch(() => {});
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  const selected = users.find(u => String(u.user_id) === value);
  const filtered = search
    ? users.filter(u => u.display_name.toLowerCase().includes(search.toLowerCase()))
    : users;

  const select = (uid: string) => {
    onChange?.(uid);
    setOpen(false);
    setSearch('');
  };

  /* ── Readonly ── */
  if (readonly) {
    return (
      <div className="upc-readonly">
        {selected ? (
          <>
            <div className="upc-avatar" style={{ background: avatarColor(selected.display_name) }}>
              {initials(selected.display_name)}
            </div>
            <span className="upc-readonly-name">{selected.display_name}</span>
          </>
        ) : (
          <>
            <div className="upc-avatar upc-avatar-empty"><User size={13} /></div>
            <span className="upc-placeholder">Not assigned</span>
          </>
        )}
      </div>
    );
  }

  /* ── Editable ── */
  return (
    <div ref={wrapRef} className={`upc-wrapper${open ? ' open' : ''}${compact ? ' compact' : ''}`}>
      <button type="button" className="upc-trigger" onClick={() => setOpen(v => !v)}>
        {selected ? (
          <>
            <div className="upc-avatar" style={{ background: avatarColor(selected.display_name) }}>
              {initials(selected.display_name)}
            </div>
            <span className="upc-trigger-name">{selected.display_name}</span>
          </>
        ) : (
          <>
            <div className="upc-avatar upc-avatar-empty"><User size={12} /></div>
            <span className="upc-placeholder">Select user…</span>
          </>
        )}
        <span className="upc-actions">
          {value && (
            <span
              className="upc-clear"
              onClick={e => { e.stopPropagation(); select(''); }}
              title="Clear"
            >
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} className={`upc-chevron-icon${open ? ' rotated' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="upc-dropdown">
          <div className="upc-search-row">
            <Search size={13} />
            <input
              ref={searchRef}
              className="upc-search"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="upc-list">
            <div className="upc-option upc-none" onClick={() => select('')}>
              — None —
            </div>
            {filtered.map(u => (
              <div
                key={u.user_id}
                className={`upc-option${String(u.user_id) === value ? ' selected' : ''}`}
                onClick={() => select(String(u.user_id))}
              >
                <div className="upc-avatar" style={{ background: avatarColor(u.display_name) }}>
                  {initials(u.display_name)}
                </div>
                <span>{u.display_name}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="upc-empty">No users found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
