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
import { SetupGuidePage } from './SetupGuide/SetupGuidePage';
import './SettingsPage.css';

interface SettingsPageProps {
  onNavigate:    (view: string) => void;
  user?:         any;
  initialView?:  string;
}

type ViewState =
  | 'menu'
  | 'setup-guide'
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
  | 'azure';

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

  const handleMainMenuClick = () => {
    setCurrentView('selection');
  };

  const handleEntitySelection = (entity: string, category: string) => {
    if (category === 'system') {
      setCurrentView('system-fields');
    } else if (entity === 'group') {
      setCurrentView('group-custom-fields');
    } else if (entity === 'ticket') {
      setCurrentView('ticket-custom-fields');
    } else if (entity === 'label') {
      setCurrentView('labels-management');
    } else {
      setCurrentView('custom-fields');
    }
  };

  const handleBackToMenu = () => {
    setCurrentView('menu');
  };

  const handleBackToSelection = () => {
    setCurrentView('selection');
  };

  const handleBackToHub = () => {
    setCurrentView('users-groups-hub');
  };

  const handleLdapFieldsDetour = (configId: number, suggestions: MissingField[]) => {
    setReturnContext({ ldapConfigId: configId, suggestedFields: suggestions });
    setCurrentView('custom-fields');
  };

  const handleReturnFromDetour = () => {
    setCurrentView('ldap');
  };

  const handleAzureFieldsDetour = (configId: number, suggestions: AzureMissingField[]) => {
    setAzureReturnContext({ azureConfigId: configId, suggestedFields: suggestions });
    setCurrentView('custom-fields');
  };

  const handleReturnFromAzureDetour = () => {
    setCurrentView('azure');
  };

  // 1. Initial State: Main Settings Grid
  if (currentView === 'menu') {
    const canFields      = hasAnyPermission(user, PERMISSIONS.MANAGE_FIELDS, PERMISSIONS.MANAGE_LANGUAGES);
    const canUsersGroups = hasAnyPermission(user, PERMISSIONS.MANAGE_USERS, PERMISSIONS.MANAGE_GROUPS, PERMISSIONS.MANAGE_LDAP, PERMISSIONS.MANAGE_AZURE);
    const canAi          = hasPermission(user, PERMISSIONS.MANAGE_AI);
    const canEmail         = hasPermission(user, PERMISSIONS.MANAGE_EMAIL);
    const canNotifications = hasPermission(user, PERMISSIONS.MANAGE_NOTIFICATIONS);
    const hasAnyAccess     = canFields || canUsersGroups || canAi || canEmail || canNotifications;

    const isSuperAdminUser = isSuperAdmin(user);

    return (
      <div className="settings-grid">
        {!hasAnyAccess && (
          <div style={{ gridColumn: '1 / -1', color: '#94a3b8', textAlign: 'center', padding: '2rem', fontStyle: 'italic' }}>
            {t('no_settings_access')}
          </div>
        )}

        {isSuperAdminUser && (
          <div className="settings-card" onClick={() => setCurrentView('setup-guide')}>
            <div className="settings-icon-box">
              <div className="ai-icon-placeholder">🚀</div>
            </div>
            <span className="settings-text">
              {t('setup_guide_card_label')}
            </span>
          </div>
        )}

        {canFields && (
          <div className="settings-card" onClick={handleMainMenuClick}>
            <div className="settings-icon-box">
              <img
                src="/CustomFieldsManager.png"
                alt="Custom Fields"
                className="settings-icon-img"
              />
            </div>
            <span className="settings-text">
              {t('settings_fields_manager')}
            </span>
          </div>
        )}

        {canUsersGroups && (
          <div className="settings-card" onClick={() => setCurrentView('users-groups-hub')}>
            <div className="settings-icon-box">
              <div className="ai-icon-placeholder">👥</div>
            </div>
            <span className="settings-text">{t('settings_users_groups_manager')}</span>
          </div>
        )}

        {canFields && (
          <div className="settings-card" onClick={() => setCurrentView('tickets-templates')}>
            <div className="settings-icon-box">
              <div className="ai-icon-placeholder">🎫</div>
            </div>
            <span className="settings-text">
              {t('tickets_and_templates')}
            </span>
          </div>
        )}


        {canAi && (
          <div className="settings-card" onClick={() => setCurrentView('ai-manager')}>
            <div className="settings-icon-box">
               <div className="ai-icon-placeholder">🤖</div>
            </div>
            <span className="settings-text">
              {t('settings_ai_manager')}
            </span>
          </div>
        )}

        {canEmail && (
          <div className="settings-card" onClick={() => setCurrentView('email-manager')}>
            <div className="settings-icon-box">
              <div className="ai-icon-placeholder">✉️</div>
            </div>
            <span className="settings-text">
              {t('settings_email_manager')}
            </span>
          </div>
        )}

        {canNotifications && (
          <div className="settings-card" onClick={() => setCurrentView('notification-manager')}>
            <div className="settings-icon-box">
              <div className="ai-icon-placeholder">🔔</div>
            </div>
            <span className="settings-text">
              {t('settings_notification_manager', { defaultValue: 'Notifications' })}
            </span>
          </div>
        )}
      </div>
    );
  }

  // 1b. Setup Guide View
  if (currentView === 'setup-guide') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <SetupGuidePage onNavigate={(view) => setCurrentView(view as ViewState)} />
      </div>
    );
  }

  // 2. Tickets & Templates View
  if (currentView === 'tickets-templates') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <TicketsTemplatesPage />
      </div>
    );
  }

  // 2b. Labels Management View
  if (currentView === 'labels-management') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToSelection}>
          ← {t('back_btn')}
        </button>
        <LabelsManagementPage />
      </div>
    );
  }

  // 2c. AI Manager View
  if (currentView === 'ai-manager') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <AIManager />
      </div>
    );
  }

  // 2d. Email Manager View
  if (currentView === 'email-manager') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <EmailManager />
      </div>
    );
  }

  // 2e. Notification Manager View
  if (currentView === 'notification-manager') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <NotificationManager />
      </div>
    );
  }

  // 3. Selection State (Field Definitions entity picker)
  if (currentView === 'selection') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <FieldEntityList onSelectEntity={handleEntitySelection} />
      </div>
    );
  }

  // 4. System Fields View
  if (currentView === 'system-fields') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToSelection}>
          ← {t('back_btn')}
        </button>
        <SystemFieldManager />
      </div>
    );
  }

  // 5. Users & Groups Hub
  if (currentView === 'users-groups-hub') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <UsersGroupsHub user={user} onSelect={(entity) => setCurrentView(entity)} />
      </div>
    );
  }

  // 6. Users View
  if (currentView === 'users') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToHub}>
          ← {t('back_btn')}
        </button>
        <UsersPage currentUser={user} />
      </div>
    );
  }

  // 7. Groups View
  if (currentView === 'groups') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToHub}>
          ← {t('back_btn')}
        </button>
        <GroupsPage currentUser={user} />
      </div>
    );
  }

  // 8. Group Custom Fields View
  if (currentView === 'group-custom-fields') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToSelection}>
          ← {t('back_btn')}
        </button>
        <FieldDefinitionsManager entityType="group" />
      </div>
    );
  }

  // 8b. Ticket Custom Fields View
  if (currentView === 'ticket-custom-fields') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToSelection}>
          ← {t('back_btn')}
        </button>
        <FieldDefinitionsManager entityType="ticket" />
      </div>
    );
  }

  // 9. LDAP View
  if (currentView === 'ldap') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToHub}>
          ← {t('back_btn')}
        </button>
        <LdapPage
          currentUser={user}
          retriggerConfigId={returnContext?.ldapConfigId}
          onMissingFields={handleLdapFieldsDetour}
          onRetriggerConsumed={() => setReturnContext(null)}
        />
      </div>
    );
  }

  // 10. Azure View
  if (currentView === 'azure') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToHub}>
          ← {t('back_btn')}
        </button>
        <AzurePage
          currentUser={user}
          retriggerConfigId={azureReturnContext?.azureConfigId}
          onMissingFields={handleAzureFieldsDetour}
          onRetriggerConsumed={() => setAzureReturnContext(null)}
        />
      </div>
    );
  }

  // 11. User Custom Fields View
  const isAzureDetour = !!azureReturnContext && !returnContext;
  return (
    <div className="view-container">
      <button className="back-button" onClick={
        isAzureDetour ? handleReturnFromAzureDetour :
        returnContext ? handleReturnFromDetour : handleBackToSelection
      }>
        ← {t('back_btn')}
      </button>
      <FieldDefinitionsManager
        entityType="user"
        returnContext={returnContext ?? undefined}
        azureReturnContext={azureReturnContext ?? undefined}
        onReturnFromDetour={returnContext ? handleReturnFromDetour : handleReturnFromAzureDetour}
      />
    </div>
  );
};
