import type { ComponentType } from 'react';
import { PERMISSIONS, type Permission } from '../../utils/permissions';
import { TicketsDashboard } from './TicketsDashboard/TicketsDashboard';

export interface DashboardEntry {
  id: string;
  labelKey: string;
  permission: Permission;
  component: ComponentType;
}

// Minimal static registry — the mechanism for hosting more than one dashboard
// on the home page later. No dynamic registration is needed yet.
export const DASHBOARD_REGISTRY: DashboardEntry[] = [
  { id: 'tickets_dashboard', labelKey: 'dashboard_tickets_title', permission: PERMISSIONS.TICKET_MANAGER, component: TicketsDashboard },
];
