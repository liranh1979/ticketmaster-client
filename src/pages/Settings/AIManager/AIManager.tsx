import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api';
import './AIManager.css';

interface AISetting {
  id: number;
  provider_name: string;
  model_name: string;
  is_active: boolean;
}

interface ProviderInfo {
  name: string;
  label: string;
  model_hint: string;
}

export const AIManager = () => {
  const { t } = useTranslation();
  const [settings, setSettings]   = useState<AISetting[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [loading, setLoading]     = useState(true);
  const [testResults, setTestResults] = useState<Record<number, string>>({});

  const [formData, setFormData] = useState({
    provider_name: '',
    api_key: '',
    model_name: ''
  });

  useEffect(() => {
    Promise.all([fetchSettings(), fetchProviders()]).finally(() => setLoading(false));
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/ai/settings');
      setSettings(res.data);
    } catch {
      console.error('Failed to load AI settings');
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await api.get('/ai/providers');
      setProviders(res.data);
    } catch {
      console.error('Failed to load provider list');
    }
  };

  const selectedProvider = providers.find(p => p.name === formData.provider_name);

  const handleProviderChange = (name: string) => {
    const p = providers.find(p => p.name === name);
    setFormData(prev => ({
      ...prev,
      provider_name: name,
      model_name: p?.model_hint ?? ''
    }));
  };

  const handleActivate = async (id: number) => {
    try {
      await api.patch(`/ai/settings/${id}/activate`);
      fetchSettings();
    } catch {
      alert(t('error_activating_provider'));
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('confirm_delete'))) return;
    try {
      await api.delete(`/ai/settings/${id}`);
      fetchSettings();
    } catch {
      alert(t('error_deleting_provider'));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/ai/settings', formData);
      setFormData({ provider_name: '', api_key: '', model_name: '' });
      fetchSettings();
    } catch {
      alert(t('error_adding_provider'));
    }
  };

  const handleTest = async (id: number) => {
    setTestResults(prev => ({ ...prev, [id]: t('ai_testing') }));
    try {
      const res = await api.post(`/ai/settings/${id}/test`);
      if (res.data.success) {
        setTestResults(prev => ({ ...prev, [id]: `✅ ${res.data.message}` }));
      } else {
        setTestResults(prev => ({ ...prev, [id]: `❌ ${res.data.message}` }));
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || t('ai_test_error');
      setTestResults(prev => ({ ...prev, [id]: `❌ ${errorMsg}` }));
    }
    setTimeout(() => {
      setTestResults(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 5000);
  };

  const providerLabel = (name: string) => providers.find(p => p.name === name)?.label ?? name;

  if (loading) return <div className="p-4">{t('loading_ai_manager')}</div>;

  return (
    <div className="ai-manager-container">
      <header className="ai-header">
        <h2>{t('ai_agent_management')}</h2>
        <p>{t('ai_management_desc')}</p>
      </header>

      <div className="ai-table-wrapper">
        <table className="ai-table">
          <thead>
            <tr>
              <th>{t('provider')}</th>
              <th>{t('model')}</th>
              <th>{t('status')}</th>
              <th>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.id} className={s.is_active ? 'row-active' : ''}>
                <td>{providerLabel(s.provider_name)}</td>
                <td>{s.model_name}</td>
                <td>
                  {s.is_active ? (
                    <span className="status-badge active">{t('active')}</span>
                  ) : (
                    <button className="activate-btn" onClick={() => handleActivate(s.id)}>
                      {t('set_active')}
                    </button>
                  )}
                </td>
                <td>
                  <div className="action-cell">
                    <button
                      className="test-btn"
                      onClick={() => handleTest(s.id)}
                      disabled={testResults[s.id] === t('ai_testing')}
                    >
                      {testResults[s.id] || `🧪 ${t('ai_test_btn')}`}
                    </button>
                    <button className="delete-icon-btn" onClick={() => handleDelete(s.id)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ai-form-card">
        <h3>{t('add_new_provider')}</h3>
        <form onSubmit={handleSubmit} className="ai-form">
          <select
            className="ai-select"
            value={formData.provider_name}
            onChange={e => handleProviderChange(e.target.value)}
            required
          >
            <option value="">{t('select_provider_placeholder')}</option>
            {providers.map(p => (
              <option key={p.name} value={p.name}>{p.label}</option>
            ))}
          </select>

          <input
            placeholder={selectedProvider ? selectedProvider.model_hint : t('model_placeholder')}
            value={formData.model_name}
            onChange={e => setFormData({ ...formData, model_name: e.target.value })}
            required
          />

          <input
            placeholder={t('api_key_placeholder')}
            type="password"
            value={formData.api_key}
            onChange={e => setFormData({ ...formData, api_key: e.target.value })}
            required
          />

          <button type="submit" className="save-btn">{t('save_provider')}</button>
        </form>
      </div>
    </div>
  );
};
