import { useEffect, useState } from 'react';
import { Sparkles, ArrowLeft, ArrowRight, Check, AlertCircle, Loader2 } from 'lucide-react';
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
import './AiWorkflowBuilderPage.css';

type TargetType = 'external_api' | 'mcp_tool';

interface TemplateSummary {
  id: number;
  name: string;
}

interface WorkflowNode {
  id: string;
  title: string;
  type?: string;
  typeConfig?: Record<string, unknown>;
  activationCondition?: string;
  parentId: string | null;
  displayOrder: number;
  defaultAssigneeUserId: number | null;
  customFieldKeys: string[];
  dataFlows: unknown[];
  x?: number;
  y?: number;
}

type Step = 1 | 2 | 3;

const emptyMappings: ExternalApiFieldMappings = { request: [], response: [] };

export const AiWorkflowBuilderPage = () => {
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [templateId, setTemplateId] = useState<number | null>(null);
  const [ticketFieldKeys, setTicketFieldKeys] = useState<string[]>([]);
  const [existingNodes, setExistingNodes] = useState<WorkflowNode[]>([]);
  const [hasWorkflowField, setHasWorkflowField] = useState<boolean | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
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
  const [savedTemplateName, setSavedTemplateName] = useState('');
  const [savedNodeTitle, setSavedNodeTitle] = useState('');

  useEffect(() => {
    api.get('/templates').then(r => setTemplates(r.data)).catch(() => {});
  }, []);

  const existingTargetNodes = existingNodes.filter(n => n.type === actionType);

  const loadTemplateContext = async (id: number) => {
    setLoadingTemplate(true);
    setHasWorkflowField(null);
    try {
      const res = await api.get(`/templates/${id}`);
      const layout = res.data.layout;
      const allFields = (layout.tabs ?? []).flatMap((t: any) => t.fields ?? []);
      const wfField = allFields.find((f: any) => f.fieldType === 'workflow');
      setTicketFieldKeys(allFields.filter((f: any) => f.fieldType !== 'workflow').map((f: any) => f.fieldKey));
      setExistingNodes(wfField?.fieldConfig?.nodes ?? []);
      setHasWorkflowField(!!wfField);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleTemplateChange = (idStr: string) => {
    const id = idStr ? Number(idStr) : null;
    setTemplateId(id);
    setTargetNodeId('');
    setTargetMode('new');
    if (id) loadTemplateContext(id);
  };

  const handleGenerate = async () => {
    setGenError('');
    setGenerating(true);
    try {
      if (actionType === 'mcp_tool') {
        const res = await api.post('/templates/ai-suggest-mcp-action', {
          intent, tools: mcpDiscoveredTools, ticketFieldKeys,
        });
        const draft = res.data;
        setMcpDraftCalls(draft.calls ?? []);
        setMcpDraftMappings(draft.fieldMappings?.response ?? []);
      } else {
        const res = await api.post('/templates/ai-suggest-workflow-action', {
          documentation, intent, ticketFieldKeys,
        });
        const draft = res.data;
        setDraftCalls(draft.calls ?? []);
        setDraftMappings(draft.fieldMappings ?? emptyMappings);
      }
      setNodeTitle(intent.trim() ? intent.trim().slice(0, 60) : 'AI Workflow Action');
      setStep(2);
    } catch (err: any) {
      setGenError(err?.response?.data?.message || 'Failed to generate a draft — check that an AI provider is configured and active.');
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!templateId) return;
    setSaveError('');
    setSaving(true);
    try {
      const res = await api.get(`/templates/${templateId}`);
      const templateName: string = res.data.name;
      const layout = res.data.layout;
      const allFields = (layout.tabs ?? []).flatMap((t: any) => t.fields ?? []);
      const wfField = allFields.find((f: any) => f.fieldType === 'workflow');
      if (!wfField) {
        setSaveError('This template no longer has a Workflow field — add one in the Template Builder first.');
        setSaving(false);
        return;
      }
      const nodes: WorkflowNode[] = wfField.fieldConfig?.nodes ?? [];
      const typeConfig = actionType === 'mcp_tool'
        ? { serverUrl: mcpServerUrl, auth: mcpAuth, calls: mcpDraftCalls, fieldMappings: { response: mcpDraftMappings } }
        : { calls: draftCalls, fieldMappings: draftMappings };
      let finalTitle = nodeTitle.trim() || 'AI Workflow Action';

      if (targetMode === 'existing' && targetNodeId) {
        const idx = nodes.findIndex(n => n.id === targetNodeId);
        if (idx >= 0) {
          nodes[idx] = { ...nodes[idx], type: actionType, typeConfig };
          finalTitle = nodes[idx].title;
        }
      } else {
        const newNode: WorkflowNode = {
          id: crypto.randomUUID(),
          title: finalTitle,
          type: actionType,
          parentId: null,
          displayOrder: nodes.length,
          defaultAssigneeUserId: null,
          customFieldKeys: [],
          dataFlows: [],
          typeConfig,
          x: 100,
          y: 130 + nodes.length * 160,
        };
        nodes.push(newNode);
      }
      wfField.fieldConfig.nodes = nodes;

      await api.put(`/templates/${templateId}`, {
        name: res.data.name,
        description: res.data.description,
        aiPurpose: res.data.aiPurpose,
        layout,
      });

      setSavedTemplateName(templateName);
      setSavedNodeTitle(finalTitle);
      setStep(3);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || 'Failed to save into the template.');
    } finally {
      setSaving(false);
    }
  };

  const startOver = () => {
    setStep(1);
    setTemplateId(null);
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
    setGenError('');
    setSaveError('');
  };

  const captureNames = draftCalls.flatMap(c => c.responseCaptures.map(r => r.name).filter(Boolean));
  const mcpCaptureNames = mcpDraftCalls.flatMap(c => c.responseCaptures.map(r => r.name).filter(Boolean));

  return (
    <div className="awb-wrap">
      {/* Step indicator */}
      <div className="awb-steps">
        {(['Describe & Paste', 'Review & Refine', 'Done'] as const).map((label, i) => {
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
          <div className="awb-card-intro">
            <Sparkles size={16} className="awb-intro-icon" />
            <p>{actionType === 'mcp_tool'
              ? 'Point at an MCP server, discover its real tools, and describe what you want done — the AI picks the right tool and drafts the argument mapping from the server\'s actual schema. You review and refine everything before it\'s saved.'
              : 'Paste a 3rd-party API\'s documentation and describe what you want it to do — the AI will draft the HTTP call sequence and field mappings. You review and refine everything (including entering real credentials) before it\'s saved.'}</p>
          </div>

          <div className="awb-field">
            <label className="awb-label">Action type</label>
            <div className="awb-radio-row">
              <label className="awb-radio">
                <input type="radio" checked={actionType === 'external_api'} onChange={() => setActionType('external_api')} />
                External API (HTTP docs)
              </label>
              <label className="awb-radio">
                <input type="radio" checked={actionType === 'mcp_tool'} onChange={() => setActionType('mcp_tool')} />
                MCP Tool (server + discovery)
              </label>
            </div>
          </div>

          <div className="awb-field">
            <label className="awb-label">Target template</label>
            <select className="wfd-sel" value={templateId ?? ''} onChange={e => handleTemplateChange(e.target.value)}>
              <option value="">— Select a template —</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            {loadingTemplate && <p className="awb-hint"><Loader2 size={11} className="awb-spin" /> Loading template…</p>}
            {hasWorkflowField === false && (
              <p className="awb-warn"><AlertCircle size={12} /> This template has no Workflow field yet — add one in the Template Builder first.</p>
            )}
          </div>

          <div className="awb-field">
            <label className="awb-label">What should this action do?</label>
            <textarea
              className="wfd-inp awb-textarea-sm"
              value={intent}
              onChange={e => setIntent(e.target.value)}
              placeholder="e.g. Order a new laptop for a new hire from our vendor's ordering API, and capture the order confirmation ID"
            />
          </div>

          {actionType === 'mcp_tool' ? (
            <div className="awb-field">
              <label className="awb-label">MCP server</label>
              <McpServerConnectionEditor
                serverUrl={mcpServerUrl}
                onServerUrlChange={setMcpServerUrl}
                auth={mcpAuth}
                onAuthChange={setMcpAuth}
                onToolsDiscovered={setMcpDiscoveredTools}
              />
              {mcpDiscoveredTools.length > 0 && (
                <p className="awb-hint">{mcpDiscoveredTools.length} tool{mcpDiscoveredTools.length !== 1 ? 's' : ''} discovered — ready to draft.</p>
              )}
            </div>
          ) : (
            <div className="awb-field">
              <label className="awb-label">API documentation</label>
              <textarea
                className="wfd-inp awb-textarea-lg"
                value={documentation}
                onChange={e => setDocumentation(e.target.value)}
                placeholder="Paste the vendor's API docs here — endpoint URLs, request/response examples, auth scheme, etc."
              />
            </div>
          )}

          {genError && <p className="awb-error">{genError}</p>}

          <div className="awb-actions">
            <button
              className="wfd-btn-save"
              disabled={
                !templateId || hasWorkflowField === false || generating ||
                (actionType === 'mcp_tool' ? mcpDiscoveredTools.length === 0 : !documentation.trim())
              }
              onClick={handleGenerate}
            >
              {generating ? <><Loader2 size={13} className="awb-spin" /> Generating…</> : <><Sparkles size={13} /> Generate Draft</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2 ── */}
      {step === 2 && (
        <div className="awb-card">
          <div className="awb-field">
            <label className="awb-label">Action item title</label>
            <input className="wfd-inp" value={nodeTitle} onChange={e => setNodeTitle(e.target.value)} placeholder="Order Laptop" />
          </div>

          {actionType === 'mcp_tool' ? (
            <>
              <div className="awb-field">
                <label className="awb-label">Tool Calls</label>
                <McpToolPicker tools={mcpDiscoveredTools} onPick={tool => {
                  const properties = tool?.inputSchema?.properties ?? {};
                  setMcpDraftCalls(prev => [...prev, {
                    id: crypto.randomUUID(), order: prev.length, toolName: tool.name,
                    argumentMappings: Object.keys(properties).map(key => ({ toolArgument: key, ticketField: '' })),
                    responseCaptures: [],
                  }]);
                }} />
                <McpToolCallsEditor calls={mcpDraftCalls} onChange={setMcpDraftCalls} />
              </div>
              <McpResponseMappingsEditor
                mappings={mcpDraftMappings}
                onChange={setMcpDraftMappings}
                captureNames={mcpCaptureNames}
              />
            </>
          ) : (
            <>
              <div className="awb-field">
                <label className="awb-label">API Calls</label>
                <ExternalApiCallsEditor calls={draftCalls} onChange={setDraftCalls} />
              </div>
              <ExternalApiFieldMappingsEditor
                mappings={draftMappings}
                onChange={setDraftMappings}
                ticketFieldKeys={ticketFieldKeys}
                captureNames={captureNames}
              />
            </>
          )}

          <div className="awb-field">
            <label className="awb-label">Save as</label>
            <div className="awb-radio-row">
              <label className="awb-radio">
                <input type="radio" checked={targetMode === 'new'} onChange={() => setTargetMode('new')} />
                New action item
              </label>
              <label className="awb-radio">
                <input
                  type="radio"
                  checked={targetMode === 'existing'}
                  onChange={() => setTargetMode('existing')}
                  disabled={existingTargetNodes.length === 0}
                />
                Overwrite existing {actionType} item{existingTargetNodes.length === 0 ? ' (none yet)' : ''}
              </label>
            </div>
            {targetMode === 'existing' && (
              <select className="wfd-sel" value={targetNodeId} onChange={e => setTargetNodeId(e.target.value)}>
                <option value="">— Select item —</option>
                {existingTargetNodes.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}
              </select>
            )}
          </div>

          {saveError && <p className="awb-error">{saveError}</p>}

          <div className="awb-actions">
            <button className="wfd-btn-ghost" onClick={() => setStep(1)}><ArrowLeft size={13} /> Back</button>
            <button
              className="wfd-btn-save"
              disabled={saving || (actionType === 'mcp_tool' ? mcpDraftCalls.length === 0 : draftCalls.length === 0) || (targetMode === 'existing' && !targetNodeId)}
              onClick={handleSave}
            >
              {saving ? <><Loader2 size={13} className="awb-spin" /> Saving…</> : <>Save to Template <ArrowRight size={13} /></>}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3 ── */}
      {step === 3 && (
        <div className="awb-card awb-success">
          <div className="awb-success-icon"><Check size={22} /></div>
          <h3>Saved</h3>
          <p>"{savedNodeTitle}" was saved into <strong>{savedTemplateName}</strong>. Open it from the
            Templates tab and use the Workflow Designer to view it on the canvas or make further
            changes.</p>
          <button className="wfd-btn-save" onClick={startOver}><Sparkles size={13} /> Build another</button>
        </div>
      )}
    </div>
  );
};
