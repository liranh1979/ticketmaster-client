import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import api from '../api';
import i18n from '../i18n';

export interface SystemSettings {
  defaultLanguageCode: string;
  defaultTimezone: string;
  defaultTimeFormat: '12h' | '24h';
  logoUrl: string | null;
}

interface SystemSettingsContextValue extends SystemSettings {
  loading: boolean;
  refresh: () => Promise<void>;
}

const DEFAULTS: SystemSettings = {
  defaultLanguageCode: 'en',
  defaultTimezone: 'UTC',
  defaultTimeFormat: '24h',
  logoUrl: null,
};

const SystemSettingsContext = createContext<SystemSettingsContextValue>({
  ...DEFAULTS,
  loading: true,
  refresh: async () => {},
});

export const useSystemSettings = () => useContext(SystemSettingsContext);

export const SystemSettingsProvider = ({ children }: { children: ReactNode }) => {
  const [settings, setSettings] = useState<SystemSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await api.get<SystemSettings>('/system-settings');
      setSettings(res.data);
      if (res.data.defaultLanguageCode && i18n.language !== res.data.defaultLanguageCode) {
        i18n.changeLanguage(res.data.defaultLanguageCode);
      }
    } catch (err) {
      console.error('Failed to load system settings — using defaults', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SystemSettingsContext.Provider value={{ ...settings, loading, refresh: load }}>
      {children}
    </SystemSettingsContext.Provider>
  );
};
