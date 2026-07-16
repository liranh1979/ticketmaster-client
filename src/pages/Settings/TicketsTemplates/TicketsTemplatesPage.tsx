import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Layers, Star, Sparkles } from 'lucide-react';
import api from '../../../api';
import { TemplateBuilderPage } from './TemplateBuilderPage';
import { AiWorkflowBuilderPage } from './AiWorkflowBuilderPage';
import './TicketsTemplatesPage.css';

interface TemplateSummary {
  id: number;
  name: string;
  description: string;
  currentVersionNumber: number;
  isDefault: boolean;
}

export const TicketsTemplatesPage = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);
  const [settingDefaultId, setSettingDefaultId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'templates' | 'ai-builder'>('templates');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/templates');
      setTemplates(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await api.post('/templates', { name: 'New Template', description: '' });
      setSelectedId(res.data.id);
    } finally {
      setCreating(false);
    }
  };

  const handleSetDefault = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSettingDefaultId(id);
    try {
      await api.patch(`/templates/${id}/set-default`);
      setTemplates(prev =>
        prev.map(tpl => ({ ...tpl, isDefault: tpl.id === id }))
      );
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(t('delete_template') + '?')) return;
    await api.delete(`/templates/${id}`);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  if (selectedId !== null) {
    return (
      <TemplateBuilderPage
        templateId={selectedId}
        onBack={() => { setSelectedId(null); load(); }}
      />
    );
  }

  return (
    <div className="tt-page">
      <div className="tt-header">
        <h2 className="tt-title">{t('template_management')}</h2>
        {activeTab === 'templates' && (
          <button className="tt-create-btn" onClick={handleCreate} disabled={creating}>
            <Plus size={16} /> {t('create_template')}
          </button>
        )}
      </div>

      <div className="tt-tabbar">
        <button
          className={`tt-tab-btn${activeTab === 'templates' ? ' active' : ''}`}
          onClick={() => setActiveTab('templates')}
        >
          <Layers size={13} /> {t('templates_tab', { defaultValue: 'Templates' })}
        </button>
        <button
          className={`tt-tab-btn${activeTab === 'ai-builder' ? ' active' : ''}`}
          onClick={() => setActiveTab('ai-builder')}
        >
          <Sparkles size={13} /> {t('ai_workflow_builder_tab', { defaultValue: 'AI Workflow Builder' })}
        </button>
      </div>

      {activeTab === 'ai-builder' ? (
        <AiWorkflowBuilderPage />
      ) : loading ? (
        <div className="tt-loading">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="tt-empty">{t('no_templates')}</div>
      ) : (
        <div className="tt-list">
          {templates.map(tpl => (
            <div
              key={tpl.id}
              className={`tt-card${tpl.isDefault ? ' tt-card-default' : ''}`}
              onClick={() => setSelectedId(tpl.id)}
            >
              <div className="tt-card-icon">
                <Layers size={22} />
              </div>
              <div className="tt-card-body">
                <div className="tt-card-name-row">
                  <span className="tt-card-name">{tpl.name}</span>
                  {tpl.isDefault && (
                    <span className="tt-default-badge">
                      <Star size={10} fill="currentColor" /> {t('default_template')}
                    </span>
                  )}
                </div>
                {tpl.description && <span className="tt-card-desc">{tpl.description}</span>}
              </div>
              <div className="tt-card-actions">
                <span className="tt-version-badge">v{tpl.currentVersionNumber}</span>
                <button
                  className={`tt-icon-btn tt-icon-star${tpl.isDefault ? ' tt-icon-star-active' : ''}`}
                  onClick={(e) => handleSetDefault(tpl.id, e)}
                  title={tpl.isDefault ? t('default_template') : t('set_as_default')}
                  disabled={settingDefaultId === tpl.id || tpl.isDefault}
                >
                  <Star size={15} fill={tpl.isDefault ? 'currentColor' : 'none'} />
                </button>
                <button className="tt-icon-btn" onClick={() => setSelectedId(tpl.id)} title={t('template_edit_mode')}>
                  <Pencil size={15} />
                </button>
                <button className="tt-icon-btn tt-icon-delete" onClick={(e) => handleDelete(tpl.id, e)} title={t('delete_template')}>
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
