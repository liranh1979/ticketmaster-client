export interface TicketLabel {
  id: number;
  labelKey: string;
  color: string;
  name?: string;
}

export interface TicketListItem {
  id: number;
  title: string;
  status: string;
  templateId: number;
  templateVersionId: number;
  templateName: string;
  requestUserId: number;
  requestUserDisplayName: string;
  responsibleUserId: number | null;
  responsibleUserDisplayName: string | null;
  responsibleGroupId: number | null;
  labels: TicketLabel[];
  createdAt: string;
  updatedAt: string;
  version: number;
  ticketData?: Record<string, any>;
}

export interface TicketDetail {
  id: number;
  title: string;
  description: string;
  status: string;
  templateId: number;
  templateVersionId: number;
  templateName: string;
  requestUserId: number;
  requestUserDisplayName: string;
  responsibleUserId: number | null;
  responsibleUserDisplayName: string | null;
  responsibleGroupId: number | null;
  ticketData: Record<string, any>;
  labels: TicketLabel[];
  createdAt: string;
  updatedAt: string;
  version: number;
}

export type FieldVisibility = 'admin_only' | 'all' | 'user_view_admin_edit';

export interface TemplateLayoutField {
  fieldKey: string;
  fieldType: string;
  isSystem: boolean;
  displayOrder: number;
  defaultValue: string;
  fieldOptions?: string[];
  fieldConfig?: Record<string, any>;
  isListVisible?: boolean;
  width?: 'full' | 'half';
  isAdminOnly?: boolean;
  fieldVisibility?: FieldVisibility;
}

export interface AdminNotification {
  id: number;
  ticketId: number;
  fieldKey: string;
  notificationType: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface TemplateSummary {
  id: number;
  name: string;
  description: string;
  currentVersionNumber: number;
  isDefault: boolean;
}

export interface TemplateTab {
  tabKey: string;
  label: string;
  fields: TemplateLayoutField[];
}

export interface TemplateWithLayout extends TemplateSummary {
  layout: { tabs: TemplateTab[] };
  currentVersionId: number;
}

/** Extract ordered flat fields from the tabbed layout stored in the DB */
export function flattenLayout(layout: TemplateWithLayout['layout'] | null | undefined): TemplateLayoutField[] {
  return layout?.tabs?.flatMap(tab => tab.fields ?? []) ?? [];
}

export interface TicketSseEvent {
  type: 'TICKET_UPDATED' | 'TICKET_EDITING' | 'AI_PROCESSING' | 'TICKET_PRESENCE_LEFT';
  ticketId: number;
  userId?: number;
  displayName?: string;
  newVersion?: number;
  changedFields?: string[];
  operation?: 'TICKET_CREATED' | 'FIELD_UPDATE' | 'EMAIL_REPLY' | 'STATUS_CHANGE' | string;
}

export interface AiAnalyzeResponse {
  matchedTemplateId: number;
  matchedTemplateName: string;
  confidence: number;
  suggestedFields: Record<string, any>;
  suggestedLabelIds: number[];
  suggestedLabelKeys: string[];
  reasoning: string;
}

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  new:         { bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  open:        { bg: 'rgba(59,130,246,0.15)',  text: '#93c5fd', border: 'rgba(59,130,246,0.3)' },
  in_progress: { bg: 'rgba(245,158,11,0.15)', text: '#fcd34d', border: 'rgba(245,158,11,0.3)' },
  waiting:     { bg: 'rgba(139,92,246,0.15)', text: '#c4b5fd', border: 'rgba(139,92,246,0.3)' },
  resolved:    { bg: 'rgba(16,185,129,0.15)', text: '#6ee7b7', border: 'rgba(16,185,129,0.3)' },
  closed:      { bg: 'rgba(100,116,139,0.15)',text: '#94a3b8', border: 'rgba(100,116,139,0.3)' },
};

export function statusColor(status: string) {
  return STATUS_COLORS[status] ?? STATUS_COLORS['new'];
}

export function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
