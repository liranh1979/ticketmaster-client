import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Play, Loader2, CheckCircle2, XCircle, Sparkles } from 'lucide-react';
import api from '../../../api';
import { WorkflowFieldSuggestions, type WorkflowFieldSuggestion } from './WorkflowFieldSuggestions';
import type { FieldMappingRequest } from './ExternalApiCallsEditor';
import { AiAgentAdjustPanel, type AiAgentAdjustProposal } from './AiAgentAdjustPanel';
import './TestActionModal.css';

interface Props {
  type: 'external_api' | 'mcp_tool';
  // Optional — the AI Workflow Builder wizard has no saved template/node yet (it saves into the
  // Action Item Library, a different entity), so it always omits both; WorkflowActionTestService
  // already handles that combination gracefully (falls back to whatever plaintext auth is in the
  // draft typeConfig, no template/node lookup attempted).
  nodeId?: string;
  templateId?: number;
  typeConfig: Record<string, unknown>;
  referencedTicketFields: string[];
  // Absent when rendered inline (see `inline` below) — an inline render has no overlay/close
  // affordance of its own, the host page provides its own navigation instead.
  onClose?: () => void;
  // When true, renders just the body content in normal page flow — no fixed overlay, no modal
  // chrome, no close button. Used by AiWorkflowBuilderPage's Step 2, which wants this exact
  // run-test-then-map-response UI as its primary full-page content rather than a popup (the
  // Designer's existing usage omits this and keeps getting the original floating-modal behavior).
  inline?: boolean;
  // Present only when the caller wants "Auto-map from this response" available (opt-in — the
  // Designer's existing usage passes none of these, so nothing changes there).
  ticketFields?: { key: string; type: string }[];
  workflowFieldCatalog?: { key: string; type: string }[];
  intent?: string;
  documentation?: string;
  onApplyMapping?: (proposal: AutoMapProposal) => void;
  onWorkflowFieldCreated?: (key: string) => void;
  // "Fix with AI" (external_api only) — continues the guided wizard's persisted AiChatSession, so
  // the AI still has the original intent/documentation/matched-fields context when asked to re-fix
  // a call that just failed a real test. Omitted by the Designer's existing usage, same opt-in
  // pattern as onApplyMapping above.
  sessionId?: number | null;
  requestMappings?: FieldMappingRequest[];
  onApplyCallFix?: (fix: AiAgentAdjustProposal) => void;
  // Controlled sample-values/result state (both optional, always used together) — a real bug
  // found live: the AI Workflow Builder wizard conditionally renders this component per step, so
  // navigating Back and then forward again unmounts and remounts a fresh instance, silently
  // resetting whatever the admin had typed or last ran. Lifting this state to the wizard (which
  // stays mounted across step changes) fixes that; the Designer's existing floating-modal usage
  // omits both and keeps today's uncontrolled (reset-on-reopen, but never unmounted mid-use)
  // behavior.
  sampleValues?: Record<string, string>;
  onSampleValuesChange?: (v: Record<string, string>) => void;
  result?: TestResult | null;
  onResultChange?: (r: TestResult | null) => void;
}

interface CallTraceEntry {
  callId?: string;
  name: string;
  request?: string;
  status?: number | string;
  responsePreview?: string;
  rawResponse?: string;
  rawResult?: string;
}

export interface TestResult {
  success: boolean;
  error?: string;
  capturedValues?: Record<string, unknown>;
  callTrace?: CallTraceEntry[];
}

// Result of POST /templates/ai-refine-response-mapping, reshaped for the caller to fold into its
// own draft state — never applied automatically, only ever handed to onApplyMapping after the
// admin explicitly reviews and clicks "Apply to draft".
export interface AutoMapProposal {
  calls: { id: string; responseCaptures: { name: string; jsonPath?: string; resultPath?: string; summary?: string }[] }[];
  fieldMappingsResponse: { captureName: string; target: string }[];
  missingWorkflowFields: WorkflowFieldSuggestion[];
}

