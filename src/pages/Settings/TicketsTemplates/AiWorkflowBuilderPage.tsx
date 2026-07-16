import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, ArrowLeft, ArrowRight, Check, Loader2, Plus, Pencil, Trash2, Globe2, Plug } from 'lucide-react';
import api from '../../../api';
import {
  ExternalApiCallsEditor, ExternalApiFieldMappingsEditor,
  type ExternalApiCall, type ExternalApiFieldMappings,
} from './ExternalApiCallsEditor';
import {
  McpServerConnectionEditor, McpToolPicker, McpToolCallsEditor, McpResponseMappingsEditor,
  type McpCall, type McpAuth, type McpResponseMapping,
} from './McpToolCallsEditor';
import './WorkflowDesignerModal.css';
import './ActionItemLibraryPage.css';
import './AiWorkflowBuilderPage.css';

type TargetType = 'external_api' | 'mcp_tool';

interface LibraryEntry {
  id: number;
  name: string;
  type: string;
  typeConfig: Record<string, unknown> | null;
  source: string;
}

type Mode = 'list' | 'wizard';
type Step = 1 | 2 | 3;

const TYPE_ICON: Record<string, React.ReactNode> = {
  external_api: <Globe2 size={16} />,
  mcp_tool: <Plug size={16} />,
};

const emptyMappings: ExternalApiFieldMappings = { request: [], response: [] };

