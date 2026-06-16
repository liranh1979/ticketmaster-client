import type { ReactNode } from 'react';
import { Pencil } from 'lucide-react';

const FIELD_LABELS: Record<string, string> = {
  title:             'Title',
  status:            'Status',
  description:       'Description',
  requestUserId:     'Request User',
  responsibleUserId: 'Responsible',
  responsibleGroupId:'Resp. Group',
  ticketData:        'Custom Fields',
  labels:            'Labels',
};

const STATUS_CFG: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  new:         { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc', dot: '#6366f1', label: 'New' },
  open:        { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', dot: '#3b82f6', label: 'Open' },
  in_progress: { bg: 'rgba(245,158,11,0.15)', color: '#fbbf24', dot: '#f59e0b', label: 'In Progress' },
  waiting:     { bg: 'rgba(139,92,246,0.15)',  color: '#c4b5fd', dot: '#8b5cf6', label: 'Waiting' },
  resolved:    { bg: 'rgba(16,185,129,0.15)',  color: '#6ee7b7', dot: '#10b981', label: 'Resolved' },
  closed:      { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', dot: '#64748b', label: 'Closed' },
};

const renderValue = (key: string, val: any, side: 'old' | 'new'): ReactNode => {
  if (val === null || val === undefined || val === '') {
    return <span className="fu-empty">none</span>;
  }
  const s = String(val);

  if (key === 'status') {
    const cfg = STATUS_CFG[s] ?? { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8', dot: '#64748b', label: s };
    return (
      <span
        className={`fu-status${side === 'old' ? ' fu-status--old' : ''}`}
        style={{ background: cfg.bg, color: cfg.color }}
      >
        <span className="fu-status-dot" style={{ background: cfg.dot }} />
        {cfg.label}
      </span>
    );
  }

  if (key === 'description') {
    const text = s.replace(/<[^>]*>/g, '').trim();
    const preview = text.length > 48 ? text.slice(0, 45) + '…' : text || '(empty)';
    return <span className={`fu-val fu-val--${side}`}>{preview}</span>;
  }

  if (/userId|groupId/i.test(key) && /^\d+$/.test(s)) {
    return <span className={`fu-id fu-id--${side}`}>#{s}</span>;
  }

  const display = s.length > 55 ? s.slice(0, 52) + '…' : s;
  return <span className={`fu-val fu-val--${side}`}>{display}</span>;
};

export const FieldUpdateCard = ({ changes }: { changes: Record<string, any> }) => {
  const diffRows = Object.entries(changes)
    .filter(([, v]) => v && typeof v === 'object' && 'from' in v && 'to' in v)
    .map(([key, v]) => ({
      label:   FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').trim(),
      fromNode: renderValue(key, v.from, 'old'),
      toNode:   renderValue(key, v.to,   'new'),
    }));

  const metaRows = Object.entries(changes)
    .filter(([, v]) => v && typeof v === 'object' && v.updated === true && !('from' in v))
    .map(([key]) => FIELD_LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').trim());

  const total = diffRows.length + metaRows.length;
  if (total === 0) return null;

  return (
    <div className="fu-card">
      {/* Left accent bar */}
      <div className="fu-accent" />

      {/* Header */}
      <div className="fu-header">
        <div className="fu-icon-wrap">
          <Pencil size={10} strokeWidth={2.5} />
        </div>
        <span className="fu-title">
          {total === 1 ? '1 field updated' : `${total} fields updated`}
        </span>
      </div>

      {/* Diff rows */}
      <div className="fu-rows">
        {diffRows.map((r, i) => (
          <div key={i} className="fu-row">
            <span className="fu-label">{r.label}</span>
            <div className="fu-diff">
              <span className="fu-from">{r.fromNode}</span>
              <span className="fu-arrow">
                <svg width="14" height="8" viewBox="0 0 14 8" fill="none">
                  <path d="M1 4h11M8.5 1l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              <span className="fu-to">{r.toNode}</span>
            </div>
          </div>
        ))}

        {metaRows.map((label, i) => (
          <div key={`m${i}`} className="fu-row">
            <span className="fu-label">{label}</span>
            <div className="fu-diff">
              <span className="fu-meta-badge">updated</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
