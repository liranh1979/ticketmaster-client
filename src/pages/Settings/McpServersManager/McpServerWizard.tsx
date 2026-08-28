import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import CodeMirror from '@uiw/react-codemirror';
import { python } from '@codemirror/lang-python';
import { ArrowLeft, Loader2, Sparkles, AlertCircle, CheckCircle2 } from 'lucide-react';
import api from '../../../api';
import type { McpServer } from './McpServersPage';
import './McpServerWizard.css';

interface McpTool {
  name: string;
  description?: string;
  method?: string;
  path?: string;
  args?: Array<{ name: string; type?: string; required?: boolean; location?: string; description?: string }>;
  output?: { description?: string; fields?: Array<{ name: string; type?: string; description?: string }> };
}

interface DiscoveredTool {
  name: string;
  description: string;
  /** Real JSON Schema from the deployed server (ground truth — may differ slightly from the
   * AI's Step 2 design proposal if the generated script deviated). Drives Step 5's generated
   * form — one labeled field per parameter. The admin never sees this shape directly, only the
   * plain-language fields built from it. */
  input_schema?: { type?: string; properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
}

/** Turns a raw parameter/property key into a readable label — "charge_amount" → "Charge Amount" —
 * so the generated test form never shows a snake_case identifier as-is. */
function humanizeLabel(key: string): string {
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

/** Empty starting value per parameter, keyed by name, seeded from the real input schema — an
 * unchecked box for booleans, blank text otherwise. Never JSON; the admin only ever sees and
 * fills in one labeled field per parameter. */
function buildArgFormDefaults(schema: DiscoveredTool['input_schema']): Record<string, string | boolean> {
  if (!schema?.properties) return {};
  const out: Record<string, string | boolean> = {};
  for (const [key, prop] of Object.entries(schema.properties)) {
    out[key] = prop?.type === 'boolean' ? false : '';
  }
  return out;
}

/** Converts the admin's plain-field values back into the real typed args object the tool call
 * actually needs — this is the only place JSON-shaped data exists, and it's built by code, never
 * typed by the admin. */
function coerceArgValues(values: Record<string, string | boolean>, schema: DiscoveredTool['input_schema']): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(values)) {
    const type = schema?.properties?.[key]?.type;
    if (type === 'boolean') { out[key] = !!raw; continue; }
    const str = String(raw ?? '').trim();
    if (type === 'number' || type === 'integer') { out[key] = str === '' ? undefined : Number(str); continue; }
    if (type === 'array') { out[key] = str === '' ? [] : str.split(',').map(s => s.trim()).filter(Boolean); continue; }
    out[key] = str;
  }
  return out;
}

function isFlatObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) &&
    Object.values(v as Record<string, unknown>).every(x => x === null || ['string', 'number', 'boolean'].includes(typeof x));
}

function KeyValueRows({ obj }: { obj: Record<string, unknown> }) {
  return (
    <div className="mcp-kv-rows">
      {Object.entries(obj).map(([k, v]) => (
        <div key={k} className="mcp-kv-row">
          <span className="mcp-kv-key">{humanizeLabel(k)}</span>
          <span className="mcp-kv-val">{v === null || v === undefined ? '—' : String(v)}</span>
        </div>
      ))}
    </div>
  );
}

/** A single MCP content block's text, shown as plain labeled rows when it's simple flat JSON,
 * else as plain text — pretty-printed JSON is the last resort, not the default. */
function TextOrData({ text }: { text: string }) {
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { return <p className="mcp-result-text">{text}</p>; }
  if (isFlatObject(parsed)) return <KeyValueRows obj={parsed} />;
  if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isFlatObject)) {
    return <>{(parsed as Record<string, unknown>[]).map((row, i) => (
      <div key={i} className="mcp-result-row-group"><KeyValueRows obj={row} /></div>
    ))}</>;
  }
  return <pre className="mcp-raw-fallback">{JSON.stringify(parsed, null, 2)}</pre>;
}

/** MCP tool results are typically a list of content blocks (most commonly {type:"text", text:"…"})
 * — unwrap those and present the underlying data as plain rows, never raw JSON, unless the shape
 * genuinely can't be summarized simply. */
