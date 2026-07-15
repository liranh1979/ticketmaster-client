import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 1. Import useTranslation
import api from './api';
import i18n from './i18n';
import { useSystemSettings } from './contexts/SystemSettingsContext';
import { LoginScreen } from './components/Login/LoginScreen';
import { Home } from './pages/Home';
import { CsatSurveyPage } from './pages/Csat/CsatSurveyPage';
import { WorkflowApprovalPage } from './pages/WorkflowApproval/WorkflowApprovalPage';
import './App.css';

// CSAT survey links (?csat=<token>) must work for a logged-out requester and must
// never touch session/auth machinery — checked once, outside the component, so it's
// a plain value (not a hook) and stays stable for the component's whole lifetime.
const csatToken = new URLSearchParams(window.location.search).get('csat');

// Same reasoning, same pattern, for one-click email approval links (?approval=<token>&action=...).
const approvalParams = new URLSearchParams(window.location.search);
const approvalToken = approvalParams.get('approval');
const approvalAction = approvalParams.get('action') === 'reject' ? 'reject' : approvalParams.get('action') === 'approve' ? 'approve' : null;

function App() {
  // 2. 'ready' becomes true only after i18next successfully fetches the translation JSON from the backend
  const { ready } = useTranslation();
  const systemSettings = useSystemSettings();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const onUserUpdate = (partial: Record<string, any>) =>
    setUser((u: any) => ({ ...u, ...partial }));

  useEffect(() => {
    // On a CSAT survey or workflow-approval link, skip the session check entirely — calling
    // /auth/me while logged out would 401, and api.ts's global interceptor reloads the page on
    // any 401, which would loop forever on this route.
    if (csatToken || approvalToken) { setLoading(false); return; }

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

  if (csatToken) {
    return <CsatSurveyPage token={csatToken} />;
  }

  if (approvalToken) {
    return <WorkflowApprovalPage token={approvalToken} initialAction={approvalAction} />;
  }

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
        <div className="login-page-wrapper">
          <LoginScreen onLoginSuccess={(userData: any) => setUser(userData)} />
        </div>
      ) : (
        <Home user={user} onUserUpdate={onUserUpdate} />
      )}
    </div>
  );
}

export default App;
