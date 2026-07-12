import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Search, Ticket, X } from 'lucide-react';
import api from '../../api';
import type { TicketPickerItem } from '../../pages/Tickets/ticketTypes';
import './TicketPickerControl.css';

interface Props {
  value: TicketPickerItem | null;
  onChange: (item: TicketPickerItem | null) => void;
  excludeTicketId: number;
  placeholder?: string;
}

export const TicketPickerControl = ({ value, onChange, excludeTicketId, placeholder }: Props) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TicketPickerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The dropdown is portaled to <body> with position:fixed (computed from the
  // trigger's bounding rect) rather than absolutely positioned inline — this
  // control is used inside .trp-modal-body, which has overflow-y:auto, and an
  // inline dropdown gets silently clipped by that ancestor's scroll viewport
  // (same class of bug already hit and fixed for ServiceDeskPage's toolbar
  // dropdowns; see ToolbarDropdown in ServiceDeskPage.tsx).
  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (rect) setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };
    updatePos();
    const onDocMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    window.addEventListener('resize', updatePos);
    window.addEventListener('scroll', updatePos, true);
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      window.removeEventListener('resize', updatePos);
      window.removeEventListener('scroll', updatePos, true);
    };
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 30);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await api.get('/tickets/picker', {
          params: { q: query, excludeId: excludeTicketId, limit: 8 },
        });
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, excludeTicketId]);

  const select = (item: TicketPickerItem) => {
    onChange(item);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={anchorRef} className={`tpc-wrapper${open ? ' open' : ''}`}>
      <button type="button" className="tpc-trigger" onClick={() => setOpen(v => !v)}>
        {value ? (
          <>
            <Ticket size={13} className="tpc-icon" />
            <span className="tpc-trigger-text">TT-{value.id} · {value.title}</span>
          </>
        ) : (
          <>
            <Ticket size={13} className="tpc-icon tpc-icon-empty" />
            <span className="tpc-placeholder">
              {placeholder ?? t('ticket_link_dialog_search_placeholder', { defaultValue: 'Search by title or TT-#…' })}
            </span>
          </>
        )}
        <span className="tpc-actions">
          {value && (
            <span className="tpc-clear" onClick={e => { e.stopPropagation(); onChange(null); }} title="Clear">
              <X size={11} />
            </span>
          )}
          <ChevronDown size={13} className={`tpc-chevron${open ? ' rotated' : ''}`} />
        </span>
      </button>

      {open && pos && createPortal(
        <div
          ref={panelRef}
          className="tpc-dropdown"
          style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="tpc-search-row">
            <Search size={13} />
            <input
              ref={searchRef}
              className="tpc-search"
              placeholder={placeholder ?? t('ticket_link_dialog_search_placeholder', { defaultValue: 'Search by title or TT-#…' })}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
          <div className="tpc-list">
            {loading && <div className="tpc-empty">…</div>}
            {!loading && results.map(item => (
              <div key={item.id} className="tpc-option" onClick={() => select(item)}>
                <span className="tpc-option-id">TT-{item.id}</span>
                <span className="tpc-option-title">{item.title}</span>
              </div>
            ))}
            {!loading && results.length === 0 && (
              <div className="tpc-empty">{t('ticket_link_dialog_no_results', { defaultValue: 'No tickets found' })}</div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
