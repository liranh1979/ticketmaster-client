import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import api from '../../../api';
import './TestActionModal.css';

interface Props {
  type: 'external_api' | 'mcp_tool';
  nodeId: string;
  templateId?: number;
  typeConfig: Record<string, unknown>;
  referencedTicketFields: string[];
  onClose: () => void;
}

interface CallTraceEntry {
  name: string;
  request?: string;
  status?: number | string;
  responsePreview?: string;
}

interface TestResult {
  success: boolean;
  error?: string;
  capturedValues?: Record<string, unknown>;
  callTrace?: CallTraceEntry[];
}

export const TestActionModal = ({ type, nodeId, templateId, typeConfig, referencedTicketFields, onClose }: Props) => {
  const { t } = useTranslation();
  const defaultSample: Record<string, string> = {
    title: t('test_action_sample_title', { defaultValue: 'Sample Ticket Title' }),
    description: t('test_action_sample_description', { defaultValue: 'Sample ticket description' }),
    status: 'open',
    priority: 'medium',
  };
  const fields = referencedTicketFields.length > 0 ? referencedTicketFields : ['title'];
  const [sampleValues, setSampleValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f, defaultSample[f] ?? `sample_${f}`]))
  );
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  const run = async () => {
    setRunning(true);
    setResult(null);
    try {
      const res = await api.post('/templates/test-workflow-action', {
        templateId, nodeId, type, typeConfig, sampleTicketFields: sampleValues,
      });
      setResult(res.data);
    } catch (err: any) {
      setResult({ success: false, error: err?.response?.data?.message || t('test_request_failed', { defaultValue: 'Test request failed' }) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="tam-overlay" onClick={onClose}>
      <div className="tam-modal" onClick={e => e.stopPropagation()}>
        <div className="tam-header">
          <span className="tam-title"><Play size={13} /> {t('test_action_btn', { defaultValue: 'Test this call now' })}</span>
          <button className="wfd-icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="tam-body">
          <div className="tam-sec">
            <div className="tam-sec-lbl">{t('sample_ticket_values_label', { defaultValue: 'SAMPLE TICKET VALUES' })}</div>
            <p className="wfd-hint-xs">{t('test_action_sample_hint', { defaultValue: 'Nothing is saved or sent to a real ticket — these values only feed this one-off test run.' })}</p>
            {fields.map(f => (
              <div key={f} className="tam-field-row">
                <span className="tam-field-key">{f}</span>
                <input
                  className="wfd-inp"
                  value={sampleValues[f] ?? ''}
                  onChange={e => setSampleValues(prev => ({ ...prev, [f]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <button className="wfd-btn-save tam-run-btn" onClick={run} disabled={running}>
            {running ? <><Loader2 size={13} className="mte-spin" /> {t('running_ellipsis', { defaultValue: 'Running…' })}</> : <><Play size={13} /> {t('run_test_btn', { defaultValue: 'Run Test' })}</>}
          </button>

          {result && (
            <div className={`tam-result${result.success ? ' tam-result--ok' : ' tam-result--err'}`}>
              <div className="tam-result-head">
                {result.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {result.success ? t('test_result_succeeded', { defaultValue: 'Succeeded' }) : t('test_result_failed', { defaultValue: 'Failed' })}
              </div>
              {result.error && <p className="tam-error-text">{result.error}</p>}

              {result.callTrace && result.callTrace.length > 0 && (
                <div className="tam-sec">
                  <div className="tam-sec-lbl">{t('call_trace_label', { defaultValue: 'CALL TRACE' })}</div>
                  {result.callTrace.map((c, i) => (
                    <div key={i} className="tam-trace-row">
                      <div className="tam-trace-top">
                        <span className="tam-trace-name">{c.name}</span>
                        <span className="tam-trace-status">{String(c.status ?? '')}</span>
                      </div>
                      {c.request && <div className="tam-trace-req">{c.request}</div>}
                      {c.responsePreview && <pre className="tam-trace-resp">{c.responsePreview}</pre>}
                    </div>
                  ))}
                </div>
              )}

              {result.capturedValues && Object.keys(result.capturedValues).length > 0 && (
                <div className="tam-sec">
                  <div className="tam-sec-lbl">{t('captured_values_label', { defaultValue: 'CAPTURED VALUES' })}</div>
                  {Object.entries(result.capturedValues).map(([k, v]) => (
                    <div key={k} className="tam-field-row">
                      <span className="tam-field-key">{k}</span>
                      <span className="tam-captured-val">{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