function renderResultContent(content: unknown) {
  const blocks = Array.isArray(content) ? content : [content];
  const texts = blocks
    .map((b: any) => (b && typeof b === 'object' && typeof b.text === 'string') ? b.text : null)
    .filter((s): s is string => s !== null);
  if (texts.length > 0) return <>{texts.map((text, i) => <TextOrData key={i} text={text} />)}</>;
  if (typeof content === 'string') return <TextOrData text={content} />;
  return <pre className="mcp-raw-fallback">{JSON.stringify(content, null, 2)}</pre>;
}

interface McpServerWizardProps {
  mode: 'create' | 'edit' | 'fix';
  server?: McpServer;
  onClose: () => void;
  onSaved: () => void;
}

type Step = 'form' | 'tools' | 'script' | 'result';

export const McpServerWizard = ({ mode, server, onClose, onSaved }: McpServerWizardProps) => {
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>(mode === 'create' ? 'form' : mode === 'edit' ? 'script' : 'result');
  const [error, setError] = useState('');

  // Step 1 — form
  const [name, setName] = useState(server?.name ?? '');
  const [description, setDescription] = useState(server?.description ?? '');
  const [baseUrl, setBaseUrl] = useState(server?.target_api_base_url ?? '');
  const [docs, setDocs] = useState('');
  const [docUrl, setDocUrl] = useState('');
  const [fetchingDoc, setFetchingDoc] = useState(false);
  const [fetchDocError, setFetchDocError] = useState('');
  const [authType, setAuthType] = useState<'none' | 'api_key' | 'bearer'>('none');
  const [authLocation, setAuthLocation] = useState<'header' | 'query' | 'body'>('header');
  const [authName, setAuthName] = useState('');
  const [authSecret, setAuthSecret] = useState('');
  const [analyzing, setAnalyzing] = useState(false);

  // Step 2 — tool design
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [tools, setTools] = useState<(McpTool & { selected: boolean })[]>([]);
  const [generating, setGenerating] = useState(false);

  // Step 3 — script review
  const [script, setScript] = useState('');
  const [dependencies, setDependencies] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingScript, setLoadingScript] = useState(mode === 'edit');

  // Step 4 — result / test & verify
  const [resultServer, setResultServer] = useState<McpServer | null>(server ?? null);
  const [availableTools, setAvailableTools] = useState<DiscoveredTool[]>([]);
  // Real gap found live: a small local model can approve a tool design listing N input
  // parameters, then write a generated script whose function only implements some of them — the
  // deployed tool silently ends up with fewer real inputs than intended, invisible until an
  // admin notices missing fields much later while building an action item. The backend compares
  // the deployed schema against the originally approved design on every test-connection call, so
  // this surfaces immediately instead of downstream.
  const [designMismatches, setDesignMismatches] = useState<{ tool: string; missing_args: string[]; not_deployed: boolean }[]>([]);
  const [testToolName, setTestToolName] = useState('');
  // One plain-text/number/checkbox value per parameter, keyed by parameter name — the admin never
  // sees or types JSON. Converted to a real args object (right types) only at submit time.
  const [testArgValues, setTestArgValues] = useState<Record<string, string | boolean>>({});
  const [testResult, setTestResult] = useState<{ isError: boolean; content: any } | null>(null);
  const [testing, setTesting] = useState(false);
  const [fixDescription, setFixDescription] = useState('');
  const [fixing, setFixing] = useState(false);
  const [recentLogs, setRecentLogs] = useState('');

  // ── load current script when editing ─────────────────────────────────────
  useEffect(() => {
    if (mode === 'edit' && server) {
      api.get(`/mcp-servers/${server.id}/script`)
        .then(res => {
          setScript(res.data.script_content || '');
          setDependencies(res.data.dependencies || '');
        })
        .catch(() => setError(t('mcp_load_script_failed', { defaultValue: 'Could not load the current script.' }) as string))
        .finally(() => setLoadingScript(false));
    }
  }, [mode, server, t]);

  // ── load recent logs whenever there's a non-running result to explain ────
  // Covers a brand-new deploy that failed (mode==='create', no `server` prop yet — only
  // `resultServer` exists once the create POST returns) just as much as the dedicated fix-entry
  // flow — a fresh deploy failure needs the real crash output visible immediately, not just
  // attached invisibly to the AI Fix call behind the scenes.
  useEffect(() => {
    const id = mode === 'fix' && server ? server.id : resultServer?.id;
    const status = mode === 'fix' && server ? undefined : resultServer?.status;
    if (id && (mode === 'fix' || status !== 'RUNNING')) {
      api.get(`/mcp-servers/${id}/logs`).then(res => setRecentLogs(res.data.logs || '')).catch(() => {});
    }
  }, [mode, server, resultServer?.id, resultServer?.status]);

  // ── Step 1 → analyze ──────────────────────────────────────────────────────
  // The AI has no live internet access (especially the local Ollama/Gemma provider this app
  // defaults to) — pasting a bare URL into the docs field just gives it a string to guess from,
  // not real content, which is why analysis can look like it's "ignoring the documentation."
  // This fetches the actual page server-side (avoids a browser CORS block) and drops the real
  // text into the Documentation field below for review before analyzing — reuses the same
  // endpoint the AI Workflow Builder's external_api wizard already uses for this.
  /** Returns the fetched text directly (not just via setDocs) so handleAnalyze can use it
   * immediately without waiting on a state update round-trip. */
  const fetchDocUrl = async (): Promise<string> => {
    const res = await api.post('/templates/fetch-documentation-url', { url: docUrl });
    const content = res.data.content ?? '';
    setDocs(content);
    return content;
  };

  const handleFetchDocUrl = async () => {
    setFetchDocError('');
    setFetchingDoc(true);
    try {
      await fetchDocUrl();
    } catch (err: any) {
      setFetchDocError(err?.response?.data?.message || t('mcp_fetch_doc_failed', { defaultValue: 'Could not fetch this URL.' }) as string);
    } finally {
      setFetchingDoc(false);
    }
  };

  const handleAnalyze = async () => {
    setError('');
    setAnalyzing(true);
    try {
      // A URL alone is enough — no need to also paste something into the Documentation box.
      let effectiveDocs = docs;
      if (!effectiveDocs.trim() && docUrl.trim()) {
        setFetchingDoc(true);
        try {
          effectiveDocs = await fetchDocUrl();
        } finally {
          setFetchingDoc(false);
        }
      }
      const res = await api.post('/mcp-servers/ai-design', { baseUrl, docs: effectiveDocs, sessionId });
      setSessionId(res.data.sessionId);
      setTools((res.data.tools || []).map((t: McpTool) => ({ ...t, selected: true })));
      setStep('tools');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mcp_analyze_failed', { defaultValue: 'The AI could not propose a tool design.' }) as string);
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Step 2 → generate ─────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setError('');
    setGenerating(true);
    try {
      const approvedTools = tools.filter(tl => tl.selected).map(({ selected: _s, ...rest }) => rest);
      const res = await api.post('/mcp-servers/ai-generate', {
        sessionId,
        approvedTools,
        auth: { type: authType, location: authLocation, name: authName },
      });
      setScript(res.data.script);
      setDependencies((res.data.dependencies || []).join('\n'));
      setStep('script');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mcp_generate_failed', { defaultValue: 'The AI could not generate a script.' }) as string);
    } finally {
      setGenerating(false);
    }
  };

  // ── Step 3 → deploy / save ────────────────────────────────────────────────
  const handleDeploy = async () => {
    setError('');
    setSaving(true);
    try {
      if (mode === 'create') {
        // McpServerCreateDto uses @JsonProperty snake_case (mirrors AiSettingsDto's entity-CRUD
        // convention) — every top-level key here must match that wire format exactly, or Jackson
        // silently drops the unrecognized camelCase field and leaves it null server-side.
        const res = await api.post('/mcp-servers', {
          name, description,
          target_api_base_url: baseUrl,
          target_api_docs: docs,
          auth: { type: authType, location: authLocation, name: authName, secret_value: authSecret || undefined },
          tool_design_json: JSON.stringify(tools.filter(tl => tl.selected)),
          script_content: script,
          dependencies,
          ai_chat_session_id: sessionId,
        });
        setResultServer(res.data);
      } else {
        const id = server!.id;
        const res = await api.patch(`/mcp-servers/${id}`, { script_content: script, dependencies });
        setResultServer(res.data);
      }
      setStep('result');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mcp_deploy_failed', { defaultValue: 'Could not save/deploy this server.' }) as string);
    } finally {
      setSaving(false);
    }
  };

  // ── Step 4 → test a tool ──────────────────────────────────────────────────
  const handleTestConnection = async () => {
    if (!resultServer) return;
    setError('');
    try {
      const res = await api.post(`/mcp-servers/${resultServer.id}/test`);
      setAvailableTools(res.data.tools || []);
      setDesignMismatches(res.data.design_mismatches || []);
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mcp_test_connection_failed', { defaultValue: 'Could not connect to the deployed server.' }) as string);
    }
  };

  useEffect(() => {
    if (step === 'result' && resultServer?.status === 'RUNNING') {
      handleTestConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const handleSelectTestTool = (toolName: string) => {
    setTestToolName(toolName);
    setTestResult(null);
    const tool = availableTools.find(tl => tl.name === toolName);
    setTestArgValues(buildArgFormDefaults(tool?.input_schema));
  };

  const handleRunTestTool = async () => {
    if (!resultServer || !testToolName) return;
    setError('');
    setTesting(true);
    setTestResult(null);
    try {
      const tool = availableTools.find(tl => tl.name === testToolName);
      const args = coerceArgValues(testArgValues, tool?.input_schema);
      const res = await api.post(`/mcp-servers/${resultServer.id}/test-tool`, { toolName: testToolName, args });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({ isError: true, content: err?.response?.data?.message || t('mcp_tool_call_failed', { defaultValue: 'Tool call failed.' }) });
    } finally {
      setTesting(false);
    }
  };

  // ── Fix loop ──────────────────────────────────────────────────────────────
  // Accepts an optional explicit description so callers (like the design-mismatch banner below)
  // can supply one and submit in the same click, without racing React's async state update if
  // they'd otherwise called setFixDescription() then immediately read the (still-stale) state.
  const handleAskAiToFix = async (descriptionOverride?: string) => {
    const targetId = mode === 'fix' ? server!.id : resultServer?.id;
    if (!targetId) return;
    setError('');
    setFixing(true);
    try {
      const res = await api.post(`/mcp-servers/${targetId}/ai-fix`, { adminDescription: descriptionOverride ?? fixDescription });
      setScript(res.data.script);
      setDependencies((res.data.dependencies || []).join('\n'));
      setStep('script');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mcp_fix_failed', { defaultValue: 'The AI could not propose a fix.' }) as string);
    } finally {
      setFixing(false);
    }
  };

  const stepIndex = { form: 1, tools: 2, script: 3, result: 4 }[step];

  return (
    <div className="mcp-wizard-wrap">
      <button className="mcp-back-to-list-btn" onClick={onClose}>
        <ArrowLeft size={13} /> {t('mcp_back_to_list_btn', { defaultValue: 'Back to MCP Servers' })}
      </button>

      <div className="mcp-wizard-card">
        <div className="mcp-wizard-head">
          <span>
            {mode === 'create' && t('mcp_wizard_title_new', { defaultValue: 'New MCP Server' })}
            {mode === 'edit' && t('mcp_wizard_title_edit', { defaultValue: 'Edit — {{name}}', name: server?.name })}
            {mode === 'fix' && t('mcp_wizard_title_fix', { defaultValue: 'Fix with AI — {{name}}', name: server?.name })}
          </span>
        </div>

        {mode === 'create' && (
          <div className="mcp-wizard-track">
            {(['form', 'tools', 'script', 'result'] as Step[]).map((s, i) => (
              <div key={s} className={`mcp-wt-step${stepIndex > i + 1 ? ' done' : ''}${step === s ? ' active' : ''}`}>
                <span className="mcp-wt-num">{stepIndex > i + 1 ? '✓' : i + 1}</span>
                {t(`mcp_wizard_step_${s}`, {
                  defaultValue: { form: 'API + Docs + Auth', tools: 'Review Tools', script: 'Review Script', result: 'Deploy & Verify' }[s],
                })}
              </div>
            ))}
          </div>
        )}

        <div className="mcp-wizard-body">
          {error && <div className="mcp-wizard-error"><AlertCircle size={13} /> {error}</div>}

          {step === 'form' && (
            <>
              <label className="mcp-field-label">{t('mcp_field_name', { defaultValue: 'Server Name' })}</label>
              <input className="mcp-field-input" value={name} onChange={e => setName(e.target.value)} />

              <label className="mcp-field-label">{t('mcp_field_description', { defaultValue: 'Description (optional)' })}</label>
              <input className="mcp-field-input" value={description} onChange={e => setDescription(e.target.value)} />

              <label className="mcp-field-label">{t('mcp_field_base_url', { defaultValue: 'Target API Base URL' })}</label>
              <input className="mcp-field-input" value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" />

              <label className="mcp-field-label">{t('mcp_field_doc_url', { defaultValue: 'Or fetch the docs from a URL' })}</label>
              <div className="mcp-inline-row">
                <input
                  className="mcp-field-input"
                  style={{ flex: 1 }}
                  value={docUrl}
                  onChange={e => setDocUrl(e.target.value)}
                  placeholder={t('mcp_field_doc_url_placeholder', { defaultValue: 'https://example.com/api-docs' }) as string}
                />
                <button type="button" className="mcp-btn mcp-btn-ghost" onClick={handleFetchDocUrl} disabled={fetchingDoc || !docUrl.trim()}>
                  {fetchingDoc ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_fetching_doc', { defaultValue: 'Fetching…' })}</> : t('mcp_fetch_doc_btn', { defaultValue: 'Fetch' })}
                </button>
              </div>
              {fetchDocError && <div className="mcp-wizard-error"><AlertCircle size={13} /> {fetchDocError}</div>}

              <label className="mcp-field-label">{t('mcp_field_docs', { defaultValue: 'API Documentation (paste freeform docs or an OpenAPI/Swagger spec — or fetch a URL above)' })}</label>
              <textarea className="mcp-field-textarea" value={docs} onChange={e => setDocs(e.target.value)} rows={8} />

              <label className="mcp-field-label">{t('mcp_field_auth_type', { defaultValue: 'Target API Auth — Type' })}</label>
              <select className="mcp-field-input" value={authType} onChange={e => setAuthType(e.target.value as any)}>
                <option value="none">{t('mcp_auth_none', { defaultValue: 'None' })}</option>
                <option value="api_key">{t('mcp_auth_api_key', { defaultValue: 'API Key' })}</option>
                <option value="bearer">{t('mcp_auth_bearer', { defaultValue: 'Bearer Token' })}</option>
              </select>

              {authType !== 'none' && (
                <>
                  <label className="mcp-field-label">{t('mcp_field_auth_location', { defaultValue: 'Where does it go?' })}</label>
                  <select className="mcp-field-input" value={authLocation} onChange={e => setAuthLocation(e.target.value as any)}>
                    <option value="header">{t('mcp_auth_loc_header', { defaultValue: 'Header' })}</option>
                    <option value="query">{t('mcp_auth_loc_query', { defaultValue: 'URL Query Parameter' })}</option>
                    <option value="body">{t('mcp_auth_loc_body', { defaultValue: 'Request Body Field' })}</option>
                  </select>

                  <div className="mcp-two-col">
                    <div>
                      <label className="mcp-field-label">{t('mcp_field_auth_name', { defaultValue: 'Header / Param / Field Name' })}</label>
                      <input className="mcp-field-input" value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Authorization" />
                    </div>
                    <div>
                      <label className="mcp-field-label">{t('mcp_field_auth_secret', { defaultValue: 'Secret Value' })}</label>
                      <input className="mcp-field-input" type="password" value={authSecret} onChange={e => setAuthSecret(e.target.value)} />
                    </div>
                  </div>
                </>
              )}

              <div className="mcp-btn-row">
                <button className="mcp-btn mcp-btn-primary" disabled={!baseUrl || (!docs.trim() && !docUrl.trim()) || analyzing || fetchingDoc} onClick={handleAnalyze}>
                  {(analyzing || fetchingDoc) ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_analyzing', { defaultValue: 'Analyzing…' })}</> : t('mcp_analyze_btn', { defaultValue: 'Analyze API →' })}
                </button>
              </div>
            </>
          )}

          {step === 'tools' && (
            <>
              {tools.map((tl, i) => (
                <div key={tl.name + i} className="mcp-tool-row">
                  <input type="checkbox" checked={tl.selected}
                    onChange={e => setTools(ts => ts.map((x, xi) => xi === i ? { ...x, selected: e.target.checked } : x))} />
                  <div>
                    <div className="mcp-tool-name">
                      {tl.method && <span className="mcp-tool-method">{tl.method}</span>}
                      {tl.name}
                    </div>
                    <div className="mcp-tool-desc">{tl.description}</div>
                    {tl.path && <div className="mcp-tool-path">{tl.path}</div>}
                    {tl.args && tl.args.length > 0 && (
                      <div className="mcp-tool-io">
                        <span className="mcp-tool-io-label">{t('mcp_tool_inputs_label', { defaultValue: 'Inputs:' })}</span>{' '}
                        {tl.args.map(a => `${a.name}${a.required ? '*' : ''}`).join(', ')}
                      </div>
                    )}
                    {tl.output && (
                      <div className="mcp-tool-io">
                        <span className="mcp-tool-io-label">{t('mcp_tool_output_label', { defaultValue: 'Returns:' })}</span>{' '}
                        {tl.output.description}
                        {tl.output.fields && tl.output.fields.length > 0 && ` (${tl.output.fields.map(f => f.name).join(', ')})`}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div className="mcp-btn-row">
                <button className="mcp-btn mcp-btn-ghost" onClick={() => setStep('form')}>{t('mcp_back_btn', { defaultValue: '← Back' })}</button>
                <button className="mcp-btn mcp-btn-primary" disabled={!tools.some(tl => tl.selected) || generating} onClick={handleGenerate}>
                  {generating ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_generating', { defaultValue: 'Generating…' })}</> : t('mcp_generate_btn', { defaultValue: 'Generate Script →' })}
                </button>
              </div>
            </>
          )}

          {step === 'script' && (
            loadingScript ? (
              <div className="mcp-loading-inline"><Loader2 size={16} className="mcp-spin" /> {t('mcp_loading_script', { defaultValue: 'Loading script…' })}</div>
            ) : (
              <>
                <label className="mcp-field-label">{t('mcp_field_script', { defaultValue: 'Generated Script (review and edit before saving)' })}</label>
                <div className="mcp-code-editor">
                  <CodeMirror value={script} height="320px" theme="dark" extensions={[python()]} onChange={setScript} />
                </div>
                <label className="mcp-field-label">{t('mcp_field_dependencies', { defaultValue: 'Dependencies (one per line)' })}</label>
                <textarea className="mcp-field-textarea" rows={3} value={dependencies} onChange={e => setDependencies(e.target.value)} />

                <div className="mcp-btn-row">
                  {mode === 'create' && <button className="mcp-btn mcp-btn-ghost" onClick={() => setStep('tools')}>{t('mcp_back_btn', { defaultValue: '← Back' })}</button>}
                  <button className="mcp-btn mcp-btn-primary" disabled={!script || saving} onClick={handleDeploy}>
                    {saving
                      ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_deploying', { defaultValue: 'Deploying…' })}</>
                      : mode === 'create' ? t('mcp_deploy_btn', { defaultValue: 'Deploy →' }) : t('mcp_save_redeploy_btn', { defaultValue: 'Save & Redeploy' })}
                  </button>
                </div>
              </>
            )
          )}

          {step === 'result' && (
            <>
              {mode === 'fix' && !resultServer && server && (
                <>
                  <p className="mcp-field-label">{t('mcp_fix_intro', { defaultValue: 'Not working? Describe what should have happened and let the AI diagnose it using the server\'s own recent output.' })}</p>
                  {recentLogs && <pre className="mcp-log-preview">{recentLogs.slice(-1500)}</pre>}
                  <textarea className="mcp-field-textarea" rows={3} placeholder={t('mcp_fix_description_placeholder', { defaultValue: 'What should have happened? (optional)' }) as string}
                    value={fixDescription} onChange={e => setFixDescription(e.target.value)} />
                  <div className="mcp-btn-row">
                    <button className="mcp-btn mcp-btn-primary" disabled={fixing} onClick={() => handleAskAiToFix()}>
                      {fixing ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_fixing', { defaultValue: 'Asking AI…' })}</> : <><Sparkles size={13} /> {t('mcp_ask_ai_fix_btn', { defaultValue: 'Ask AI to Fix' })}</>}
                    </button>
                  </div>
                </>
              )}

              {resultServer && (
                <>
                  <div className={`mcp-result-banner mcp-result-${resultServer.status.toLowerCase()}`}>
                    {resultServer.status === 'RUNNING' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
                    {t(`mcp_status_${resultServer.status.toLowerCase()}`, { defaultValue: resultServer.status })}
                    {resultServer.last_error && ` — ${resultServer.last_error}`}
                  </div>

                  {resultServer.status !== 'RUNNING' && recentLogs && (
                    <>
                      <label className="mcp-field-label">{t('mcp_process_output_label', { defaultValue: 'Process output (this is what Ask AI to Fix sees too)' })}</label>
                      <pre className="mcp-log-preview">{recentLogs.slice(-3000)}</pre>
                    </>
                  )}

                  {designMismatches.length > 0 && (
                    <div className="mcp-wizard-error">
                      <AlertCircle size={13} />
                      <div>
                        <div>{t('mcp_design_mismatch_title', { defaultValue: 'This server is missing some of the inputs it was designed to have — Action Items built from it will be incomplete:' })}</div>
                        <ul className="mcp-mismatch-list">
                          {designMismatches.map(m => (
                            <li key={m.tool}>
                              {m.not_deployed
                                ? t('mcp_design_mismatch_not_deployed', { defaultValue: '"{{tool}}" was designed but isn\'t in the deployed script at all.', tool: m.tool })
                                : t('mcp_design_mismatch_missing_args', { defaultValue: '"{{tool}}" is missing: {{args}}', tool: m.tool, args: m.missing_args.join(', ') })}
                            </li>
                          ))}
                        </ul>
                        <button
                          className="mcp-btn mcp-btn-primary"
                          disabled={fixing}
                          onClick={() => {
                            const description =
                              'The deployed script is missing parameters it was designed to have: ' +
                              designMismatches.map(m => `${m.tool} is missing ${m.not_deployed ? '(the whole tool)' : m.missing_args.join(', ')}`).join('; ') +
                              '. Please add them.';
                            setFixDescription(description);
                            handleAskAiToFix(description);
                          }}
                        >
                          {fixing ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_fixing', { defaultValue: 'Asking AI…' })}</> : <><Sparkles size={13} /> {t('mcp_fix_missing_params_btn', { defaultValue: 'Ask AI to Add Missing Parameters' })}</>}
                        </button>
                      </div>
                    </div>
                  )}

                  {resultServer.status === 'RUNNING' && availableTools.length > 0 && (
                    <>
                      <label className="mcp-field-label">{t('mcp_field_test_tool', { defaultValue: 'Tool' })}</label>
                      <select className="mcp-field-input" value={testToolName} onChange={e => handleSelectTestTool(e.target.value)}>
                        <option value="">{t('mcp_select_tool_placeholder', { defaultValue: 'Select a tool…' })}</option>
                        {availableTools.map(tl => <option key={tl.name} value={tl.name}>{tl.name}</option>)}
                      </select>
                      {testToolName && (() => {
                        const tool = availableTools.find(tl => tl.name === testToolName);
                        const props = Object.entries(tool?.input_schema?.properties ?? {});
                        const required = new Set(tool?.input_schema?.required ?? []);
                        if (props.length === 0) {
                          return <p className="wfd-hint-xs">{t('mcp_tool_no_params_hint', { defaultValue: 'This tool takes no input — just click Run.' })}</p>;
                        }
                        return (
                          <div className="mcp-test-form">
                            {props.map(([key, prop]) => (
                              <div key={key} className="mcp-test-field">
                                <label className="mcp-field-label">
                                  {humanizeLabel(key)}{required.has(key) && <span className="mcp-required-mark"> *</span>}
                                </label>
                                {prop?.type === 'boolean' ? (
                                  <label className="mcp-checkbox-row">
                                    <input type="checkbox" checked={!!testArgValues[key]}
                                      onChange={e => setTestArgValues(v => ({ ...v, [key]: e.target.checked }))} />
                                    {prop?.description || t('mcp_yes_no_hint', { defaultValue: 'Yes / No' })}
                                  </label>
                                ) : (
                                  <input
                                    className="mcp-field-input"
                                    type={prop?.type === 'number' || prop?.type === 'integer' ? 'number' : 'text'}
                                    value={String(testArgValues[key] ?? '')}
                                    onChange={e => setTestArgValues(v => ({ ...v, [key]: e.target.value }))}
                                    placeholder={prop?.type === 'array' ? (t('mcp_array_placeholder', { defaultValue: 'Separate multiple values with commas' }) as string) : undefined}
                                  />
                                )}
                                {prop?.description && prop.type !== 'boolean' && <p className="mcp-field-hint">{prop.description}</p>}
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      <div className="mcp-btn-row">
                        <button className="mcp-btn mcp-btn-primary" disabled={!testToolName || testing} onClick={handleRunTestTool}>
                          {testing ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_running', { defaultValue: 'Running…' })}</> : t('mcp_run_tool_btn', { defaultValue: '▶ Run Tool' })}
                        </button>
                      </div>
                      {testResult && (
                        <div className={`mcp-trace-box${testResult.isError ? ' mcp-trace-error' : ''}`}>
                          {renderResultContent(testResult.content)}
                        </div>
                      )}

                      <div className="mcp-fix-panel">
                        <div className="mcp-fix-head"><Sparkles size={13} /> {t('mcp_not_working_title', { defaultValue: 'Not working? Tell the AI' })}</div>
                        <textarea className="mcp-field-textarea" rows={2} placeholder={t('mcp_fix_description_placeholder', { defaultValue: 'What should have happened? (optional)' }) as string}
                          value={fixDescription} onChange={e => setFixDescription(e.target.value)} />
                        <div className="mcp-btn-row">
                          <button className="mcp-btn mcp-btn-primary" disabled={fixing} onClick={() => handleAskAiToFix()}>
                            {fixing ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_fixing', { defaultValue: 'Asking AI…' })}</> : t('mcp_ask_ai_fix_btn', { defaultValue: 'Ask AI to Fix' })}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {resultServer.status !== 'RUNNING' && (
                    <div className="mcp-fix-panel">
                      <div className="mcp-fix-head"><Sparkles size={13} /> {t('mcp_not_working_title', { defaultValue: 'Not working? Tell the AI' })}</div>
                      <textarea className="mcp-field-textarea" rows={2} placeholder={t('mcp_fix_description_placeholder', { defaultValue: 'What should have happened? (optional)' }) as string}
                        value={fixDescription} onChange={e => setFixDescription(e.target.value)} />
                      <div className="mcp-btn-row">
                        <button className="mcp-btn mcp-btn-primary" disabled={fixing} onClick={() => handleAskAiToFix()}>
                          {fixing ? <><Loader2 size={13} className="mcp-spin" /> {t('mcp_fixing', { defaultValue: 'Asking AI…' })}</> : <><Sparkles size={13} /> {t('mcp_ask_ai_fix_btn', { defaultValue: 'Ask AI to Fix' })}</>}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mcp-btn-row">
                    <button className="mcp-btn mcp-btn-primary" onClick={onSaved}>{t('mcp_done_btn', { defaultValue: 'Done' })}</button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
