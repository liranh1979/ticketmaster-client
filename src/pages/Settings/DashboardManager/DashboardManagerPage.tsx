import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, GripVertical, CheckCircle, Loader2 } from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../../../api';
import type { TicketsDashboardResponse } from '../../Dashboards/dashboard.types';
import './DashboardManagerPage.css';

const SECTION_LABELS: Record<string, { icon: string; labelKey: string; defaultLabel: string }> = {
  ai_report: { icon: '🤖', labelKey: 'dashboard_ai_report_title', defaultLabel: 'AI Insights' },
  charts: { icon: '📊', labelKey: 'dashboard_manager_section_charts', defaultLabel: 'Tickets & Actions Charts' },
  csat: { icon: '🌟', labelKey: 'dashboard_csat_section_title', defaultLabel: 'Customer Satisfaction' },
  sla: { icon: '⏱', labelKey: 'dashboard_sla_section_title', defaultLabel: 'SLA Performance' },
};

const DEFAULT_ORDER = ['ai_report', 'charts', 'csat', 'sla'];

function SortableSectionRow({ sectionKey, index }: { sectionKey: string; index: number }) {
  const { t } = useTranslation();
  const meta = SECTION_LABELS[sectionKey];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: sectionKey });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="dbm-row">
      <span className="dbm-grip" {...attributes} {...listeners}><GripVertical size={14} /></span>
      <span className="dbm-order">{index + 1}</span>
      <span className="dbm-icon">{meta?.icon ?? '📄'}</span>
      <span className="dbm-label">{t(meta?.labelKey ?? sectionKey, { defaultValue: meta?.defaultLabel ?? sectionKey })}</span>
    </div>
  );
}

export const DashboardManagerPage = () => {
  const { t } = useTranslation();
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const sensors = useSensors(useSensor(PointerSensor));

  useEffect(() => {
    api.get<TicketsDashboardResponse>('/dashboard/tickets')
      .then(r => setOrder(r.data.sectionOrder?.length ? r.data.sectionOrder : DEFAULT_ORDER))
      .catch(() => setOrder(DEFAULT_ORDER))
      .finally(() => setLoading(false));
  }, []);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = order.indexOf(String(active.id));
    const newIdx = order.indexOf(String(over.id));
    setOrder(arrayMove(order, oldIdx, newIdx));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/system-settings/update', { dashboardSectionOrder: order });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
    } catch (err: any) {
      alert('Save failed: ' + (err.response?.data?.message ?? err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="dbm-page">
      <div className="dbm-header">
        <div className="dbm-header-left">
          <LayoutDashboard size={20} className="dbm-header-icon" />
          <div>
            <h2 className="dbm-title">{t('dashboard_manager_title', { defaultValue: 'Dashboard Manager' })}</h2>
            <p className="dbm-subtitle">
              {t('dashboard_manager_subtitle', { defaultValue: 'Drag to reorder how sections appear on the Tickets Dashboard.' })}
            </p>
          </div>
        </div>
        <button className="dbm-save-btn" onClick={handleSave} disabled={saving || loading}>
          {saving ? <Loader2 size={13} className="icon-spin" /> : null}
          {t('save_btn', { defaultValue: 'Save' })}
        </button>
      </div>

      {savedMsg && <span className="dbm-saved-msg"><CheckCircle size={13} /> Saved</span>}

      <div className="dbm-list-wrap">
        {loading ? (
          <div className="dbm-loading"><Loader2 size={18} className="icon-spin" /></div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={order} strategy={verticalListSortingStrategy}>
              {order.map((sectionKey, i) => (
                <SortableSectionRow key={sectionKey} sectionKey={sectionKey} index={i} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
};
