import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Topbar } from '../components/Topbar/Topbar';
import { SettingsPage } from './Settings/SettingsPage';
import { TaskProgressPanel } from '../components/TaskProgressPanel/TaskProgressPanel';

interface HomeProps {
  user: {
    display_name: string;
    red_id: number;
    user_name: string;
    is_super_admin?: boolean;
    effective_permissions?: string[];
  } | null;
}

export const Home = ({ user }: HomeProps) => {
  const { t } = useTranslation();
  const [currentView, setCurrentView] = useState<'welcome' | 'settings'>('welcome');

  return (
    <div className="home-layout">
      <TaskProgressPanel />
      <Topbar
        user={user}
        onSettingsClick={() => setCurrentView('settings')}
      />

      <main className="main-content">
        {currentView === 'welcome' && (
          <div className="welcome-card">
            <h1>{t('welcome_hello')}, {user?.display_name}!</h1>
            <p>{t('home_subtitle')}</p>
          </div>
        )}

        {currentView === 'settings' && (
          <SettingsPage user={user} onNavigate={(view) => setCurrentView(view as any)} />
        )}
      </main>
    </div>
  );
};
