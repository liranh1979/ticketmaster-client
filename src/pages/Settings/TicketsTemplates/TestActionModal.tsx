import { useState } from 'react';
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

const DEFAULT_SAMPLE: Record<string, string> = {
  title: 'Sample Ticket Title',
  description: 'Sample ticket description',
  status: 'open',
  priority: 'medium',
};

export const TestActionModal = ({ type, nodeId, templateId, typeConfig, referencedTicketFields, onClose }: Props) => {
  const fields = referencedTicketFields.length > 0 ? referencedTicketFields : ['title'];
  const [sampleValues, setSampleValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f, DEFAULT_SAMPLE[f] ?? `sample_${f}`]))
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
      setResult({ success: false, error: err?.response?.data?.message || 'Test request failed' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="tam-overlay" onClick={onClose}>
      <div className="tam-modal" onClick={e => e.stopPropagation()}>
        <div className="tam-header">
          <span className="tam-title"><Play size={13} /> Test this call now</span>
          <button className="wfd-icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="tam-body">
          <div className="tam-sec">
            <div className="tam-sec-lbl">SAMPLE TICKET VALUES</div>
            <p className="wfd-hint-xs">Nothing is saved or sent to a real ticket — these values only feed this one-off test run.</p>
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
            {running ? <><Loader2 size={13} className="mte-spin" /> Running…</> : <><Play size={13} /> Run Test</>}
          </button>

          {result && (
            <div className={`tam-result${result.success ? ' tam-result--ok' : ' tam-result--err'}`}>
              <div className="tam-result-head">
                {result.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {result.success ? 'Succeeded' : 'Failed'}
              </div>
              {result.error && <p className="tam-error-text">{result.error}</p>}

              {result.callTrace && result.callTrace.length > 0 && (
                <div className="tam-sec">
                  <div className="tam-sec-lbl">CALL TRACE</div>
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
                  <div className="tam-sec-lbl">CAPTURED VALUES</div>
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