export const AiWorkflowBuilderPage = () => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('list');
  const [step, setStep] = useState<Step>(1);
  // True when Step 2 was reached by picking "Edit" on an existing entry from the list (no AI call
  // involved) rather than by generating a fresh draft — changes what the Back button returns to.
  const [cameFromList, setCameFromList] = useState(false);

  // Step 1 — the global ticket field catalog (cross-template, not scoped to any one template)
  const [ticketFieldKeys, setTicketFieldKeys] = useState<string[]>([]);
  // Custom Workflow Fields (from Workflow Fields Manager) — used for "this.<key>" input/output
  const [workflowFieldKeys, setWorkflowFieldKeys] = useState<string[]>([]);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [intent, setIntent] = useState('');
  const [documentation, setDocumentation] = useState('');
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [actionType, setActionType] = useState<TargetType>('external_api');

  // Step 1 — MCP-specific
  const [mcpServerUrl, setMcpServerUrl] = useState('');
  const [mcpAuth, setMcpAuth] = useState<McpAuth>({ type: 'none' });
  const [mcpDiscoveredTools, setMcpDiscoveredTools] = useState<any[]>([]);

  // Step 2
  const [nodeTitle, setNodeTitle] = useState('');
  const [draftCalls, setDraftCalls] = useState<ExternalApiCall[]>([]);
  const [draftMappings, setDraftMappings] = useState<ExternalApiFieldMappings>(emptyMappings);
  const [mcpDraftCalls, setMcpDraftCalls] = useState<McpCall[]>([]);
  const [mcpDraftMappings, setMcpDraftMappings] = useState<McpResponseMapping[]>([]);
  const [targetMode, setTargetMode] = useState<'new' | 'existing'>('new');
  const [targetNodeId, setTargetNodeId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Step 3
  const [savedName, setSavedName] = useState('');

  useEffect(() => {
    api.get('/field-definitions', { params: { entityType: 'ticket' } })
      .then(r => setTicketFieldKeys(r.data.map((f: any) => f.fieldKey)))
      .catch(() => {});
    // Only custom (non-system) workflow fields — the built-in title/workflow_status/assigned/
    // attachments columns aren't generic "this.<key>" storage slots, they're the item's real columns.
    api.get('/field-definitions', { params: { entityType: 'workflow' } })
      .then(r => setWorkflowFieldKeys(r.data.filter((f: any) => !f.isSystem).map((f: any) => f.fieldKey)))
      .catch(() => {});
    reloadLibraryEntries();
  }, []);

  const reloadLibraryEntries = () =>
    api.get('/action-item-library').then(r => setLibraryEntries(r.data)).catch(() => {});

  const existingLibraryEntries = libraryEntries.filter(e => e.type === actionType);
  const aiLibraryEntries = libraryEntries.filter(e => e.source === 'ai');

  const handleEditExisting = (entry: LibraryEntry) => {
    setActionType(entry.type as TargetType);
    setNodeTitle(entry.name);
    if (entry.type === 'mcp_tool') {
      const cfg = entry.typeConfig as { serverUrl?: string; auth?: McpAuth; calls?: McpCall[]; fieldMappings?: { response?: McpResponseMapping[] } } | null;
      setMcpServerUrl(cfg?.serverUrl ?? '');
      setMcpAuth(cfg?.auth ?? { type: 'none' });
      setMcpDiscoveredTools([]);
      setMcpDraftCalls(cfg?.calls ?? []);
      setMcpDraftMappings(cfg?.fieldMappings?.response ?? []);
    } else {
      const cfg = entry.typeConfig as { calls?: ExternalApiCall[]; fieldMappings?: ExternalApiFieldMappings } | null;
      setDraftCalls(cfg?.calls ?? []);
      setDraftMappings(cfg?.fieldMappings ?? emptyMappings);
    }
    setTargetMode('existing');
    setTargetNodeId(String(entry.id));
    setCameFromList(true);
    setGenError('');
    setSaveError('');
    setMode('wizard');
    setStep(2);
  };

  const handleDeleteExisting = async (entry: LibraryEntry) => {
    if (!window.confirm(t('action_item_library_delete_confirm', { defaultValue: 'Delete this action item from the library?' }))) return;
    await api.delete(`/action-item-library/${entry.id}`);
    await reloadLibraryEntries();
  };

  const handleGenerate = async () => {
    setGenError('');
    setGenerating(true);
    try {
      if (actionType === 'mcp_tool') {
        const res = await api.post('/templates/ai-suggest-mcp-action', {
          intent, tools: mcpDiscoveredTools, ticketFieldKeys, workflowFieldKeys,
        });
        const draft = res.data;
        setMcpDraftCalls(draft.calls ?? []);
        setMcpDraftMappings(draft.fieldMappings?.response ?? []);
      } else {
        const res = await api.post('/templates/ai-suggest-workflow-action', {
          documentation, intent, ticketFieldKeys, workflowFieldKeys,
        });
        const draft = res.data;
        setDraftCalls(draft.calls ?? []);
        setDraftMappings(draft.fieldMappings ?? emptyMappings);
      }
      setNodeTitle(intent.trim() ? intent.trim().slice(0, 60) : t('awb_default_action_title', { defaultValue: 'AI Workflow Action' }));
      setCameFromList(false);
      setStep(2);
    } catch (err: any) {
      setGenError(err?.response?.data?.message || t('awb_generate_failed', { defaultValue: 'Failed to generate a draft — check that an AI provider is configured and active.' }));
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      const typeConfig = actionType === 'mcp_tool'
        ? { serverUrl: mcpServerUrl, auth: mcpAuth, calls: mcpDraftCalls, fieldMappings: { response: mcpDraftMappings } }
        : { calls: draftCalls, fieldMappings: draftMappings };
      const finalName = nodeTitle.trim() || t('awb_default_action_title', { defaultValue: 'AI Workflow Action' });
      const body = { name: finalName, type: actionType, typeConfig, source: 'ai' };

      if (targetMode === 'existing' && targetNodeId) {
        await api.put(`/action-item-library/${targetNodeId}`, body);
      } else {
        await api.post('/action-item-library', body);
      }

      setSavedName(finalName);
      await reloadLibraryEntries();
      setStep(3);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || t('awb_save_failed', { defaultValue: 'Failed to save into the library.' }));
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    setMode('wizard');
    setStep(1);
    setIntent('');
    setDocumentation('');
    setDraftCalls([]);
    setDraftMappings(emptyMappings);
    setMcpServerUrl('');
    setMcpAuth({ type: 'none' });
    setMcpDiscoveredTools([]);
    setMcpDraftCalls([]);
    setMcpDraftMappings([]);
    setNodeTitle('');
    setTargetMode('new');
    setTargetNodeId('');
    setCameFromList(false);
    setGenError('');
    setSaveError('');
  };

  const backToList = () => {
    setMode('list');
    reloadLibraryEntries();
  };

  const captureNames = draftCalls.flatMap(c => c.responseCaptures.map(r => r.name).filter(Boolean));
  const mcpCaptureNames = mcpDraftCalls.flatMap(c => c.responseCaptures.map(r => r.name).filter(Boolean));

  if (mode === 'list') {
    return (
      <div className="awb-wrap">
        <div className="ail-toolbar">
          <p className="ail-hint">
            {t('awb_list_hint', { defaultValue: 'AI-built action items (external API calls or MCP tool calls). Add one to any template from the Workflow Designer.' })}
          </p>
          <button className="ail-add-btn" onClick={startOver}>
            <Plus size={14} /> {t('awb_new_ai_item_btn', { defaultValue: 'New AI Action Item' })}
          </button>
        </div>

        {aiLibraryEntries.length === 0 ? (
          <div className="ail-state">{t('awb_ai_items_list_empty', { defaultValue: 'No AI action items yet — click "New AI Action Item" to build one.' })}</div>
        ) : (
          <div className="ail-list">
            {aiLibraryEntries.map(entry => (
              <div key={entry.id} className="ail-card-wrap">
                <div className="ail-card">
                  <span className="ail-card-icon">{TYPE_ICON[entry.type] ?? <Globe2 size={16} />}</span>
                  <div className="ail-card-body">
                    <span className="ail-card-name">{entry.name}</span>
                    <span className="ail-source-badge ail-source-ai"><Sparkles size={10} /> {t('action_item_library_ai_badge', { defaultValue: 'AI' })}</span>
                  </div>
                  <div className="ail-card-actions">
                    <button className="ail-icon-btn" onClick={() => handleEditExisting(entry)}><Pencil size={14} /></button>
                    <button className="ail-icon-btn ail-icon-delete" onClick={() => handleDeleteExisting(entry)}><Trash2 size={14} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="awb-wrap">
      {/* Step indicator */}
      <div className="awb-steps">
        {[
          t('awb_step_describe', { defaultValue: 'Describe & Paste' }),
          t('awb_step_review', { defaultValue: 'Review & Refine' }),
          t('awb_step_done', { defaultValue: 'Done' }),
        ].map((label, i) => {
          const n = (i + 1) as Step;
          return (
            <div key={label} className={`awb-step${step === n ? ' active' : ''}${step > n ? ' done' : ''}`}>
              <span className="awb-step-num">{step > n ? <Check size={11} /> : n}</span>
              <span className="awb-step-label">{label}</span>
              {i < 2 && <span className="awb-step-connector" />}
            </div>
          );
        })}
      </div>

      {/* ── Step 1 ── */}
      {step === 1 && (
        <div className="awb-card">
          <button className="wfd-btn-ghost awb-back-to-list-btn" onClick={backToList}>
            <ArrowLeft size={13} /> {t('awb_back_to_list_btn', { defaultValue: 'Back to List' })}
          </button>
          <div className="awb-card-intro">
            <Sparkles size={16} className="awb-intro-icon" />
            <p>{actionType === 'mcp_tool'
              ? t('awb_intro_mcp', { defaultValue: "Point at an MCP server, discover its real tools, and describe what you want done — the AI picks the right tool and drafts the argument mapping from the server's actual schema. You review and refine everything before it's saved." })
              : t('awb_intro_external_api', { defaultValue: "Paste a 3rd-party API's documentation and describe what you want it to do — the AI will draft the HTTP call sequence and field mappings. You review and refine everything (including entering real credentials) before it's saved." })}</p>
          </div>

          <div className="awb-field">
            <label className="awb-label">{t('awb_action_type_label', { defaultValue: 'Action type' })}</label>
            <div className="awb-radio-row">
              <label className="awb-radio">
                <input type="radio" checked={actionType === 'external_api'} onChange={() => setActionType('external_api')} />
                {t('awb_action_type_external_api_option', { defaultValue: 'External API (HTTP docs)' })}
              </label>
              <label className="awb-radio">
                <input type="radio" checked={actionType === 'mcp_tool'} onChange={() => setActionType('mcp_tool')} />
                {t('awb_action_type_mcp_tool_option', { defaultValue: 'MCP Tool (server + discovery)' })}
              </label>
            </div>
          </div>

          <div className="awb-field">
            <label className="awb-label">{t('awb_intent_label', { defaultValue: 'What should this action do?' })}</label>
            <textarea
              className="wfd-inp awb-textarea-sm"
              value={intent}
              onChange={e => setIntent(e.target.value)}
              placeholder={t('awb_intent_placeholder', { defaultValue: "e.g. Order a new laptop for a new hire from our vendor's ordering API, and capture the order confirmation ID" }) as string}
            />
          </div>

          {actionType === 'mcp_tool' ? (
            <div className="awb-field">
              <label className="awb-label">{t('awb_mcp_server_label', { defaultValue: 'MCP server' })}</label>
              <McpServerConnectionEditor
                serverUrl={mcpServerUrl}
                onServerUrlChange={setMcpServerUrl}
                auth={mcpAuth}
                onAuthChange={setMcpAuth}
                onToolsDiscovered={setMcpDiscoveredTools}
              />
              {mcpDiscoveredTools.length > 0 && (
                <p className="awb-hint">{t('awb_tools_discovered_count', { defaultValue: '{{count}} tool{{s}} discovered — ready to draft.', count: mcpDiscoveredTools.length, s: mcpDiscoveredTools.length !== 1 ? 's' : '' })}</p>
              )}
            </div>
          ) : (
            <div className="awb-field">
              <label className="awb-label">{t('awb_api_documentation_label', { defaultValue: 'API documentation' })}</label>
              <textarea
                className="wfd-inp awb-textarea-lg"
                value={documentation}
                onChange={e => setDocumentation(e.target.value)}
                placeholder={t('awb_api_documentation_placeholder', { defaultValue: "Paste the vendor's API docs here — endpoint URLs, request/response examples, auth scheme, etc." }) as string}
              />
            </div>
          )}

          {genError && <p className="awb-error">{genError}</p>}

          <div className="awb-actions">
            <button
              className="wfd-btn-save"
              disabled={
                generating ||
                (actionType === 'mcp_tool' ? mcpDiscoveredTools.length === 0 : !documentation.trim())
              }
              onClick={handleGenerate}
            >
              {generating ? <><Loader2 size={13} className="awb-spin" /> {t('awb_generating_ellipsis', { defaultValue: 'Generating…' })}</> : <><Sparkles size={13} /> {t('awb_generate_draft_btn', { defaultValue: 'Generate Draft' })}</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="awb-card">
          <div className="awb-field">
            <label className="awb-label">{t('awb_action_item_title_label', { defaultValue: 'Action item title' })}</label>
            <input className="wfd-inp" value={nodeTitle} onChange={e => setNodeTitle(e.target.value)} placeholder={t('awb_action_item_title_placeholder', { defaultValue: 'Order Laptop' }) as string} />
          </div>

          {actionType === 'mcp_tool' ? (
            <>
              <div className="awb-field">
                <label className="awb-label">{t('awb_mcp_server_label', { defaultValue: 'MCP server' })}</label>
                <McpServerConnectionEditor
                  serverUrl={mcpServerUrl}
                  onServerUrlChange={setMcpServerUrl}
                  auth={mcpAuth}
                  onAuthChange={setMcpAuth}
                  onToolsDiscovered={setMcpDiscoveredTools}
                />
              </div>
              <div className="awb-field">
                <label className="awb-label">{t('awb_tool_calls_label', { defaultValue: 'Tool Calls' })}</label>
                <McpToolPicker tools={mcpDiscoveredTools} onPick={tool => {
                  const properties = tool?.inputSchema?.properties ?? {};
                  setMcpDraftCalls(prev => [...prev, {
                    id: crypto.randomUUID(), order: prev.length, toolName: tool.name,
                    argumentMappings: Object.keys(properties).map(key => ({ toolArgument: key, ticketField: '' })),
                    responseCaptures: [],
                  }]);
                }} />
                <McpToolCallsEditor
                  calls={mcpDraftCalls} onChange={setMcpDraftCalls}
                  ticketFieldKeys={ticketFieldKeys} workflowFieldKeys={workflowFieldKeys}
                />
              </div>
              <McpResponseMappingsEditor
                mappings={mcpDraftMappings}
                onChange={setMcpDraftMappings}
                captureNames={mcpCaptureNames}
                ticketFieldKeys={ticketFieldKeys}
                workflowFieldKeys={workflowFieldKeys}
              />
            </>
          ) : (
            <>
              <div className="awb-field">
                <label className="awb-label">{t('awb_api_calls_label', { defaultValue: 'API Calls' })}</label>
                <ExternalApiCallsEditor calls={draftCalls} onChange={setDraftCalls} />
              </div>
              <ExternalApiFieldMappingsEditor
                mappings={draftMappings}
                onChange={setDraftMappings}
                ticketFieldKeys={ticketFieldKeys}
                workflowFieldKeys={workflowFieldKeys}
                captureNames={captureNames}
              />
            </>
          )}

          <div className="awb-field">
            <label className="awb-label">{t('awb_save_as_label', { defaultValue: 'Save as' })}</label>
            <div className="awb-radio-row">
              <label className="awb-radio">
                <input type="radio" checked={targetMode === 'new'} onChange={() => setTargetMode('new')} />
                {t('awb_new_library_entry_option', { defaultValue: 'New library entry' })}
              </label>
              <label className="awb-radio">
                <input
                  type="radio"
                  checked={targetMode === 'existing'}
                  onChange={() => setTargetMode('existing')}
                  disabled={existingLibraryEntries.length === 0}
                />
                {existingLibraryEntries.length === 0
                  ? t('awb_overwrite_existing_entry_none_option', { defaultValue: 'Overwrite existing {{type}} entry (none yet)', type: actionType })
                  : t('awb_overwrite_existing_entry_option', { defaultValue: 'Overwrite existing {{type}} entry', type: actionType })}
              </label>
            </div>
            {targetMode === 'existing' && (
              <select className="wfd-sel" value={targetNodeId} onChange={e => setTargetNodeId(e.target.value)}>
                <option value="">{t('select_item_placeholder', { defaultValue: '— Select item —' })}</option>
                {existingLibraryEntries.map(entry => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
              </select>
            )}
          </div>

          {saveError && <p className="awb-error">{saveError}</p>}

          <div className="awb-actions">
            <button className="wfd-btn-ghost" onClick={cameFromList ? backToList : () => setStep(1)}><ArrowLeft size={13} /> {t('back_btn', { defaultValue: 'Back' })}</button>
            <button
              className="wfd-btn-save"
              disabled={saving || (actionType === 'mcp_tool' ? mcpDraftCalls.length === 0 : draftCalls.length === 0) || (targetMode === 'existing' && !targetNodeId)}
              onClick={handleSave}
            >
              {saving ? <><Loader2 size={13} className="awb-spin" /> {t('saving', { defaultValue: 'Saving…' })}</> : <>{t('awb_save_to_library_btn', { defaultValue: 'Save to Library' })} <ArrowRight size={13} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div className="awb-card awb-success">
          <div className="awb-success-icon"><Check size={22} /></div>
          <h3>{t('awb_saved_heading', { defaultValue: 'Saved' })}</h3>
          <p>
            {t('awb_saved_body_library', { defaultValue: '"{{title}}" was saved to the Action Item Library.', title: savedName })} {t('awb_saved_body_library_suffix', { defaultValue: 'Open the Action Items tab to manage it, or add it to any template from that template\'s Workflow Designer.' })}
          </p>
          <button className="wfd-btn-save" onClick={backToList}><Check size={13} /> {t('awb_back_to_list_btn', { defaultValue: 'Back to List' })}</button>
        </div>
      )}
    </div>
  );
};
