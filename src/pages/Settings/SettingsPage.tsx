import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FieldEntityList } from './FieldManager/FieldEntityList';
import { SystemFieldManager } from './LanguageManager/SystemFieldManager';
import './SettingsPage.css';

interface SettingsPageProps {
  onNavigate: (view: string) => void;
}

export const SettingsPage = ({ onNavigate }: SettingsPageProps) => {
  const { t } = useTranslation();
  
  // Track which sub-view we are in: 'menu', 'selection', or 'system-fields'
  const [currentView, setCurrentView] = useState<'menu' | 'selection' | 'system-fields' | 'custom-fields'>('menu');

  // Handle when the user clicks a card in the main settings grid
  const handleMainMenuClick = () => {
    setCurrentView('selection');
  };

  // Handle when the user picks between "System" or "User" inside the FieldEntityList
  const handleEntitySelection = (entity: string, category: string) => {
    if (category === 'system') {
      setCurrentView('system-fields');
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

  // 1. Initial State: Show the main settings grid (TicketMaster dashboard style)
  if (currentView === 'menu') {
    return (
      <div className="settings-grid">
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
      </div>
    );
  }

  // 2. Middle State: Show the "System Fields" vs "User Custom Fields" cards
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

  // 3. System View: Show the Translation Sidebar and Grid
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

  // 4. Custom View: Show your standard fields table
  return (
    <div className="view-container">
      <button className="back-button" onClick={handleBackToSelection}>
        ← {t('back_btn')}
      </button>
      <h3>{t('managing_fields_for')}: User</h3>
      <p>Table with API data will go here.</p>
      {/* <UserFieldsTable /> */}
    </div>
  );
};