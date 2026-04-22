import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Topbar } from '../components/Topbar/Topbar';
import { SettingsPage } from './Settings/SettingsPage';
import { FieldEntityList } from './Settings/FieldManager/FieldEntityList'; // Import the new component

interface HomeProps {
  user: {
    display_name: string;
    red_id: number;
    user_name: string;
    // add any other user properties you use
  } | null;
}

export const Home = ({ user }: HomeProps) => {
  const { t } = useTranslation();
  
  // Track which main view we are in
  const [currentView, setCurrentView] = useState<'welcome' | 'settings' | 'fields-manager'>('welcome');
  
  // Track which entity we are currently managing (e.g., 'user')
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  return (
    <div className="home-layout">
      <Topbar 
        user={user} 
        onSettingsClick={() => {
          setCurrentView('settings');
          setSelectedEntity(null); // Reset when going back to settings
        }} 
      />

      <main className="main-content">
        {currentView === 'welcome' && (
          <div className="welcome-card">
            <h1>{t('welcome_hello')}, {user?.display_name}!</h1>
            <p>{t('home_subtitle')}</p>
          </div>
        )}

        {currentView === 'settings' && (
          <SettingsPage onNavigate={(view) => setCurrentView(view as any)} />
        )}

        {currentView === 'fields-manager' && (
          <div className="manager-container">
            {/* Navigation Header */}
            <div style={{ marginBottom: '20px' }}>
              <button 
                onClick={() => {
                  if (selectedEntity) setSelectedEntity(null);
                  else setCurrentView('settings');
                }}
                className="back-button"
              >
                ← {t('back_btn')}
              </button>
            </div>

            {!selectedEntity ? (
              /* Step 1: Choose Users or other entities */
              <FieldEntityList onSelectEntity={(entity) => setSelectedEntity(entity)} />
            ) : (
              /* Step 2: The actual management table (we build this next) */
              <div>
                <h2>{t('managing_fields_for')}: {selectedEntity}</h2>
                <p>Table with API data will go here.</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};