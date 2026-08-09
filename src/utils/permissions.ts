export const PERMISSIONS = {
  MANAGE_USERS:     'MANAGE_USERS',
  MANAGE_GROUPS:    'MANAGE_GROUPS',
  MANAGE_FIELDS:    'MANAGE_FIELDS',
  MANAGE_LANGUAGES: 'MANAGE_LANGUAGES',
  MANAGE_AI:        'MANAGE_AI',
  MANAGE_LDAP:      'MANAGE_LDAP',
  MANAGE_AZURE:     'MANAGE_AZURE',
  TICKET_MANAGER:   'TICKET_MANAGER',
  MANAGE_EMAIL:          'MANAGE_EMAIL',
  MANAGE_NOTIFICATIONS:  'MANAGE_NOTIFICATIONS',
  MANAGE_RECURRING_TICKETS: 'MANAGE_RECURRING_TICKETS',
  MANAGE_ANNOUNCEMENTS: 'MANAGE_ANNOUNCEMENTS',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

interface UserLike {
  is_super_admin?: boolean;
  effective_permissions?: string[];
}

export const isSuperAdmin = (u: UserLike | null | undefined): boolean =>
  !!u?.is_super_admin;

export const hasPermission = (u: UserLike | null | undefined, p: Permission): boolean =>
  isSuperAdmin(u) || (u?.effective_permissions ?? []).includes(p);

export const hasAnyPermission = (u: UserLike | null | undefined, ...ps: Permission[]): boolean =>
  ps.some(p => hasPermission(u, p));
