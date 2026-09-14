import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import api from '../../../api';
import './ChangeCalendarPage.css';

// Change Management: month grid consuming GET /change-calendar. Visual language (`.cal-*`)
// carried over unchanged from V2/feature-08-change.html / V2/Change Management/05-ui-mocks.html
// (Mock 2) — this component builds the real data behind an already-correct mock, not a redesign.
// This endpoint only surfaces conflicts visually; it never blocks a save (that's
// TicketService.assertNoFreezeConflict, enforced server-side at save time).

interface CalendarEntry {
  kind: 'change' | 'freeze';
  start: string;
  end: string;
  ticketId?: number;
  title?: string;
  changeType?: string;
  freezeWindowId?: number;
  reason?: string;
  allowEmergency?: boolean;
}

interface DayCell {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  entries: CalendarEntry[];
  isFreeze: boolean;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const entryOverlapsDay = (entry: CalendarEntry, day: Date) => {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 0, 0, 0);
  const dayEnd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 23, 59, 59);
  const entryStart = new Date(entry.start);
  const entryEnd = new Date(entry.end);
  return entryStart <= dayEnd && entryEnd >= dayStart;
};

export const ChangeCalendarPage = () => {
  const { t } = useTranslation();
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const cellRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setLoading(true);
    api.get<CalendarEntry[]>('/change-calendar', {
      params: { year: cursor.getFullYear(), month: cursor.getMonth() + 1 },
    })
      .then(r => setEntries(r.data))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [cursor]);

  const days: DayCell[] = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    // Monday-first grid, per the original mock — JS getDay() is Sunday-first (0-6).
    const leadingBlank = (firstOfMonth.getDay() + 6) % 7;
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(gridStart.getDate() - leadingBlank);

    const cells: DayCell[] = [];
    for (let i = 0; i < 42; i++) {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + i);
      const dayEntries = entries.filter(e => entryOverlapsDay(e, date));
      cells.push({
        date,
        inMonth: date.getMonth() === cursor.getMonth(),
        isToday: sameDay(date, today),
        entries: dayEntries,
        isFreeze: dayEntries.some(e => e.kind === 'freeze'),
      });
    }
    // Trim trailing all-blank weeks (keeps the grid to 5 rows for most months).
    while (cells.length > 35 && cells.slice(-7).every(c => !c.inMonth)) {
      cells.splice(cells.length - 7, 7);
    }
    return cells;
  }, [cursor, entries, today]);

  const monthLabel = cursor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const goToMonth = (delta: number) => {
    setCursor(prev => new Date(prev.getFullYear(), prev.getMonth() + delta, 1));
    setSelectedIndex(null);
  };

  // Accessibility (V2/Change Management/05-ui-mocks.html accessibility notes): arrow keys move
  // focus day-to-day, Enter/Space opens that day's detail, Home/End jump to first/last day of
  // the visible month — a real focusable grid, not click-only divs.
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next = index;
    if (e.key === 'ArrowRight') next = Math.min(index + 1, days.length - 1);
    else if (e.key === 'ArrowLeft') next = Math.max(index - 1, 0);
    else if (e.key === 'ArrowDown') next = Math.min(index + 7, days.length - 1);
    else if (e.key === 'ArrowUp') next = Math.max(index - 7, 0);
    else if (e.key === 'Home') next = days.findIndex(d => d.inMonth);
    else if (e.key === 'End') { const idx = [...days].map((d, i) => (d.inMonth ? i : -1)).filter(i => i >= 0); next = idx[idx.length - 1]; }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedIndex(index); return; }
    else return;
    e.preventDefault();
    cellRefs.current[next]?.focus();
  };

  const selectedDay = selectedIndex != null ? days[selectedIndex] : null;

  return (
    <div className="cc-page">
      <div className="cc-header-row">
        <Lock size={18} className="cc-header-icon" />
        <h2 className="cc-title">{t('change_calendar_page_title', { defaultValue: 'Change Calendar' })}</h2>
      </div>

      <div className="cal">
        <div className="cal-header">
          <button className="cc-nav-btn" onClick={() => goToMonth(-1)} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <span style={{ fontSize: 14, fontWeight: 600 }}>{monthLabel}</span>
          <button className="cc-nav-btn" onClick={() => goToMonth(1)} aria-label="Next month"><ChevronRight size={16} /></button>
        </div>
        <div className="cal-legend">
          <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-normal" />Normal</span>
          <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-std" />Standard</span>
          <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-emg" />Emergency</span>
          <span className="cal-legend-item"><span className="cal-legend-dot cal-legend-freeze" />Freeze</span>
        </div>

        {loading ? (
          <div className="cc-loading">…</div>
        ) : entries.length === 0 ? (
          <>
            <div className="cal-grid" role="grid" aria-label={`Change calendar for ${monthLabel}`}>
              {WEEKDAY_LABELS.map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
            </div>
            <div className="cc-empty">
              {t('change_calendar_empty', { defaultValue: 'No changes or freeze windows scheduled this month.' })}
            </div>
          </>
        ) : (
          <div className="cal-grid" role="grid" aria-label={`Change calendar for ${monthLabel}`}>
            {WEEKDAY_LABELS.map(d => <div key={d} className="cal-day-hdr">{d}</div>)}
            {days.map((day, i) => (
              <div
                key={i}
                ref={el => { cellRefs.current[i] = el; }}
                role="gridcell"
                tabIndex={i === 0 || selectedIndex === i ? 0 : -1}
                className={`cal-day${day.isToday ? ' today' : ''}${!day.inMonth ? ' cc-day-outside' : ''}${day.isFreeze ? ' ev-freeze' : ''}`}
                onKeyDown={(e) => handleKeyDown(e, i)}
                onClick={() => setSelectedIndex(i)}
                aria-label={`${day.date.toDateString()}${day.entries.length ? `, ${day.entries.length} event(s)` : ''}`}
              >
                {day.date.getDate()}{day.isToday ? ' ·today' : ''}
                {day.isFreeze && <div style={{ fontSize: 9, color: 'var(--crit, #ef4444)', fontWeight: 700 }}>🔒 FREEZE</div>}
                {day.entries.filter(e => e.kind === 'change').slice(0, 2).map((e, j) => (
                  <div key={j} className={`cal-event ${e.changeType === 'emergency' ? 'ev-emg' : e.changeType === 'standard' ? 'ev-std' : 'ev-normal'}`}>
                    {e.title}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDay && (
        <div className="cc-detail-panel" role="region" aria-live="polite">
          <div className="cc-detail-title">{selectedDay.date.toDateString()}</div>
          {selectedDay.entries.length === 0 ? (
            <div className="cc-detail-empty">Nothing scheduled.</div>
          ) : (
            selectedDay.entries.map((e, i) => (
              <div key={i} className="cc-detail-item">
                {e.kind === 'change'
                  ? <span>Change TT-{e.ticketId} — {e.title} ({e.changeType})</span>
                  : <span>🔒 Freeze: {e.reason} {e.allowEmergency ? '(emergency allowed)' : '(no emergency bypass)'}</span>}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
