import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import api from '../../api'; // Custom axios instance with baseURL and credentials

interface LoginProps {
  onLoginSuccess: (data: any) => void;
}

export const Login = ({ onLoginSuccess }: LoginProps) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);

  /**
   * Handles the login form submission
   */
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Endpoint is now relative to the baseURL defined in api.ts
      const res = await api.post('/auth/login', form);
      
      // Notify parent component on successful authentication
      onLoginSuccess(res.data);
    } catch (err: any) {
      // Display localized error message or fallback to default
      const errorMessage = err.response?.data?.error || 'Invalid Login';
      alert(t('login_error') || errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h1 className="login-heading">{t('login_heading', { defaultValue: 'Welcome back' })}</h1>
      <p className="login-subheading">{t('login_subheading', { defaultValue: 'Sign in to your account to continue' })}</p>

      <form onSubmit={handleLogin}>
        <div className="input-group">
          <label>{t('login_username')}</label>
          <input 
            type="text" 
            required
            autoComplete="username"
            onChange={e => setForm({ ...form, username: e.target.value })} 
          />
        </div>
        
        <div className="input-group">
          <label>{t('login_password')}</label>
          <input 
            type="password" 
            required
            autoComplete="current-password"
            onChange={e => setForm({ ...form, password: e.target.value })} 
          />
        </div>
        
        <button 
          type="submit" 
          className="btn-primary" 
          disabled={loading}
        >
          {loading ? '...' : t('login_submit_btn')}
        </button>
      </form>
    </div>
  );
};
