import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api'; 
import './AIManager.css';

interface AISetting {
  id: number;
  provider_name: string;
  base_url: string;
  model_name: string;
  is_active: boolean;
}

export const AIManager = () => {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<AISetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [testResults, setTestResults] = useState<Record<number, string>>({});

  const [formData, setFormData] = useState({
    provider_name: '',
    api_key: '',
    base_url: '',
    model_name: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/ai/settings');
      setSettings(res.data);
    } catch (err) {
      console.error("Failed to load AI settings");
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await api.patch(`/ai/settings/${id}/activate`);
      fetchSettings(); 
    } catch (err) {
      alert("Error activating provider");
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('confirm_delete') || 'Are you sure?')) return;
    try {
      await api.delete(`/ai/settings/${id}`);
      fetchSettings();
    } catch (err) {
      alert("Error deleting provider");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/ai/settings', formData);
      setFormData({ provider_name: '', api_key: '', base_url: '', model_name: '' });
      fetchSettings();
    } catch (err) {
      alert("Error adding AI provider");
    }
  };

  const handleTest = async (id: number) => {
    setTestResults(prev => ({ ...prev, [id]: 'Testing...' }));
    try {
      const res = await api.post(`/ai/settings/${id}/test`);
      if (res.data.success) {
        setTestResults(prev => ({ ...prev, [id]: '✅ OK' }));
      } else {
        setTestResults(prev => ({ ...prev, [id]: '❌ Error' }));
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed';
      setTestResults(prev => ({ ...prev, [id]: `❌ ${errorMsg}` }));
    }
    
    // Clear status after 5 seconds
    setTimeout(() => {
      setTestResults(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, 5000);
  };

  if (loading) return <div className="p-4">Loading AI Manager...</div>;

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
                <td>{s.provider_name}</td>
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
                      disabled={testResults[s.id] === 'Testing...'}
                    >
                      {testResults[s.id] || '🧪 Test'}
                    </button>
                    
                    <button 
                      className="delete-icon-btn" 
                      onClick={() => handleDelete(s.id)}
                    >
                      🗑️
                    </button>
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
          <div className="form-row">
            <input 
              placeholder="Provider (e.g. OpenAI)" 
              value={formData.provider_name}
              onChange={e => setFormData({...formData, provider_name: e.target.value})}
              required
            />
            <input 
              placeholder="Model (e.g. gpt-4o)" 
              value={formData.model_name}
              onChange={e => setFormData({...formData, model_name: e.target.value})}
              required
            />
          </div>
          <input 
            placeholder="API Key" 
            type="password"
            value={formData.api_key}
            onChange={e => setFormData({...formData, api_key: e.target.value})}
            required
          />
          <input 
            placeholder="Base URL (Optional)" 
            value={formData.base_url}
            onChange={e => setFormData({...formData, base_url: e.target.value})}
          />
          <button type="submit" className="save-btn">{t('save_provider')}</button>
        </form>
      </div>
    </div>
  );
};