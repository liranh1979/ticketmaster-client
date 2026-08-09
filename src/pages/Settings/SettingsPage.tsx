import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldEntityList } from './FieldManager/FieldEntityList';
import { SystemFieldManager } from './LanguageManager/SystemFieldManager';
import { FieldDefinitionsManager } from './FieldDefinitions/FieldDefinitionsManager';
import { AIManager } from './AIManager/AIManager';
import { TicketsTemplatesPage } from './TicketsTemplates/TicketsTemplatesPage';
import { LabelsManagementPage } from './LabelsManagement/LabelsManagementPage';
import { UsersPage } from './UsersManager/UsersPage';
import { UsersGroupsHub } from './UsersGroupsHub';
import { GroupsPage } from './GroupsManager/GroupsPage';
import { LdapPage } from './LdapManager/LdapPage';
import type { MissingField } from './LdapManager/LdapWizard';
import { AzurePage } from './AzureManager/AzurePage';
import type { AzureMissingField } from './AzureManager/AzureWizard';
import { hasPermission, hasAnyPermission, isSuperAdmin, PERMISSIONS } from '../../utils/permissions';
import { EmailManager } from './EmailManager/EmailManager';
import { NotificationManager } from './NotificationManager/NotificationManager';
import { WorkflowFieldsManager } from './WorkflowFieldsManager/WorkflowFieldsManager';
import { SetupGuidePage } from './SetupGuide/SetupGuidePage';
import { CompaniesPage } from './CompaniesManager/CompaniesPage';
import { SystemSettingsPage } from './SystemSettings/SystemSettingsPage';
import { SslCertPage } from './SslCert/SslCertPage';
import { AccelerationRulesPage } from './AccelerationRules/AccelerationRulesPage';
import { SlaPoliciesPage } from './SlaPolicies/SlaPoliciesPage';
import { DashboardManagerPage } from './DashboardManager/DashboardManagerPage';
import { RecurringTicketsPage } from './RecurringTickets/RecurringTicketsPage';
import { AlertTypesManager } from './AlertTypes/AlertTypesManager';
import { AnnouncementsPage } from './Announcements/AnnouncementsPage';
import './SettingsPage.css';

interface SettingsPageProps {
  onNavigate:    (view: string) => void;
  user?:         any;
  initialView?:  string;
}

type ViewState =
  | 'menu'
  | 'setup-guide'
  | 'companies'
  | 'system-settings'
  | 'selection'
  | 'system-fields'
  | 'custom-fields'
  | 'group-custom-fields'
  | 'ticket-custom-fields'
  | 'tickets-templates'
  | 'labels-management'
  | 'ai-manager'
  | 'email-manager'
  | 'notification-manager'
  | 'users-groups-hub'
  | 'users'
  | 'groups'
  | 'ldap'
  | 'azure'
  | 'workflow-fields'
  | 'ssl-manager'
  | 'acceleration-rules'
  | 'sla-policies'
  | 'dashboard-manager'
  | 'recurring-tickets'
  | 'alert-types-management'
  | 'announcements';

