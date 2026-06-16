import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Sparkles, CheckCircle } from 'lucide-react';
import api from '../../api';
import { TicketFormRenderer } from '../../components/TicketFormRenderer/TicketFormRenderer';
import { isSuperAdmin, hasPermission, PERMISSIONS } from '../../utils/permissions';
import type { TemplateSummary, TemplateWithLayout, TemplateTab, AiAnalyzeResponse } from './ticketTypes';
import { flattenLayout } from './ticketTypes';
import './CreateTicketPage.css';

interface Props {
  user: any;
  onBack: () => void;
  onCreated: () => void;
}

type Mode = 'manual' | 'ai';

export const CreateTicketPage = ({ user, onBack, onCreated }: Props) => {
  const { t } = useTranslation();

  const [mode, setMode]                   = useState<Mode>('manual');
  const [templates, setTemplates]         = useState<TemplateSummary[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithLayout | null>(null);
  const [layoutTabs, setLayoutTabs]       = useState<TemplateTab[]>([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [values, setValues]               = useState<Record<string, any>>({});
  const [aiFilledFields, setAiFilledFields] = useState<string[]>([]);
  const [aiProblem, setAiProblem]         = useState('');
  const [aiResult, setAiResult]           = useState<AiAnalyzeResponse | null>(null);
  const [aiLoading, setAiLoading]         = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);

  useEffect(() => {
    api.get('/templates').then(r => {
      setTemplates(r.data);
      const defaultTpl = r.data.find((t: TemplateSummary) => t.isDefault) ?? r.data[0];
      if (defaultTpl) loadTemplate(defaultTpl.id);
    });
  }, []);

  const loadTemplate = async (id: number) => {
    setTemplateLoading(true);
    try {
      const { data } = await api.get(`/templates/${id}`);
      setSelectedTemplate(data);
      const tabs: TemplateTab[] = data.layout?.tabs ?? [];
      setLayoutTabs(tabs);
      const flat = flattenLayout(data.layout);
      const defaults: Record<string, any> = {};
      for (const f of flat) {
        if (f.fieldType === 'timer' && f.defaultValue) {
          try {
            const parsed = JSON.parse(f.defaultValue);
            if (parsed?.duration_value && parsed?.duration_unit) {
              defaults[f.fieldKey] = parsed;
              continue;
            }
          } catch {}
        }
        defaults[f.fieldKey] = f.defaultValue ?? '';
      }
      if (user?.red_id) defaults.request_user = String(user.red_id);
      setValues(defaults);
      setAiFilledFields([]);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleAiAnalyze = async () => {
    if (!aiProblem.trim()) return;
    setAiLoading(true);
    try {
      const { data }: { data: AiAnalyzeResponse } = await api.post('/tickets/ai-analyze', { problem: aiProblem });
      setAiResult(data);
      // Auto-select matched template
      if (data.matchedTemplateId) await loadTemplate(data.matchedTemplateId);
      // Apply suggested fields + labels
      const updates: Record<string, any> = { ...(data.suggestedFields ?? {}) };
      if (data.suggestedLabelIds?.length > 0) {
        updates.labels = data.suggestedLabelIds;
      }
      if (Object.keys(updates).length > 0) {
        setValues(prev => ({ ...prev, ...updates }));
        setAiFilledFields(Object.keys(data.suggestedFields ?? {}));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAcceptAll = () => {
    // Fields already applied; just clear the indicator
  };

  const handleClearAi = () => {
    setAiFilledFields([]);
    setAiResult(null);
    if (layoutTabs.length > 0) {
      const defaults: Record<string, any> = {};
      for (const f of layoutTabs.flatMap(t => t.fields)) defaults[f.fieldKey] = f.defaultValue ?? '';
      setValues(defaults);
    }
  };

  const handleSubmit = async () => {
    if (!selectedTemplate || !values.title?.trim()) return;
    setSubmitting(true);
    try {
      const labelIds = Array.isArray(values.labels)
        ? values.labels.map((l: any) => (typeof l === 'number' ? l : l.id))
        : [];

      await api.post('/tickets', {
        title:               values.title,
        description:         values.description ?? '',
        status:              values.status ?? 'new',
        templateId:          selectedTemplate.id,
        templateVersionId:   selectedTemplate.currentVersionId,
        requestUserId:       user?.red_id,
        responsibleUserId:   values.responsible?.id ?? null,
        responsibleGroupId:  null,
        ticketData:          values,
        labelIds,
      });
      onCreated();
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = isSuperAdmin(user) || hasPermission(user, PERMISSIONS.TICKET_MANAGER);
  const totalFieldCount = layoutTabs.reduce((n, tab) => n + tab.fields.length, 0);

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(templateSearch.toLowerCase())
  );

  return (
    <div className="cp-page">
      {/* Header */}
      <div className="cp-header">
        <div className="cp-header-left">
          <button className="cp-back-btn" onClick={onBack}><ArrowLeft size={16} /> {t('cancel_btn')}</button>
          <div>
            <p className="cp-breadcrumb">Tickets / New</p>
            <h1 className="cp-title">{t('create_ticket')}</h1>
            <p className="cp-subtitle">Choose how you want to start.</p>
          </div>
        </div>
        <div className="cp-mode-toggle">
          <button
            className={`cp-mode-btn${mode === 'manual' ? ' cp-mode-active' : ''}`}
            onClick={() => setMode('manual')}
          >
            🧱 {t('ticket_mode_manual')}
          </button>
          <button
            className={`cp-mode-btn${mode === 'ai' ? ' cp-mode-active' : ''}`}
            onClick={() => setMode('ai')}
          >
            ✨ {t('ticket_mode_ai')}
          </button>
        </div>
      </div>

      <div className="cp-body">
        {/* AI Agent Panel */}
        {mode === 'ai' && (
          <div className="cp-ai-panel">
            <div className="cp-ai-panel-header">
              <div className="cp-ai-icon">✨</div>
              <div>
                <p className="cp-ai-label">AI Ticket Assistant</p>
                <p className="cp-ai-tagline">Describe the issue — I'll pick the best template and pre-fill the fields.</p>
              </div>
            </div>

            <textarea
              className="cp-ai-textarea"
              rows={3}
              placeholder={t('ticket_ai_problem_placeholder')}
              value={aiProblem}
              onChange={e => setAiProblem(e.target.value)}
            />

            <div className="cp-ai-actions">
              <button
                className="cp-ai-analyze-btn"
                onClick={handleAiAnalyze}
                disabled={aiLoading || !aiProblem.trim()}
              >
                <Sparkles size={14} />
                {aiLoading ? t('ai_analyzing') : t('ai_analyze_btn')}
              </button>
              <p className="cp-ai-note">AI will suggest — you always confirm before submit.</p>
            </div>

            {aiLoading && (
              <div className="cp-ai-loading-state">
                <div className="cp-ai-thinking">
                  <div className="cp-ai-thinking-dots">
                    <span /><span /><span />
                  </div>
                  <span className="cp-ai-thinking-text">{t('ai_analyzing')}</span>
                </div>
                <div className="cp-ai-result-grid">
                  <div className="cp-ai-result-card cp-ai-skeleton" />
                  <div className="cp-ai-result-card cp-ai-skeleton" />
                  <div className="cp-ai-result-card cp-ai-skeleton" />
                </div>
              </div>
            )}

            {!aiLoading && aiResult && (
              <div className="cp-ai-result-grid">
                <div className="cp-ai-result-card cp-ai-template-card">
                  <p className="cp-ai-result-label">{t('ai_matched_template')}</p>
                  <p className="cp-ai-result-value">{aiResult.matchedTemplateName}</p>
                  <p className="cp-ai-confidence">Confidence <strong style={{ color: '#6ee7b7' }}>{aiResult.confidence}%</strong></p>
                </div>
                <div className="cp-ai-result-card">
                  <p className="cp-ai-result-label">Reasoning</p>
                  <p className="cp-ai-reasoning">{aiResult.reasoning}</p>
                </div>
                <div className="cp-ai-result-card">
                  <p className="cp-ai-result-label">{t('ai_suggested_labels')}</p>
                  <div className="cp-ai-label-chips">
                    {aiResult.suggestedLabelKeys.map(k => (
                      <span key={k} className="cp-ai-label-chip">{k}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Two-column form area */}
        <div className="cp-form-area">
          {/* Left: template picker */}
          <aside className="cp-template-rail">
            <p className="cp-rail-label">{t('ticket_template_picker_label')}</p>
            <div className="cp-template-search">
              🔎
              <input
                className="cp-template-search-input"
                placeholder={t('ticket_template_search')}
                value={templateSearch}
                onChange={e => setTemplateSearch(e.target.value)}
              />
            </div>
            <div className="cp-template-list">
              {aiResult && (
                <>
                  <p className="cp-template-group-label">Suggested by AI</p>
                  {templates.filter(t => t.id === aiResult.matchedTemplateId).map(tpl => (
                    <button
                      key={tpl.id}
                      className={`cp-template-item cp-template-ai${selectedTemplate?.id === tpl.id ? ' cp-template-selected' : ''}`}
                      onClick={() => loadTemplate(tpl.id)}
                    >
                      <span>{tpl.name}</span>
                      <span className="cp-ai-conf-badge">{aiResult.confidence}%</span>
                    </button>
                  ))}
                  <p className="cp-template-group-label" style={{ marginTop: 12 }}>All templates</p>
                </>
              )}
              {filteredTemplates.map(tpl => (
                <button
                  key={tpl.id}
                  className={`cp-template-item${selectedTemplate?.id === tpl.id ? ' cp-template-selected' : ''}`}
                  onClick={() => loadTemplate(tpl.id)}
                >
                  {tpl.name}
                  {tpl.isDefault && <span className="cp-default-badge">default</span>}
                </button>
              ))}
            </div>
            {selectedTemplate && (
              <div className="cp-rail-footer">
                Selected: <strong>{selectedTemplate.name}</strong><br />
                <span className="cp-rail-version">v{selectedTemplate.currentVersionNumber} • {totalFieldCount} fields</span>
              </div>
            )}
          </aside>

          {/* Right: form */}
          <section className="cp-form-section">
            {/* Form header */}
            <div className="cp-form-header">
              <div>
                <p className="cp-form-header-label">Using template</p>
                <p className="cp-form-header-title">
                  {selectedTemplate?.name ?? '—'}
                  {selectedTemplate && <span className="cp-version-badge">v{selectedTemplate.currentVersionNumber}</span>}
                </p>
              </div>
              <div className="cp-form-header-actions">
                <button className="cp-draft-btn">{t('save_draft')}</button>
                <button
                  className="cp-submit-btn"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedTemplate || !values.title}
                >
                  <CheckCircle size={15} />
                  {submitting ? '...' : t('create_ticket_btn')}
                </button>
              </div>
            </div>

            {/* AI prefill banner */}
            {aiFilledFields.length > 0 && (
              <div className="cp-ai-banner">
                <span>✨ {t('ai_prefilled_banner').replace('{n}', String(aiFilledFields.length))}</span>
                <div className="cp-ai-banner-actions">
                  <button className="cp-ai-banner-btn cp-ai-banner-accept" onClick={handleAcceptAll}>
                    {t('ai_accept_all')}
                  </button>
                  <button className="cp-ai-banner-btn" onClick={handleClearAi}>
                    {t('ai_clear_values')}
                  </button>
                </div>
              </div>
            )}

            {/* Form fields */}
            {templateLoading ? (
              <div className="cp-form-loading"><div className="tl-spinner" /></div>
            ) : layoutTabs.length > 0 ? (
              <TicketFormRenderer
                tabs={layoutTabs}
                values={values}
                onChange={(key, val) => setValues(prev => ({ ...prev, [key]: val }))}
                isAdmin={isAdmin}
                aiFilledFields={aiFilledFields}
              />
            ) : (
              <div className="cp-no-template">Select a template to begin</div>
            )}

            {/* Sticky bottom bar */}
            <div className="cp-bottom-bar">
              <p className="cp-bottom-info">
                {totalFieldCount} fields
                {aiFilledFields.length > 0 && ` • ${aiFilledFields.length} filled by AI`}
              </p>
              <div className="cp-bottom-actions">
                <button className="cp-cancel-btn" onClick={onBack}>{t('cancel_btn')}</button>
                <button className="cp-draft-btn">{t('save_draft')}</button>
                <button
                  className="cp-submit-btn"
                  onClick={handleSubmit}
                  disabled={submitting || !selectedTemplate || !values.title}
                >
                  <CheckCircle size={15} />
                  {submitting ? '...' : t('create_ticket_btn')}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
