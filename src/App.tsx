import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // 1. Import useTranslation
import api from './api';
import { Login } from './components/Login/Login.tsx';
import { Home } from './pages/Home';

function App() {
  // 2. 'ready' becomes true only after i18next successfully fetches the translation JSON from the backend
  const { ready } = useTranslation(); 
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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
        <Login onLoginSuccess={(userData: any) => setUser(userData)} />
      ) : (
        <Home user={user} />
      )}
    </div>
  );
}

export default App;
