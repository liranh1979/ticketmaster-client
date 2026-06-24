import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 1. Import useTranslation
import api from './api';
import i18n from './i18n';
import { useSystemSettings } from './contexts/SystemSettingsContext';
import { LoginScreen } from './components/Login/LoginScreen';
import { Home } from './pages/Home';
import './App.css';

function App() {
  // 2. 'ready' becomes true only after i18next successfully fetches the translation JSON from the backend
  const { ready } = useTranslation();
  const systemSettings = useSystemSettings();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const onUserUpdate = (partial: Record<string, any>) =>
    setUser((u: any) => ({ ...u, ...partial }));

  useEffect(() => {
    /**
     * Check if a valid session cookie exists on the backend
     */
    const checkSession = async () => {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch (err) {
        console.log("No active session found");
      } finally {
        setLoading(false);
      }
    };
    checkSession();
  }, []);

  // Personal language preference overrides the org-wide default for this user specifically.
  // Depends on the org default too so a slow /system-settings response (which also calls
  // i18n.changeLanguage) can never stomp an already-applied personal preference once it loads.
  useEffect(() => {
    if (user?.preferred_language) {
      i18n.changeLanguage(user.preferred_language);
    }
  }, [user?.preferred_language, systemSettings.defaultLanguageCode]);

  /**
   * IMPORTANT: Wait for BOTH session check AND translation files to be ready.
   * If 'ready' is false, it means i18next-http-backend is still fetching en.json.
   */
  if (loading || !ready) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Loading TicketMaster...</p>
      </div>
    );
  }

  return (
    <div className="App">
      {!user ? (
        <LoginScreen onLoginSuccess={(userData: any) => setUser(userData)} />
      ) : (
        <Home user={user} onUserUpdate={onUserUpdate} />
      )}
    </div>
  );
}

export default App;