export const SettingsPage = ({ onNavigate: _onNavigate, user, initialView }: SettingsPageProps) => {
  const { t } = useTranslation();

  const [currentView, setCurrentView] = useState<ViewState>((initialView as ViewState) ?? 'menu');
  const [returnContext, setReturnContext] = useState<{
    ldapConfigId: number;
    suggestedFields: MissingField[];
  } | null>(null);

  const [azureReturnContext, setAzureReturnContext] = useState<{
    azureConfigId: number;
    suggestedFields: AzureMissingField[];
  } | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleMainMenuClick = () => setCurrentView('selection');

  const handleEntitySelection = (entity: string, category: string) => {
    if (category === 'system') {
      setCurrentView('system-fields');
    } else if (entity === 'group') {
      setCurrentView('group-custom-fields');
    } else if (entity === 'ticket') {
      setCurrentView('ticket-custom-fields');
    } else if (entity === 'label') {
      setCurrentView('labels-management');
    } else if (entity === 'workflow') {
      setCurrentView('workflow-fields');
    } else if (entity === 'alert-type') {
      setCurrentView('alert-types-management');
    } else {
      setCurrentView('custom-fields');
    }
  };

  const handleBackToSelection = () => setCurrentView('selection');
  const handleBackToHub      = () => setCurrentView('users-groups-hub');

  const handleLdapFieldsDetour = (configId: number, suggestions: MissingField[]) => {
    setReturnContext({ ldapConfigId: configId, suggestedFields: suggestions });
    setCurrentView('custom-fields');
  };

  const handleReturnFromDetour = () => setCurrentView('ldap');

  const handleAzureFieldsDetour = (configId: number, suggestions: AzureMissingField[]) => {
    setAzureReturnContext({ azureConfigId: configId, suggestedFields: suggestions });
    setCurrentView('custom-fields');
  };

  const handleReturnFromAzureDetour = () => setCurrentView('azure');

  // ── Permissions ─────────────────────────────────────────────────────────
  const isSuperAdminUser  = isSuperAdmin(user);
  const canFields         = hasAnyPermission(user, PERMISSIONS.MANAGE_FIELDS, PERMISSIONS.MANAGE_LANGUAGES);
  const canUsersGroups    = hasAnyPermission(user, PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_GROUPS, PERMISSIONS.MANAGE_LDAP, PERMISSIONS.MANAGE_AZURE);
  const canAi             = hasPermission(user, PERMISSIONS.MANAGE_AI);
  const canEmail          = hasPermission(user, PERMISSIONS.MANAGE_EMAIL);
  const canNotifications  = hasPermission(user, PERMISSIONS.MANAGE_NOTIFICATIONS);
  const canAcceleration   = hasPermission(user, PERMISSIONS.TICKET_MANAGER);
  const canSla            = hasPermission(user, PERMISSIONS.MANAGE_FIELDS);
  const canRecurring      = hasPermission(user, PERMISSIONS.MANAGE_RECURRING_TICKETS);
  const canAnnouncements  = hasPermission(user, PERMISSIONS.MANAGE_ANNOUNCEMENTS);

  // ── Active sidebar group ─────────────────────────────────────────────────
  const activeGroup = (() => {
    if (currentView === 'menu') return 'overview';
    if (currentView === 'setup-guide') return 'setup-guide';
    if (currentView === 'companies') return 'companies';
    if (currentView === 'system-settings') return 'system-settings';
    if (currentView === 'ssl-manager') return 'ssl-manager';
    if (['selection','system-fields','custom-fields','group-custom-fields',
         'ticket-custom-fields','labels-management','workflow-fields',
         'alert-types-management'].includes(currentView)) return 'fields';
    if (currentView === 'tickets-templates') return 'templates';
    if (currentView === 'ai-manager') return 'ai';
    if (currentView === 'email-manager') return 'email';
    if (currentView === 'notification-manager') return 'notifications';
    if (['users-groups-hub','users','groups','ldap','azure'].includes(currentView)) return 'users-groups';
    if (currentView === 'acceleration-rules') return 'acceleration-rules';
    if (currentView === 'sla-policies') return 'sla-policies';
    if (currentView === 'dashboard-manager') return 'dashboard-manager';
    if (currentView === 'recurring-tickets') return 'recurring-tickets';
    if (currentView === 'announcements') return 'announcements';
    return '';
  })();

  const navBtn = (key: string, label: string, onClick: () => void) => (
    <button
      key={key}
      className={`stg-nav__item${activeGroup === key ? ' stg-nav__item--active' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );

  // ── Content renderer ─────────────────────────────────────────────────────
  const renderContent = () => {
    // Settings overview (card grid)
    if (currentView === 'menu') {
      const hasAnyAccess = canFields || canUsersGroups || canAi || canEmail || canNotifications || canAcceleration || canSla || canRecurring || canAnnouncements;
      return (
        <div className="settings-grid">
          {!hasAnyAccess && (
            <div style={{ gridColumn: '1 / -1', color: '#94a3b8', textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>
              {t('no_settings_access')}
            </div>
          )}

          {isSuperAdminUser && (
            <div className="settings-card" onClick={() => setCurrentView('setup-guide')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">🚀</div></div>
              <span className="settings-text">{t('setup_guide_card_label')}</span>
            </div>
          )}

          {isSuperAdminUser && (
            <div className="settings-card" onClick={() => setCurrentView('companies')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">🏢</div></div>
              <span className="settings-text">{t('companies_settings_card')}</span>
            </div>
          )}

          {isSuperAdminUser && (
            <div className="settings-card" onClick={() => setCurrentView('system-settings')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">⚙️</div></div>
              <span className="settings-text">{t('system_settings_card_label')}</span>
            </div>
          )}

          {isSuperAdminUser && (
            <div className="settings-card" onClick={() => setCurrentView('ssl-manager')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">🔒</div></div>
              <span className="settings-text">{t('ssl_title')}</span>
            </div>
          )}

          {isSuperAdminUser && (
            <div className="settings-card" onClick={() => setCurrentView('dashboard-manager')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">📋</div></div>
              <span className="settings-text">{t('dashboard_manager_title', { defaultValue: 'Dashboard Manager' })}</span>
            </div>
          )}

          {canFields && (
            <div className="settings-card" onClick={handleMainMenuClick}>
              <div className="settings-icon-box">
                <img src="/CustomFieldsManager.png" alt="Custom Fields" className="settings-icon-img" />
              </div>
              <span className="settings-text">{t('settings_fields_manager')}</span>
            </div>
          )}

          {canUsersGroups && (
            <div className="settings-card" onClick={() => setCurrentView('users-groups-hub')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">👥</div></div>
              <span className="settings-text">{t('settings_users_groups_manager')}</span>
            </div>
          )}

          {canFields && (
            <div className="settings-card" onClick={() => setCurrentView('tickets-templates')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">🎫</div></div>
              <span className="settings-text">{t('tickets_and_templates')}</span>
            </div>
          )}

          {canAi && (
            <div className="settings-card" onClick={() => setCurrentView('ai-manager')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">🤖</div></div>
              <span className="settings-text">{t('settings_ai_manager')}</span>
            </div>
          )}

          {canEmail && (
            <div className="settings-card" onClick={() => setCurrentView('email-manager')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">✉️</div></div>
              <span className="settings-text">{t('settings_email_manager')}</span>
            </div>
          )}

          {canNotifications && (
            <div className="settings-card" onClick={() => setCurrentView('notification-manager')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">🔔</div></div>
              <span className="settings-text">{t('settings_notification_manager', { defaultValue: 'Notifications' })}</span>
            </div>
          )}

          {canAcceleration && (
            <div className="settings-card" onClick={() => setCurrentView('acceleration-rules')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">⚡</div></div>
              <span className="settings-text">{t('acceleration_card_label')}</span>
            </div>
          )}

          {canSla && (
            <div className="settings-card" onClick={() => setCurrentView('sla-policies')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">⏱</div></div>
              <span className="settings-text">{t('sla_settings_nav_item', { defaultValue: 'SLA' })}</span>
            </div>
          )}

          {canRecurring && (
            <div className="settings-card" onClick={() => setCurrentView('recurring-tickets')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">🔁</div></div>
              <span className="settings-text">{t('recurring_tickets_card_label', { defaultValue: 'Recurring Tickets' })}</span>
            </div>
          )}

          {canAnnouncements && (
            <div className="settings-card" onClick={() => setCurrentView('announcements')}>
              <div className="settings-icon-box"><div className="ai-icon-placeholder">📣</div></div>
              <span className="settings-text">{t('announcements_card_label', { defaultValue: 'Announcements' })}</span>
            </div>
          )}
        </div>
      );
    }

    // Top-level views (no within-section back button needed — sidebar handles nav)
    if (currentView === 'setup-guide') {
      return <SetupGuidePage onNavigate={(view) => setCurrentView(view as ViewState)} />;
    }
    if (currentView === 'companies') return <CompaniesPage />;
    if (currentView === 'system-settings') return <SystemSettingsPage />;
    if (currentView === 'ssl-manager') return <SslCertPage />;
    if (currentView === 'tickets-templates') return <TicketsTemplatesPage />;
    if (currentView === 'ai-manager') return <AIManager />;
    if (currentView === 'email-manager') return <EmailManager />;
    if (currentView === 'notification-manager') return <NotificationManager />;
    if (currentView === 'acceleration-rules') return <AccelerationRulesPage />;
    if (currentView === 'sla-policies') return <SlaPoliciesPage />;
    if (currentView === 'dashboard-manager') return <DashboardManagerPage />;
    if (currentView === 'recurring-tickets') return <RecurringTicketsPage />;
    if (currentView === 'announcements') return <AnnouncementsPage />;
    if (currentView === 'selection') return <FieldEntityList onSelectEntity={handleEntitySelection} />;
    if (currentView === 'users-groups-hub') return <UsersGroupsHub user={user} onSelect={(entity) => setCurrentView(entity)} />;

    // Within-section views (back button navigates to section parent)
    const back = (onClick: () => void) => (
      <button className="back-button" onClick={onClick}>← {t('back_btn')}</button>
    );

    if (currentView === 'system-fields') return (
      <>{back(handleBackToSelection)}<SystemFieldManager /></>
    );

    if (currentView === 'group-custom-fields') return (
      <>{back(handleBackToSelection)}<FieldDefinitionsManager entityType="group" /></>
    );

    if (currentView === 'ticket-custom-fields') return (
      <>{back(handleBackToSelection)}<FieldDefinitionsManager entityType="ticket" /></>
    );

    if (currentView === 'workflow-fields') return (
      <>{back(handleBackToSelection)}<WorkflowFieldsManager /></>
    );

    if (currentView === 'labels-management') return (
      <>{back(handleBackToSelection)}<LabelsManagementPage /></>
    );

    if (currentView === 'alert-types-management') return (
      <>{back(handleBackToSelection)}<AlertTypesManager /></>
    );

    if (currentView === 'users') return (
      <>{back(handleBackToHub)}<UsersPage currentUser={user} /></>
    );

    if (currentView === 'groups') return (
      <>{back(handleBackToHub)}<GroupsPage currentUser={user} /></>
    );

    if (currentView === 'ldap') return (
      <>
        {back(handleBackToHub)}
        <LdapPage
          currentUser={user}
          retriggerConfigId={returnContext?.ldapConfigId}
          onMissingFields={handleLdapFieldsDetour}
          onRetriggerConsumed={() => setReturnContext(null)}
        />
      </>
    );

    if (currentView === 'azure') return (
      <>
        {back(handleBackToHub)}
        <AzurePage
          currentUser={user}
          retriggerConfigId={azureReturnContext?.azureConfigId}
          onMissingFields={handleAzureFieldsDetour}
          onRetriggerConsumed={() => setAzureReturnContext(null)}
        />
      </>
    );

    // custom-fields (user entity, also handles LDAP/Azure detours)
    const isAzureDetour = !!azureReturnContext && !returnContext;
    return (
      <>
        {back(isAzureDetour ? handleReturnFromAzureDetour : returnContext ? handleReturnFromDetour : handleBackToSelection)}
        <FieldDefinitionsManager
          entityType="user"
          returnContext={returnContext ?? undefined}
          azureReturnContext={azureReturnContext ?? undefined}
          onReturnFromDetour={returnContext ? handleReturnFromDetour : handleReturnFromAzureDetour}
        />
      </>
    );
  };

  // ── Layout ───────────────────────────────────────────────────────────────
  return (
    <div className="stg-layout">
      <aside className="stg-nav">
        {navBtn('overview', t('settings_overview', { defaultValue: 'Overview' }), () => setCurrentView('menu'))}

        {canFields      && navBtn('fields',        t('settings_fields_manager'),                          handleMainMenuClick)}
        {canUsersGroups && navBtn('users-groups',  t('settings_users_groups_manager'),                   () => setCurrentView('users-groups-hub'))}
        {canFields      && navBtn('templates',     t('tickets_and_templates'),                            () => setCurrentView('tickets-templates'))}
        {canAi          && navBtn('ai',            t('settings_ai_manager'),                              () => setCurrentView('ai-manager'))}
        {canEmail       && navBtn('email',         t('settings_email_manager'),                           () => setCurrentView('email-manager'))}
        {canNotifications && navBtn('notifications', t('settings_notification_manager', { defaultValue: 'Notifications' }), () => setCurrentView('notification-manager'))}
        {canAcceleration  && navBtn('acceleration-rules', t('acceleration_nav_label'), () => setCurrentView('acceleration-rules'))}
        {canSla           && navBtn('sla-policies', t('sla_settings_nav_item', { defaultValue: 'SLA' }), () => setCurrentView('sla-policies'))}
        {canRecurring     && navBtn('recurring-tickets', t('recurring_tickets_nav_item', { defaultValue: 'Recurring Tickets' }), () => setCurrentView('recurring-tickets'))}
        {canAnnouncements && navBtn('announcements', t('announcements_nav_item', { defaultValue: 'Announcements' }), () => setCurrentView('announcements'))}

        {isSuperAdminUser && <div className="stg-nav__divider" />}
        {isSuperAdminUser && navBtn('setup-guide', t('setup_guide_card_label'),  () => setCurrentView('setup-guide'))}
        {isSuperAdminUser && navBtn('companies',   t('companies_settings_card'), () => setCurrentView('companies'))}
        {isSuperAdminUser && navBtn('system-settings', t('system_settings_card_label'), () => setCurrentView('system-settings'))}
        {isSuperAdminUser && navBtn('ssl-manager', t('ssl_title'), () => setCurrentView('ssl-manager'))}
        {isSuperAdminUser && navBtn('dashboard-manager', t('dashboard_manager_title', { defaultValue: 'Dashboard Manager' }), () => setCurrentView('dashboard-manager'))}
      </aside>

      <div className="stg-content">
        <div className="view-container">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