export const TestActionModal = ({
  type, nodeId, templateId, typeConfig, referencedTicketFields, onClose, inline,
  ticketFields, workflowFieldCatalog, intent, documentation, onApplyMapping, onWorkflowFieldCreated,
  sessionId, requestMappings, onApplyCallFix,
  sampleValues: controlledSampleValues, onSampleValuesChange, result: controlledResult, onResultChange,
}: Props) => {
  const { t } = useTranslation();
  const defaultSample: Record<string, string> = {
    title: t('test_action_sample_title', { defaultValue: 'Sample Ticket Title' }),
    description: t('test_action_sample_description', { defaultValue: 'Sample ticket description' }),
    status: 'open',
    priority: 'medium',
  };
  // A real bug found live: some fieldMappings.request entries store "ticketField" bare (e.g.
  // "local_airport") while others store it "ticket."-prefixed (e.g. "ticket.api_key") — both are
  // valid/supported by ExternalApiActionExecutor.resolveInputField (a documented back-compat
  // case), but this form used to key its sample-value inputs and the sampleTicketFields sent to
  // the backend by the RAW, unnormalized string. That meant a prefixed entry showed as an ugly
  // "ticket.api_key" input AND — the actual bug — the value typed under that key could never
  // reach the backend's lookup, since resolveInputField strips a "ticket." prefix before reading
  // ticketData, so it looked up "api_key" while this form had sent "ticket.api_key". Also filters
  // out any "this.<key>" entries — those read the workflow item's own data, which doesn't exist
  // in test mode (no real item), so they'd always resolve empty regardless; showing them as a
  // fake "ticket value" input would be misleading.
  const fields = Array.from(new Set(
    referencedTicketFields
      .filter(f => !f.startsWith('this.'))
      .map(f => f.startsWith('ticket.') ? f.slice('ticket.'.length) : f)
  ));
  if (fields.length === 0) fields.push('title');

  // Uncontrolled fallback (the Designer's floating-modal usage) — the controlled props above take
  // over entirely when the caller supplies them (the wizard).
  const [localSampleValues, setLocalSampleValues] = useState<Record<string, string>>({});
  const sampleValues = controlledSampleValues ?? localSampleValues;
  const updateSampleValue = (field: string, value: string) => {
    const next = { ...sampleValues, [field]: value };
    if (onSampleValuesChange) onSampleValuesChange(next);
    else setLocalSampleValues(next);
  };

  const [localResult, setLocalResult] = useState<TestResult | null>(null);
  const result = controlledResult !== undefined ? controlledResult : localResult;
  const setResult = (r: TestResult | null) => {
    if (onResultChange) onResultChange(r);
    else setLocalResult(r);
  };

  // Every field always resolves to a real value (typed, or a sensible default) at both render
  // time and submit time — sampleValues itself may be sparse (e.g. `{}` right after a controlled
  // parent first mounts this), never assume a key is present.
  const resolvedSampleValues: Record<string, string> = Object.fromEntries(
    fields.map(f => [f, sampleValues[f] ?? defaultSample[f] ?? `sample_${f}`])
  );

  const [running, setRunning] = useState(false);
  // Which CALL TRACE row (by index) is showing its full response instead of the compact scroll
  // box — a real bug found live: the box only ever rendered `responsePreview`, which the backend
  // caps at 2000 chars mid-string (no regard for JSON structure), so any real API response bigger
  // than that showed up looking "broken" (a dangling key, no closing braces) even though the AI's
  // own "Map Response Fields" call already grounds on the much fuller `rawResponse` (up to 200,000
  // chars) — the admin just had no way to see that same fuller text to verify it themselves.
  const [expandedTraceIndex, setExpandedTraceIndex] = useState<number | null>(null);

  const [autoMapping, setAutoMapping] = useState(false);
  const [autoMapError, setAutoMapError] = useState('');
  const [autoMapProposal, setAutoMapProposal] = useState<AutoMapProposal | null>(null);

  // "Fix with AI" (external_api only) — offered when a real test fails; which call it targets
  // (only matters when there's more than one).
  const calls = (typeConfig.calls as Record<string, unknown>[] | undefined) ?? [];
  const [fixCallId, setFixCallId] = useState('');

  const run = async () => {
    setRunning(true);
    setResult(null);
    setAutoMapProposal(null);
    setAutoMapError('');
    try {
      const res = await api.post('/templates/test-workflow-action', {
        templateId, nodeId, type, typeConfig, sampleTicketFields: resolvedSampleValues,
      });
      setResult(res.data);
    } catch (err: any) {
      const failed = { success: false, error: err?.response?.data?.message || t('test_request_failed', { defaultValue: 'Test request failed' }) };
      setResult(failed);
    } finally {
      setRunning(false);
    }
  };

  const runAutoMap = async () => {
    if (!result?.callTrace) return;
    setAutoMapping(true);
    setAutoMapError('');
    setAutoMapProposal(null);
    try {
      const rawCalls = ((typeConfig.calls as any[]) ?? []).map(c => {
        const trace = result.callTrace!.find(t => t.callId === c.id);
        return {
          id: c.id,
          name: c.name ?? c.toolName,
          existingResponseCaptures: c.responseCaptures,
          rawResponse: trace?.rawResponse ?? trace?.rawResult ?? '',
        };
      });
      const res = await api.post('/templates/ai-refine-response-mapping', {
        type,
        intent: intent ?? '',
        documentation: documentation ?? '',
        ticketFields: ticketFields ?? [],
        workflowFields: workflowFieldCatalog ?? [],
        calls: rawCalls,
      });
      setAutoMapProposal({
        calls: res.data.calls ?? [],
        fieldMappingsResponse: res.data.fieldMappings?.response ?? [],
        missingWorkflowFields: res.data.missingWorkflowFields ?? [],
      });
    } catch (err: any) {
      setAutoMapError(err?.response?.data?.message || t('test_action_auto_map_failed', { defaultValue: 'Could not generate a mapping suggestion.' }));
    } finally {
      setAutoMapping(false);
    }
  };

  const proposalUsedBy = (key: string): string[] => {
    const needle = `this.${key}`;
    return (autoMapProposal?.fieldMappingsResponse ?? [])
      .filter(m => m.target === needle)
      .map(m => `response: ${m.captureName}`);
  };

  const applyMapping = () => {
    if (!autoMapProposal) return;
    onApplyMapping?.(autoMapProposal);
    setAutoMapProposal(null);
  };

  const bodyContent = (
    <>
      <div className="tam-sec">
        <div className="tam-sec-lbl">{t('sample_ticket_values_label', { defaultValue: 'SAMPLE TICKET VALUES' })}</div>
        <p className="wfd-hint-xs">{t('test_action_sample_hint', { defaultValue: 'Nothing is saved or sent to a real ticket — these values only feed this one-off test run.' })}</p>
        {fields.map(f => (
          <div key={f} className="tam-field-row">
            <span className="tam-field-key">{f}</span>
            <input
              className="wfd-inp"
              value={resolvedSampleValues[f]}
              onChange={e => updateSampleValue(f, e.target.value)}
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

          {/* "Fix with AI" — external_api only, offered when a real test just failed. Continues
              the guided wizard's persisted AiChatSession (sessionId) so the AI still has the
              original documentation/intent/field-mapping context, not just this one call in
              isolation. When there's more than one call, the admin picks which one to fix. */}
          {!result.success && type === 'external_api' && onApplyCallFix && calls.length > 0 && (
            <>
              {calls.length > 1 && (
                <div className="tam-sec">
                  <select
                    className="wfd-sel"
                    value={fixCallId || (calls[0]?.id as string) || ''}
                    onChange={e => setFixCallId(e.target.value)}
                  >
                    {calls.map(c => (
                      <option key={c.id as string} value={c.id as string}>{(c.name as string) ?? (c.id as string)}</option>
                    ))}
                  </select>
                </div>
              )}
              <AiAgentAdjustPanel
                call={calls.find(c => c.id === fixCallId) ?? calls[0]}
                requestMappings={requestMappings ?? []}
                sessionId={sessionId ?? null}
                documentation={documentation ?? ''}
                intent={intent ?? ''}
                ticketFields={ticketFields ?? []}
                workflowFieldCatalog={workflowFieldCatalog ?? []}
                error={result.error || t('test_result_failed', { defaultValue: 'Failed' }) as string}
                onApply={onApplyCallFix}
              />
            </>
          )}

          {result.callTrace && result.callTrace.length > 0 && (
            <div className="tam-sec">
              <div className="tam-sec-lbl">{t('call_trace_label', { defaultValue: 'CALL TRACE' })}</div>
              {result.callTrace.map((c, i) => {
                // The full (up to 200,000-char) body — the same text the AI's own "Map Response
                // Fields" step grounds on — falling back to the short, possibly-mid-string-cut
                // responsePreview only if nothing fuller was captured at all.
                const fullResponse = c.rawResponse || c.rawResult || c.responsePreview || '';
                const expanded = expandedTraceIndex === i;
                return (
                  <div key={i} className="tam-trace-row">
                    <div className="tam-trace-top">
                      <span className="tam-trace-name">{c.name}</span>
                      <span className="tam-trace-status">{String(c.status ?? '')}</span>
                    </div>
                    {c.request && <div className="tam-trace-req">{c.request}</div>}
                    {fullResponse && (
                      <>
                        <pre className={`tam-trace-resp${expanded ? ' tam-trace-resp--expanded' : ''}`}>{fullResponse}</pre>
                        <button
                          className="wfd-btn-ghost tam-trace-expand-btn"
                          onClick={() => setExpandedTraceIndex(expanded ? null : i)}
                        >
                          {expanded
                            ? t('test_action_show_less_btn', { defaultValue: 'Show less' })
                            : t('test_action_show_full_response_btn', { defaultValue: 'Show full response' })}
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
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

          {/* "Auto-map from this response" — only offered when the caller opted in (passed
              onApplyMapping) and there's an actual real response to ground the AI's analysis
              in, whether or not the overall test succeeded (a failed call's raw response is
              often exactly what's needed to see why nothing captured). */}
          {onApplyMapping && result.callTrace && result.callTrace.length > 0 && (
            <div className="tam-sec">
              <button className="wfd-btn-ghost tam-automap-btn" onClick={runAutoMap} disabled={autoMapping}>
                {autoMapping
                  ? <><Loader2 size={13} className="mte-spin" /> {t('test_action_auto_map_running', { defaultValue: 'Analyzing response…' })}</>
                  : <><Sparkles size={13} /> {t('test_action_auto_map_btn', { defaultValue: 'Map Response Fields' })}</>}
              </button>
              {autoMapError && <p className="tam-error-text">{autoMapError}</p>}

              {autoMapProposal && (
                <div className="tam-proposal">
                  <div className="tam-sec-lbl">{t('test_action_proposed_changes_heading', { defaultValue: 'PROPOSED MAPPING CHANGES' })}</div>
                  {autoMapProposal.calls.map(c => (
                    <div key={c.id} className="tam-proposal-call">
                      {c.responseCaptures.map((cap, i) => (
                        <div key={i} className="tam-proposal-capture">
                          <div className="tam-field-row">
                            <span className="tam-field-key">{cap.name}</span>
                            <span className="tam-captured-val">{cap.jsonPath ?? cap.resultPath}</span>
                          </div>
                          {cap.summary && <p className="wfd-hint-xs">{cap.summary}</p>}
                        </div>
                      ))}
                    </div>
                  ))}
                  {autoMapProposal.fieldMappingsResponse.map((m, i) => (
                    <div key={i} className="tam-field-row">
                      <span className="tam-field-key">{m.captureName}</span>
                      <span className="tam-captured-val">→ {m.target}</span>
                    </div>
                  ))}
                  {autoMapProposal.missingWorkflowFields.length > 0 && (
                    <WorkflowFieldSuggestions
                      suggestions={autoMapProposal.missingWorkflowFields}
                      usedBy={proposalUsedBy}
                      onCreated={key => onWorkflowFieldCreated?.(key)}
                    />
                  )}
                  <button className="wfd-btn-save tam-apply-btn" onClick={applyMapping}>
                    {t('test_action_apply_mapping_btn', { defaultValue: 'Apply to draft' })}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (inline) {
    return <div className="tam-inline">{bodyContent}</div>;
  }

  return (
    <div className="tam-overlay" onClick={onClose}>
      <div className="tam-modal" onClick={e => e.stopPropagation()}>
        <div className="tam-header">
          <span className="tam-title"><Play size={13} /> {t('test_action_btn', { defaultValue: 'Test this call now' })}</span>
          <button className="wfd-icon-btn" onClick={onClose}><X size={14} /></button>
        </div>

        <div className="tam-body">
          {bodyContent}
        </div>
      </div>
    </div>
  );
};
