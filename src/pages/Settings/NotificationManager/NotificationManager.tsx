import { useState, useEffect } from 'react';
import { Bell, ChevronDown, ChevronRight, RotateCcw, Save, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { RichTextEditor } from '../../../components/RichTextEditor/RichTextEditor';
import api from '../../../api';
import './NotificationManager.css';

interface NotificationTemplate {
  id: number;
  notificationType: string;
  displayName: string;
  description: string;
  isEnabled: boolean;
  subjectTemplate: string;
  bodyTemplate: string;
  isAdminFacing: boolean;
}

const SYSTEM_PLACEHOLDERS = [
  { key: '{{ticket_id}}',          label: 'Ticket ID' },
  { key: '{{ticket_title}}',       label: 'Ticket Title' },
  { key: '{{ticket_status}}',      label: 'Ticket Status' },
  { key: '{{ticket_description}}', label: 'Description' },
  { key: '{{ticket_url}}',         label: 'Ticket URL' },
  { key: '{{requester_name}}',     label: 'Requester Name' },
  { key: '{{responsible_name}}',   label: 'Responsible Name' },
];

interface TemplateEditorProps {
  template: NotificationTemplate;
  onSaved: (updated: NotificationTemplate) => void;
}

const TemplateEditor = ({ template, onSaved }: TemplateEditorProps) => {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(template.isEnabled);
  const [subject, setSubject] = useState(template.subjectTemplate);
  const [body, setBody] = useState(template.bodyTemplate);
  const [saving, setSaving] = useState(false);
  const [rollingBack, setRollingBack] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [insertTrigger, setInsertTrigger] = useState<{ text: string; count: number }>({ text: '', count: 0 });

  const insertPlaceholder = (key: string) => {
    setInsertTrigger(prev => ({ text: key, count: prev.count + 1 }));
  };

  const save = async () => {
    setSaving(true);
    setResult(null);
    try {
      const res = await api.patch(`/notifications/templates/${template.id}`, {
        isEnabled: enabled,
        subjectTemplate: subject,
        bodyTemplate: body,
      });
      setResult({ ok: true, msg: t('notification_saved_msg', { defaultValue: 'Template saved' }) });
      onSaved(res.data);
    } catch {
      setResult({ ok: false, msg: 'Failed to save template' });
    } finally {
      setSaving(false);
    }
  };

  const rollback = async () => {
    if (!confirm('Restore this template to the original default?')) return;
    setRollingBack(true);
    setResult(null);
    try {
      const res = await api.post(`/notifications/templates/${template.id}/rollback`);
      setSubject(res.data.subjectTemplate);
      setBody(res.data.bodyTemplate);
      setResult({ ok: true, msg: t('notification_restored_msg', { defaultValue: 'Restored to default' }) });
      onSaved(res.data);
    } catch {
      setResult({ ok: false, msg: 'Failed to restore default' });
    } finally {
      setRollingBack(false);
    }
  };

  return (
    <div className="nm-editor">
      <div className="nm-editor-header">
        <label className="nm-toggle-label">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => setEnabled(e.target.checked)}
          />
          <span className="nm-toggle-text">
            {t('notification_enabled_label', { defaultValue: 'Enable this notification' })}
          </span>
          <span className={`nm-status-pill ${enabled ? 'active' : 'inactive'}`}>
            {enabled ? 'Active' : 'Disabled'}
          </span>
        </label>
        {template.isAdminFacing && (
          <span className="nm-admin-chip">Admin-facing</span>
        )}
      </div>

      <div className="nm-field">
        <label className="nm-label">
          {t('notification_subject_label', { defaultValue: 'Email Subject' })}
        </label>
        <input
          className="nm-subject-input"
          value={subject}
          onChange={e => setSubject(e.target.value)}
        />
      </div>

      <div className="nm-field">
        <div className="nm-field-header">
          <label className="nm-label">
            {t('notification_body_label', { defaultValue: 'Email Body' })}
          </label>
          <div className="nm-placeholders">
            <span className="nm-placeholder-label">
              <Tag size={11} />
              {t('notification_insert_field_label', { defaultValue: 'Insert field' })}:
            </span>
            <div className="nm-placeholder-chips">
              {SYSTEM_PLACEHOLDERS.map(p => (
                <button
                  key={p.key}
                  className="nm-placeholder-chip"
                  onClick={() => insertPlaceholder(p.key)}
                  type="button"
                  title={p.key}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="nm-rte-wrap">
          <RichTextEditor
            content={body}
            onChange={setBody}
            insertTrigger={insertTrigger}
            placeholder="Email body HTML..."
          />
        </div>
      </div>

      <div className="nm-actions">
        {result && (
          <span className={`nm-result ${result.ok ? 'ok' : 'err'}`}>{result.msg}</span>
        )}
        <button className="nm-rollback-btn" onClick={rollback} disabled={rollingBack} type="button">
          <RotateCcw size={13} />
          {t('notification_rollback_btn', { defaultValue: 'Restore Default' })}
        </button>
        <button className="nm-save-btn" onClick={save} disabled={saving} type="button">
          <Save size={13} />
          {saving ? 'Saving…' : t('notification_save_btn', { defaultValue: 'Save Template' })}
        </button>
      </div>
    </div>
  );
};

export const NotificationManager = () => {
  const { t } = useTranslation();
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    api.get('/notifications/templates')
      .then(r => {
        setTemplates(r.data);
        if (r.data.length > 0) setExpandedId(r.data[0].id);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = (updated: NotificationTemplate) => {
    setTemplates(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
  };

  if (loading) {
    return (
      <div className="nm-container">
        <div className="nm-loading">Loading notification templates…</div>
      </div>
    );
  }

  return (
    <div className="nm-container">
      <div className="nm-page-header">
        <Bell size={20} className="nm-page-icon" />
        <div>
          <h2 className="nm-page-title">
            {t('settings_notification_manager', { defaultValue: 'Notifications' })}
          </h2>
          <p className="nm-page-desc">
            {t('notification_manager_desc', { defaultValue: 'Manage email notification templates for ticket events' })}
          </p>
        </div>
      </div>

      <div className="nm-list">
        {templates.map(tmpl => (
          <div key={tmpl.id} className={`nm-card ${expandedId === tmpl.id ? 'expanded' : ''}`}>
            <button
              className="nm-card-header"
              onClick={() => setExpandedId(expandedId === tmpl.id ? null : tmpl.id)}
              type="button"
            >
              <div className="nm-card-title-row">
                <span className={`nm-dot ${tmpl.isEnabled ? 'on' : 'off'}`} />
                <span className="nm-card-title">{tmpl.displayName}</span>
                {tmpl.isAdminFacing && <span className="nm-admin-chip">Admin</span>}
              </div>
              <div className="nm-card-right">
                <span className="nm-card-desc">{tmpl.description}</span>
                {expandedId === tmpl.id
                  ? <ChevronDown size={16} className="nm-chevron" />
                  : <ChevronRight size={16} className="nm-chevron" />
                }
              </div>
            </button>
            {expandedId === tmpl.id && (
              <TemplateEditor
                key={tmpl.id}
                template={tmpl}
                onSaved={handleSaved}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
