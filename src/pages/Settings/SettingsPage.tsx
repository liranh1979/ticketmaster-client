import { useTranslation } from 'react-i18next';
import './SettingsPage.css';

interface SettingsPageProps {
  // Callback to navigate between sub-settings (e.g. going into Field Manager)
  onNavigate: (view: string) => void;
}

export const SettingsPage = ({ onNavigate }: SettingsPageProps) => {
  const { t } = useTranslation();

  return (
    <div className="settings-grid">
      {/* 1. Custom Fields Manager Card */}
      <div 
        className="settings-card" 
        onClick={() => onNavigate('fields-manager')}
      >
        <div className="settings-icon-box">
          {/* Image from public/CustomFieldsManager.png */}
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

      {/* Future settings cards (e.g. User Management) can be added here */}
    </div>
  );
};
