import { useState, useEffect, useRef } from 'react';
import { Tag, X, ChevronDown, Check } from 'lucide-react';
import api from '../../api';
import './LabelPickerControl.css';

interface Label {
  id: number;
  labelKey: string;
  color: string;
  name: string;
}

interface Props {
  previewMode?: boolean;
  value?: number[];
  onChange?: (ids: number[]) => void;
  readonly?: boolean;
}

const SAMPLE: Label[] = [
  { id: -1, labelKey: 'bug',      color: '#ef4444', name: 'Bug'      },
  { id: -2, labelKey: 'urgent',   color: '#f97316', name: 'Urgent'   },
  { id: -3, labelKey: 'security', color: '#8b5cf6', name: 'Security' },
];

export const LabelPickerControl = ({ previewMode = false, value = [], onChange, readonly = false }: Props) => {
  const [labels, setLabels]       = useState<Label[]>([]);
  const [open, setOpen]           = useState(false);
  const [selected, setSelected]   = useState<Set<number>>(new Set(value));
  const dropdownRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (previewMode) { setLabels(SAMPLE); setSelected(new Set([-1, -2])); return; }
    api.get('/ticket-labels').then(r => setLabels(r.data)).catch(() => {});
  }, [previewMode]);

  useEffect(() => {
    setSelected(new Set(value));
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const toggle = (id: number) => {
    if (readonly) return;
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
    onChange?.([...next]);
  };

  const remove = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    toggle(id);
  };

  const selectedLabels = labels.filter(l => selected.has(l.id));
  const available      = labels.filter(l => !selected.has(l.id));

  return (
    <div className="lpc-root" ref={dropdownRef}>
      <div
        className={`lpc-field ${open ? 'lpc-field-open' : ''} ${readonly ? 'lpc-readonly' : ''}`}
        onClick={() => !readonly && setOpen(o => !o)}
      >
        <div className="lpc-chips">
          {selectedLabels.length === 0 && (
            <span className="lpc-placeholder">
              <Tag size={13} /> Add labels…
            </span>
          )}
          {selectedLabels.map(l => (
            <span key={l.id} className="lpc-chip" style={{ '--chip-color': l.color } as React.CSSProperties}>
              <span className="lpc-chip-dot" />
              {l.name}
              {!readonly && (
                <button className="lpc-chip-remove" onClick={e => remove(l.id, e)} tabIndex={-1}>
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
        {!readonly && <ChevronDown size={14} className={`lpc-chevron ${open ? 'lpc-chevron-open' : ''}`} />}
      </div>

      {open && !readonly && (
        <div className="lpc-dropdown">
          {labels.length === 0 && (
            <div className="lpc-empty">No labels defined yet</div>
          )}
          {selectedLabels.length > 0 && (
            <div className="lpc-section">
              <div className="lpc-section-label">Selected</div>
              {selectedLabels.map(l => (
                <div key={l.id} className="lpc-option lpc-option-selected" onClick={() => toggle(l.id)}>
                  <span className="lpc-opt-dot" style={{ background: l.color }} />
                  <span className="lpc-opt-name">{l.name}</span>
                  <Check size={13} className="lpc-opt-check" />
                </div>
              ))}
            </div>
          )}
          {available.length > 0 && (
            <div className="lpc-section">
              {selectedLabels.length > 0 && <div className="lpc-section-label">Available</div>}
              {available.map(l => (
                <div key={l.id} className="lpc-option" onClick={() => toggle(l.id)}>
                  <span className="lpc-opt-dot" style={{ background: l.color }} />
                  <span className="lpc-opt-name">{l.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
