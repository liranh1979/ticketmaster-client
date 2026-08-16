import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2, Play, X, Sparkles } from 'lucide-react';
import api from '../../../api';
import { ReportConditionEditor } from './ReportConditionEditor';
import { buildCronExpression } from '../RecurringTickets/recurringCron';
import type { FrequencyType } from '../RecurringTickets/recurringCron';
import type { ConditionGroup, ReportDefinition, ReportField, ReportRun, PreviewResult } from './reportTypes';
import './ReportsPage.css';

// ── List ─────────────────────────────────────────────────────────────────────

export const ReportsPage = () => {
  const { t } = useTranslation();
  const [reports, setReports] = useState<ReportDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<ReportRun | null>(null);
  const [testResultName, setTestResultName] = useState<string>('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports');
      setReports(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleToggleActive = async (r: ReportDefinition) => {
    await api.patch(`/reports/${r.id}/active`, null, { params: { active: !r.isActive } });
    load();
  };

  const handleDelete = async (r: ReportDefinition) => {
    if (!window.confirm(t('reports_delete_confirm', { defaultValue: 'Delete this report? This cannot be undone.' }))) return;
    await api.delete(`/reports/${r.id}`);
    load();
  };

  const handleTest = async (r: ReportDefinition) => {
    setTestingId(r.id);
    try {
      const res = await api.post(`/reports/${r.id}/test-run`);
      setTestResult(res.data);
      setTestResultName(r.name);
      load();
    } finally {
      setTestingId(null);
    }
  };

  const scheduleSummary = (r: ReportDefinition): string => {
    if (!r.scheduleEnabled) return t('reports_schedule_manual_only', { defaultValue: 'Manual only' });
    const freq = r.frequencyType ? r.frequencyType.charAt(0) + r.frequencyType.slice(1).toLowerCase() : '';
    return r.nextRunAt ? `${freq} · next ${new Date(r.nextRunAt).toLocaleString()}` : freq;
  };

  const lastRunSummary = (r: ReportDefinition): string => {
    if (!r.lastRunAt) return t('reports_never_run', { defaultValue: 'Never run' });
    const when = new Date(r.lastRunAt).toLocaleString();
    const statusLabel = r.lastRunStatus === 'success' ? '✓ Success'
      : r.lastRunStatus === 'no_data' ? '⚠ No data found'
      : r.lastRunStatus === 'failed' ? '✗ Failed' : r.lastRunStatus;
    return `${when} · ${statusLabel}`;
  };

  if (editingId !== null) {
    return (
      <ReportEditForm
        reportId={editingId === 'new' ? null : editingId}
        onDone={() => { setEditingId(null); load(); }}
        onCancel={() => setEditingId(null)}
      />
    );
  }

  return (
    <div className="rp-page">
      <div className="rp-toolbar">
        <button className="tt-create-btn" onClick={() => setEditingId('new')}>
          <Plus size={16} /> {t('reports_add_btn', { defaultValue: '+ New Report' })}
        </button>
      </div>

      {loading ? (
        <div className="tt-loading">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="tt-empty">{t('reports_list_empty', { defaultValue: 'No reports configured yet.' })}</div>
      ) : (
        <table className="rp-tbl">
          <thead>
            <tr>
              <th>{t('reports_col_name', { defaultValue: 'Name' })}</th>
              <th>{t('reports_col_enabled', { defaultValue: 'Enabled' })}</th>
              <th>{t('reports_col_schedule', { defaultValue: 'Schedule' })}</th>
              <th>{t('reports_col_last_run', { defaultValue: 'Last Run' })}</th>
              <th>{t('reports_col_actions', { defaultValue: 'Actions' })}</th>
            </tr>
          </thead>
          <tbody>
            {reports.map(r => (
              <tr key={r.id} className={!r.isActive ? 'rp-row-disabled' : ''}>
                <td>{r.name}</td>
                <td>
                  <span
                    className={`rp-toggle${r.isActive ? ' on' : ''}`}
                    onClick={() => handleToggleActive(r)}
                  />
                </td>
                <td>{scheduleSummary(r)}</td>
                <td>{lastRunSummary(r)}</td>
                <td className="rp-row-actions">
                  <button className="tt-icon-btn" disabled={testingId === r.id} onClick={() => handleTest(r)} title={t('reports_test_btn', { defaultValue: 'Test' })}>
                    <Play size={14} />
                  </button>
                  <button className="tt-icon-btn" onClick={() => setEditingId(r.id)} title={t('reports_edit_btn', { defaultValue: 'Edit' })}>
                    <Pencil size={14} />
                  </button>
                  <button className="tt-icon-btn tt-icon-delete" onClick={() => handleDelete(r)} title={t('reports_delete_btn', { defaultValue: 'Delete' })}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {testResult && (
        <div className="rp-modal-backdrop" onClick={() => setTestResult(null)}>
          <div className="rp-modal" onClick={e => e.stopPropagation()}>
            <div className="rp-modal-header">
              <span>{testResultName}</span>
              <X size={16} className="rp-modal-close" onClick={() => setTestResult(null)} />
            </div>
            {testResult.status === 'no_data' ? (
              <div className="rp-test-nodata">
                ⚠ {t('reports_no_data_title', { defaultValue: 'No data was found' })}
                <div className="rp-test-sub">{t('reports_no_data_message', { defaultValue: "No data was found matching this report's criteria for the selected period." })}</div>
              </div>
            ) : testResult.status === 'failed' ? (
              <div className="rp-test-failed">✗ {testResult.errorMessage}</div>
            ) : (
              <div className="rp-test-success">✓ {testResult.rowCount} rows</div>
            )}
            {testResult.status !== 'failed' && (
              <div className="rp-dl-links">
                {testResult.csvPath && (
                  <a className="rp-dl rp-dl-csv" href={`/api/v1/reports/runs/${testResult.id}/download/csv`} target="_blank" rel="noreferrer">📄 report.csv</a>
                )}
                {testResult.pdfPath && (
                  <a className="rp-dl rp-dl-pdf" href={`/api/v1/reports/runs/${testResult.id}/download/pdf`} target="_blank" rel="noreferrer">📑 report.pdf</a>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Create / Edit ────────────────────────────────────────────────────────────

interface ReportEditFormProps {
  reportId: number | null;
  onDone: () => void;
  onCancel: () => void;
}

const DAY_OPTIONS = [
  { value: 2, label: 'Mon' }, { value: 3, label: 'Tue' }, { value: 4, label: 'Wed' },
  { value: 5, label: 'Thu' }, { value: 6, label: 'Fri' }, { value: 7, label: 'Sat' }, { value: 1, label: 'Sun' },
];

const ReportEditForm = ({ reportId, onDone, onCancel }: ReportEditFormProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState<ReportField[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>(['id', 'title', 'status', 'priority', 'createdAt']);
  const [conditions, setConditions] = useState<ConditionGroup>({ combinator: 'AND', conditions: [] });
  const [exportFormats, setExportFormats] = useState<string[]>(['csv', 'pdf']);
  const [isActive, setIsActive] = useState(true);
  const [aiGenerated, setAiGenerated] = useState(false);
  const [lastAiPrompt, setLastAiPrompt] = useState<string | undefined>();

  const [prompt, setPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [frequency, setFrequency] = useState<FrequencyType>('WEEKLY');
  const [dayOfWeek, setDayOfWeek] = useState(2);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(8);
  const [minute, setMinute] = useState(0);
  const [customCron, setCustomCron] = useState('');
  const [recipientType, setRecipientType] = useState<'users' | 'group'>('group');
  const [recipientUserIds, setRecipientUserIds] = useState<number[]>([]);
  const [recipientGroupId, setRecipientGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<{ id: number; displayName: string }[]>([]);
  const [users, setUsers] = useState<{ id: number; displayName: string; email: string }[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      const [fieldsRes, groupsRes, usersRes] = await Promise.all([
        api.get('/reports/field-catalog'),
        api.get('/reports/groups'),
        api.get('/reports/users'),
      ]);
      setFields(fieldsRes.data);
      setGroups(groupsRes.data);
      setUsers(usersRes.data);

      if (reportId != null) {
        const res = await api.get(`/reports/${reportId}`);
        const r: ReportDefinition = res.data;
        setName(r.name);
        setDescription(r.description || '');
        setSelectedFields(r.selectedFields);
        setConditions(r.conditions && r.conditions.combinator ? r.conditions : { combinator: 'AND', conditions: [] });
        setExportFormats(r.exportFormats);
        setIsActive(r.isActive);
        setAiGenerated(r.aiGenerated);
        if (r.scheduleEnabled) {
          setScheduleEnabled(true);
          setCustomCron(r.cronExpression || '');
          setFrequency((r.frequencyType as FrequencyType) || 'CUSTOM');
          if (r.recipientGroupId != null) {
            setRecipientType('group');
            setRecipientGroupId(r.recipientGroupId);
          } else if (r.recipientUserIds && r.recipientUserIds.length > 0) {
            setRecipientType('users');
            setRecipientUserIds(r.recipientUserIds);
          }
        }
      }
    })();
  }, [reportId]);

  const fieldLabel = (key: string) => fields.find(f => f.fieldKey === key)?.label || key;

  const removeField = (key: string) => setSelectedFields(prev => prev.filter(f => f !== key));
  const addField = (key: string) => {
    if (!key || selectedFields.includes(key)) return;
    setSelectedFields(prev => [...prev, key]);
  };

  const runAiBuild = async () => {
    if (!prompt.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const res = await api.post('/reports/ai-build-query', { prompt });
      const result: PreviewResult = res.data;
      setSelectedFields(result.selectedFields);
      setConditions(result.conditions && result.conditions.combinator ? result.conditions : { combinator: 'AND', conditions: [] });
      setPreview(result);
      setAiGenerated(true);
      setLastAiPrompt(prompt);
    } catch (e: any) {
      setAiError(e?.response?.data?.message || t('reports_ai_build_failed', { defaultValue: 'The AI did not return a valid report query. Try rephrasing, or build it manually.' }));
    } finally {
      setAiLoading(false);
    }
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await api.post('/reports/preview-query', { selectedFields, conditions });
      setPreview(res.data);
    } finally {
      setPreviewLoading(false);
    }
  };

  const nextRunPreview = (): string => {
    try {
      const cron = frequency === 'CUSTOM' ? customCron : buildCronExpression({ frequency, dayOfWeek, dayOfMonth, hour, minute, customCron });
      return cron || '';
    } catch {
      return '';
    }
  };

  const handleSave = async () => {
    setError('');
    if (!name.trim()) { setError(t('reports_name_required', { defaultValue: 'Report name is required' })); return; }
    if (selectedFields.length === 0) { setError(t('reports_fields_required', { defaultValue: 'At least one field must be selected' })); return; }
    if (scheduleEnabled && recipientType === 'group' && recipientGroupId == null) {
      setError(t('reports_group_required', { defaultValue: 'Choose a recipient group' })); return;
    }
    if (scheduleEnabled && recipientType === 'users' && recipientUserIds.length === 0) {
      setError(t('reports_users_required', { defaultValue: 'Choose at least one recipient user' })); return;
    }

    const payload: any = {
      name, description, selectedFields, conditions, exportFormats, isActive, aiGenerated, lastAiPrompt,
      scheduleEnabled,
    };
    if (scheduleEnabled) {
      payload.cronExpression = frequency === 'CUSTOM' ? customCron : buildCronExpression({ frequency, dayOfWeek, dayOfMonth, hour, minute, customCron });
      payload.frequencyType = frequency;
      if (recipientType === 'group') payload.recipientGroupId = recipientGroupId;
      else payload.recipientUserIds = recipientUserIds;
    }

    setSaving(true);
    try {
      if (reportId != null) await api.put(`/reports/${reportId}`, payload);
      else await api.post('/reports', payload);
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rp-page">
      <div className="rp-form-card">
        <div className="rp-form-title">
          {reportId != null ? t('reports_form_title_edit', { defaultValue: 'Edit Report' }) : t('reports_form_title_new', { defaultValue: 'New Report' })}
        </div>

        <div className="rp-form-row">
          <label className="rp-form-label">{t('reports_form_name_label', { defaultValue: 'Report name' })}</label>
          <input className="rp-input" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="rp-form-row">
          <label className="rp-form-label">{t('reports_form_description_label', { defaultValue: 'Description' })}</label>
          <input className="rp-input" value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Query builder */}
        <div className="rp-subcard">
          <div className="rp-subcard-h">{t('reports_ai_describe_label', { defaultValue: 'Describe the report you want' })}</div>
          <textarea className="rp-textarea" value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder={t('reports_ai_placeholder', { defaultValue: 'e.g. Show me tickets that breached SLA last month, grouped by priority' })} />
          <button className="rp-ai-btn" onClick={runAiBuild} disabled={aiLoading || !prompt.trim()}>
            <Sparkles size={14} /> {aiLoading ? '…' : t('reports_ai_build_btn', { defaultValue: 'Ask AI to Build This Query' })}
          </button>
          {aiError && <div className="rp-error">{aiError}</div>}

          <div className="rp-subcard-h" style={{ marginTop: '1rem' }}>{t('reports_selected_fields_label', { defaultValue: 'Selected fields' })}</div>
          <div className="rp-chips">
            {selectedFields.map(key => (
              <span className="rp-chip" key={key}>{fieldLabel(key)} <span className="rp-chip-x" onClick={() => removeField(key)}>✕</span></span>
            ))}
            <select className="rp-add-field-select" value="" onChange={e => addField(e.target.value)}>
              <option value="">{t('reports_add_field', { defaultValue: '+ Add field' })}</option>
              {fields.filter(f => !selectedFields.includes(f.fieldKey)).map(f => (
                <option key={f.fieldKey} value={f.fieldKey}>{f.label}</option>
              ))}
            </select>
          </div>

          <div className="rp-subcard-h" style={{ marginTop: '1rem' }}>{t('reports_conditions_label', { defaultValue: 'Conditions' })}</div>
          <ReportConditionEditor fields={fields} group={conditions} onChange={setConditions} />

          <button className="rp-preview-btn" onClick={runPreview} disabled={previewLoading}>
            {previewLoading ? '…' : t('reports_run_preview_btn', { defaultValue: 'Preview' })}
          </button>

          {preview && (
            <>
              <div className="rp-subcard-h" style={{ marginTop: '1rem' }}>
                {t('reports_preview_label', { defaultValue: 'Preview' })} — {preview.matchCount} {t('reports_rows_match', { defaultValue: 'rows match' })}
                {preview.matchCount > preview.previewRows.length && (
                  <span className="rp-preview-cap-note"> ({t('reports_preview_capped_note', { defaultValue: 'capped at 50 for preview' })})</span>
                )}
              </div>
              <table className="rp-preview-tbl">
                <thead><tr>{selectedFields.map(f => <th key={f}>{fieldLabel(f)}</th>)}</tr></thead>
                <tbody>
                  {preview.previewRows.slice(0, 10).map((row, i) => (
                    <tr key={i}>{selectedFields.map(f => <td key={f}>{String(row[f] ?? '')}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>

        {/* Export formats */}
        <div className="rp-subcard">
          <div className="rp-subcard-h">{t('reports_export_formats_label', { defaultValue: 'Export Formats' })}</div>
          <label className="rp-checkline">
            <input type="checkbox" checked={exportFormats.includes('csv')}
              onChange={e => setExportFormats(prev => e.target.checked ? [...prev, 'csv'] : prev.filter(x => x !== 'csv'))} /> CSV
          </label>
          <label className="rp-checkline">
            <input type="checkbox" checked={exportFormats.includes('pdf')}
              onChange={e => setExportFormats(prev => e.target.checked ? [...prev, 'pdf'] : prev.filter(x => x !== 'pdf'))} /> PDF
          </label>
        </div>

        {/* Schedule */}
        <div className="rp-subcard">
          <div className="rp-subcard-h">
            <label className="rp-checkline">
              <input type="checkbox" checked={scheduleEnabled} onChange={e => setScheduleEnabled(e.target.checked)} />
              {t('reports_schedule_enable_label', { defaultValue: 'Send this report on a schedule' })}
            </label>
          </div>
          {scheduleEnabled && (
            <>
              <div className="rp-pills">
                {(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM'] as FrequencyType[]).map(f => (
                  <span key={f} className={`rp-pill${frequency === f ? ' on' : ''}`} onClick={() => setFrequency(f)}>
                    {t(`reports_freq_${f.toLowerCase()}`, { defaultValue: f.charAt(0) + f.slice(1).toLowerCase() })}
                  </span>
                ))}
              </div>

              {frequency === 'WEEKLY' && (
                <div className="rp-pills">
                  {DAY_OPTIONS.map(d => (
                    <span key={d.value} className={`rp-pill sm${dayOfWeek === d.value ? ' on' : ''}`} onClick={() => setDayOfWeek(d.value)}>{d.label}</span>
                  ))}
                </div>
              )}
              {frequency === 'MONTHLY' && (
                <div className="rp-form-row">
                  <label className="rp-form-label">{t('recurring_form_day_of_month_label', { defaultValue: 'Day of Month' })}</label>
                  <input className="rp-input rp-input-sm" type="number" min={1} max={28} value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))} />
                </div>
              )}
              {frequency === 'CUSTOM' ? (
                <div className="rp-form-row">
                  <label className="rp-form-label">{t('recurring_form_cron_label', { defaultValue: 'Cron Expression' })}</label>
                  <input className="rp-input" value={customCron} onChange={e => setCustomCron(e.target.value)} placeholder="0 0 8 * * ?" />
                </div>
              ) : (
                <div className="rp-form-row">
                  <label className="rp-form-label">{t('recurring_form_time_label', { defaultValue: 'Time' })}</label>
                  <input className="rp-input rp-input-sm" type="number" min={0} max={23} value={hour} onChange={e => setHour(Number(e.target.value))} />
                  :
                  <input className="rp-input rp-input-sm" type="number" min={0} max={59} value={minute} onChange={e => setMinute(Number(e.target.value))} />
                </div>
              )}

              <div className="rp-next-run">📅 {t('reports_next_run_label', { defaultValue: 'Next run' })}: {nextRunPreview()}</div>

              <div className="rp-subcard-h" style={{ marginTop: '.75rem' }}>{t('reports_recipients_label', { defaultValue: 'Recipients' })}</div>
              <div className="rp-recip-toggle">
                <span className={`rp-recip-opt${recipientType === 'users' ? ' active' : ''}`} onClick={() => setRecipientType('users')}>
                  {t('reports_recipients_users', { defaultValue: 'Admin user(s)' })}
                </span>
                <span className={`rp-recip-opt${recipientType === 'group' ? ' active' : ''}`} onClick={() => setRecipientType('group')}>
                  {t('reports_recipients_group', { defaultValue: 'Group' })}
                </span>
              </div>
              {recipientType === 'group' ? (
                <select className="rp-input" value={recipientGroupId ?? ''} onChange={e => setRecipientGroupId(e.target.value ? Number(e.target.value) : null)}>
                  <option value="">—</option>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.displayName}</option>)}
                </select>
              ) : (
                <select multiple className="rp-input rp-multiselect" value={recipientUserIds.map(String)}
                  onChange={e => setRecipientUserIds(Array.from(e.target.selectedOptions).map(o => Number(o.value)))}>
                  {users.map(u => <option key={u.id} value={u.id}>{u.displayName} ({u.email})</option>)}
                </select>
              )}
            </>
          )}
        </div>

        {error && <div className="rp-error">{error}</div>}

        <div className="rp-form-actions">
          <button className="tt-icon-btn" onClick={onCancel}>{t('cancel', { defaultValue: 'Cancel' })}</button>
          <button className="rp-save-btn" onClick={handleSave} disabled={saving}>
            {saving ? '…' : t('reports_save_btn', { defaultValue: 'Save Report' })}
          </button>
        </div>
      </div>
    </div>
  );
};
