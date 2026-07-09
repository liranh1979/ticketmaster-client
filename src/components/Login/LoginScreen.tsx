import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Login } from './Login';
import { useSystemSettings } from '../../contexts/SystemSettingsContext';
import api from '../../api';
import './Login.css';
import './LoginScreen.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

interface SsoProvider {
  id: number;
  display_name: string;
  sso_display_name: string | null;
  type: string;
}

type Screen = 'loading' | 'selection' | 'form';

interface LoginScreenProps {
  onLoginSuccess: (data: any) => void;
}

export const LoginScreen = ({ onLoginSuccess }: LoginScreenProps) => {
  const { t } = useTranslation();
  const { logoUrl } = useSystemSettings();
  const [providers, setProviders] = useState<SsoProvider[]>([]);
  const [screen, setScreen] = useState<Screen>('loading');
  const [activeProviderName, setActiveProviderName] = useState<string | null>(null);

  useEffect(() => {
    api.get('/sso/providers')
      .then(res => {
        setProviders(res.data);
        setScreen(res.data.length > 0 ? 'selection' : 'form');
      })
      .catch(() => setScreen('form'));
  }, []);

  return (
    <div className="login-split">
      <div
        className="login-split-brand"
        style={{ backgroundImage: `url(${logoUrl || '/logo.png'})` }}
      />

      <div className="login-split-form">
        <img className="login-mobile-logo" src={logoUrl || '/logo.png'} alt="TicketMaster Logo" />

        {screen === 'loading' && (
          <div className="auth-card">
            <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 0' }}>
              <div className="lsc-spinner" />
            </div>
          </div>
        )}

        {screen === 'form' && (
          <div className="login-form-slot">
            {providers.length > 0 && (
              <div className="lsc-back-wrap">
                <button className="lsc-back-btn" onClick={() => { setScreen('selection'); setActiveProviderName(null); }}>
                  {t('login_back_to_providers')}
                </button>
              </div>
            )}
            {activeProviderName && (
              <div className="lsc-provider-header">
                {t('login_with_provider', { name: activeProviderName })}
              </div>
            )}
            <Login onLoginSuccess={onLoginSuccess} />
          </div>
        )}

        {screen === 'selection' && (
          <div className="auth-card lsc-selection-card">
            <h2 className="lsc-title">{t('login_choose_provider')}</h2>

            <div className="lsc-providers">
              {providers.map(p => (
                <button
                  key={p.id}
                  className="lsc-provider-btn"
                  onClick={() => {
                    window.location.href = `${API_BASE}/saml2/login/${p.id}`;
                  }}
                >
                  <span className="lsc-provider-icon">☁️</span>
                  <span className="lsc-provider-name">{p.sso_display_name || p.display_name}</span>
                </button>
              ))}
            </div>

            <div className="lsc-divider">
              <span>{t('or_label')}</span>
            </div>

            <button
              className="lsc-manual-btn"
              onClick={() => { setActiveProviderName(null); setScreen('form'); }}
            >
              {t('login_manual_btn')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
