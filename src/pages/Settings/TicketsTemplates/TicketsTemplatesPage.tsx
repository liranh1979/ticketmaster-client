import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Layers } from 'lucide-react';
import api from '../../../api';
import { TemplateBuilderPage } from './TemplateBuilderPage';
import './TicketsTemplatesPage.css';

interface TemplateSummary {
  id: number;
  name: string;
  description: string;
  currentVersionNumber: number;
}

export const TicketsTemplatesPage = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

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
        <button className="tt-create-btn" onClick={handleCreate} disabled={creating}>
          <Plus size={16} /> {t('create_template')}
        </button>
      </div>

      {loading ? (
        <div className="tt-loading">Loading...</div>
      ) : templates.length === 0 ? (
        <div className="tt-empty">{t('no_templates')}</div>
      ) : (
        <div className="tt-list">
          {templates.map(tpl => (
            <div key={tpl.id} className="tt-card" onClick={() => setSelectedId(tpl.id)}>
              <div className="tt-card-icon"><Layers size={22} /></div>
              <div className="tt-card-body">
                <span className="tt-card-name">{tpl.name}</span>
                {tpl.description && <span className="tt-card-desc">{tpl.description}</span>}
              </div>
              <div className="tt-card-actions">
                <span className="tt-version-badge">v{tpl.currentVersionNumber}</span>
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
