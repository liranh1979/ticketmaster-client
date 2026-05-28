import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldEntityList } from './FieldManager/FieldEntityList';
import { SystemFieldManager } from './LanguageManager/SystemFieldManager';
import { FieldDefinitionsManager } from './FieldDefinitions/FieldDefinitionsManager';
import { AIManager } from './AIManager/AIManager';
import { UsersPage } from './UsersManager/UsersPage';
import './SettingsPage.css';

interface SettingsPageProps {
  onNavigate: (view: string) => void;
}

export const SettingsPage = ({ onNavigate }: SettingsPageProps) => {
  const { t } = useTranslation();
  
  const [currentView, setCurrentView] = useState<'menu' | 'selection' | 'system-fields' | 'custom-fields' | 'group-custom-fields' | 'ai-manager' | 'users'>('menu');

  const handleMainMenuClick = () => {
    setCurrentView('selection');
  };

  const handleEntitySelection = (entity: string, category: string) => {
    if (category === 'system') {
      setCurrentView('system-fields');
    } else if (entity === 'group') {
      setCurrentView('group-custom-fields');
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

  // 1. Initial State: Main Settings Grid
  if (currentView === 'menu') {
    return (
      <div className="settings-grid">
        {/* Fields Manager Card */}
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

        {/* Users Manager Card */}
        <div className="settings-card" onClick={() => setCurrentView('users')}>
          <div className="settings-icon-box">
            <div className="ai-icon-placeholder">👥</div>
          </div>
          <span className="settings-text">{t('settings_users_manager')}</span>
        </div>

        {/* NEW: AI Agent Manager Card */}
        <div className="settings-card" onClick={() => setCurrentView('ai-manager')}>
          <div className="settings-icon-box">
             <div className="ai-icon-placeholder">🤖</div> 
             {/* Replace with <img src="/AIAgentManager.png" className="settings-icon-img" /> later */}
          </div>
          <span className="settings-text">
            {t('settings_ai_manager')}
          </span>
        </div>
      </div>
    );
  }

  // 2. AI Manager View
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

  // 3. Selection State
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

  // 4. System View
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

  // 5. Users View
  if (currentView === 'users') {
    return (
      <div className="view-container">
        <button className="back-button" onClick={handleBackToMenu}>
          ← {t('back_btn')}
        </button>
        <UsersPage />
      </div>
    );
  }

  // 6. Group Custom Fields View
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

  // 7. User Custom Fields View
  return (
    <div className="view-container">
      <button className="back-button" onClick={handleBackToSelection}>
        ← {t('back_btn')}
      </button>
      <FieldDefinitionsManager entityType="user" />
    </div>
  );
};