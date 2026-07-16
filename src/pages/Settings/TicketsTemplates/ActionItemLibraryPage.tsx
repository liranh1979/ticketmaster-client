import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, Pencil, Check, X, ClipboardList, Globe2, Plug, Sparkles } from 'lucide-react';
import api from '../../../api';
import { SimpleItemFieldsEditor, type SimpleItemField } from './SimpleItemFieldsEditor';
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

export interface ActionItemLibraryEntry {
  id: number;
  name: string;
  type: 'task' | 'external_api' | 'mcp_tool';
  typeConfig: ({
    fields?: SimpleItemField[];
    calls?: unknown[];
    fieldMappings?: ExternalApiFieldMappings | { response?: McpResponseMapping[] };
    serverUrl?: string;
    auth?: McpAuth;
  } & Record<string, unknown>) | null;
  source: 'manual' | 'ai';
  updatedAt: string;
}

const TYPE_ICON: Record<string, React.ReactNode> = {
  task: <ClipboardList size={16} />,
  external_api: <Globe2 size={16} />,
  mcp_tool: <Plug size={16} />,
};

const emptyMappings: ExternalApiFieldMappings = { request: [], response: [] };

export const ActionItemLibraryPage = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<ActionItemLibraryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newFields, setNewFields] = useState<SimpleItemField[]>([]);
  const [saving, setSaving] = useState(false);
  const [ticketFieldKeys, setTicketFieldKeys] = useState<string[]>([]);
  const [workflowFieldKeys, setWorkflowFieldKeys] = useState<string[]>([]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  // Simple (task)
  const [editingFields, setEditingFields] = useState<SimpleItemField[]>([]);
  // external_api
  const [editingCalls, setEditingCalls] = useState<ExternalApiCall[]>([]);
  const [editingMappings, setEditingMappings] = useState<ExternalApiFieldMappings>(emptyMappings);
  // mcp_tool
  const [editingMcpServerUrl, setEditingMcpServerUrl] = useState('');
  const [editingMcpAuth, setEditingMcpAuth] = useState<McpAuth>({ type: 'none' });
  const [editingMcpDiscoveredTools, setEditingMcpDiscoveredTools] = useState<any[]>([]);
  const [editingMcpCalls, setEditingMcpCalls] = useState<McpCall[]>([]);
  const [editingMcpMappings, setEditingMcpMappings] = useState<McpResponseMapping[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/action-item-library');
      setEntries(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    api.get('/field-definitions', { params: { entityType: 'ticket' } })
      .then(r => setTicketFieldKeys(r.data.map((f: any) => f.fieldKey)))
      .catch(() => {});
    api.get('/field-definitions', { params: { entityType: 'workflow' } })
      .then(r => setWorkflowFieldKeys(r.data.filter((f: any) => !f.isSystem).map((f: any) => f.fieldKey)))
      .catch(() => {});
  }, []);

  const handleCreateSimple = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await api.post('/action-item-library', {
        name: newName.trim(), type: 'task', source: 'manual',
        typeConfig: newFields.length > 0 ? { fields: newFields } : undefined,
      });
      setNewName('');
      setNewFields([]);
      setCreating(false);
      await load();
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (entry: ActionItemLibraryEntry) => {
    setEditingId(entry.id);
    setEditingName(entry.name);
    setEditingMcpDiscoveredTools([]);
    if (entry.type === 'task') {
      setEditingFields(entry.typeConfig?.fields ?? []);
    } else if (entry.type === 'external_api') {
      setEditingCalls((entry.typeConfig?.calls as ExternalApiCall[]) ?? []);
      setEditingMappings((entry.typeConfig?.fieldMappings as ExternalApiFieldMappings) ?? emptyMappings);
    } else if (entry.type === 'mcp_tool') {
      setEditingMcpServerUrl(entry.typeConfig?.serverUrl ?? '');
      setEditingMcpAuth(entry.typeConfig?.auth ?? { type: 'none' });
      setEditingMcpCalls((entry.typeConfig?.calls as McpCall[]) ?? []);
      setEditingMcpMappings((entry.typeConfig?.fieldMappings as { response?: McpResponseMapping[] })?.response ?? []);
    }
  };

  const saveEdit = async (entry: ActionItemLibraryEntry) => {
    if (!editingName.trim()) return;
    let typeConfig: ActionItemLibraryEntry['typeConfig'];
    if (entry.type === 'task') {
      typeConfig = { ...entry.typeConfig, fields: editingFields };
    } else if (entry.type === 'external_api') {
      typeConfig = { calls: editingCalls, fieldMappings: editingMappings };
    } else if (entry.type === 'mcp_tool') {
      typeConfig = {
        serverUrl: editingMcpServerUrl, auth: editingMcpAuth,
        calls: editingMcpCalls, fieldMappings: { response: editingMcpMappings },
      };
    } else {
      typeConfig = entry.typeConfig;
    }
    await api.put(`/action-item-library/${entry.id}`, {
      name: editingName.trim(), type: entry.type, typeConfig, source: entry.source,
    });
    setEditingId(null);
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm(t('action_item_library_delete_confirm', { defaultValue: 'Delete this action item from the library?' }))) return;
    await api.delete(`/action-item-library/${id}`);
    await load();
  };

  const captureNamesOf = (calls: { responseCaptures: { name: string }[] }[]) =>
    calls.flatMap(c => c.responseCaptures.map(r => r.name).filter(Boolean));

  return (
    <div className="ail-page">
      <div className="ail-toolbar">
        <p className="ail-hint">
          {t('action_item_library_hint', { defaultValue: 'Reusable action items — add one to any template from the Workflow Designer. Adding a copy here never changes other templates already using it.' })}
        </p>
        {!creating && (
          <button className="ail-add-btn" onClick={() => setCreating(true)}>
            <Plus size={14} /> {t('action_item_library_new_simple_btn', { defaultValue: 'New Simple Action Item' })}
          </button>
        )}
      </div>

      {creating && (
        <div className="ail-new-panel">
          <div className="ail-new-row">
            <input
              className="wfd-inp"
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder={t('action_item_library_name_placeholder', { defaultValue: 'e.g. Provision Access' }) as string}
            />
          </div>
          <div className="ail-new-fields-label">{t('simple_item_fields_label', { defaultValue: 'FIELDS (optional)' })}</div>
          <SimpleItemFieldsEditor fields={newFields} onChange={setNewFields} />
          <div className="ail-new-actions">
            <button className="wfd-btn-save" onClick={handleCreateSimple} disabled={saving || !newName.trim()}>
              {t('add_btn', { defaultValue: 'Add' })}
            </button>
            <button className="wfd-btn-ghost" onClick={() => { setCreating(false); setNewName(''); setNewFields([]); }}>
              {t('cancel_btn', { defaultValue: 'Cancel' })}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="ail-state">{t('loading_ellipsis', { defaultValue: 'Loading…' })}</div>
      ) : entries.length === 0 ? (
        <div className="ail-state">{t('action_item_library_empty', { defaultValue: 'No action items yet — build one here, or with the AI Workflow Builder tab.' })}</div>
      ) : (
        <div className="ail-list">
          {entries.map(entry => (
            <div key={entry.id} className="ail-card-wrap">
              <div className="ail-card">
                <span className="ail-card-icon">{TYPE_ICON[entry.type] ?? <ClipboardList size={16} />}</span>
                <div className="ail-card-body">
                  {editingId === entry.id ? (
                    <input
                      className="wfd-inp"
                      autoFocus
                      value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                    />
                  ) : (
                    <span className="ail-card-name">{entry.name}</span>
                  )}
                  <span className={`ail-source-badge ail-source-${entry.source}`}>
                    {entry.source === 'ai' ? <><Sparkles size={10} /> {t('action_item_library_ai_badge', { defaultValue: 'AI' })}</> : t('action_item_library_simple_badge', { defaultValue: 'Simple' })}
                  </span>
                </div>
                <div className="ail-card-actions">
                  {editingId === entry.id ? (
                    <>
                      <button className="ail-icon-btn" onClick={() => saveEdit(entry)}><Check size={14} /></button>
                      <button className="ail-icon-btn" onClick={() => setEditingId(null)}><X size={14} /></button>
                    </>
                  ) : (
                    <>
                      <button className="ail-icon-btn" onClick={() => startEdit(entry)}><Pencil size={14} /></button>
                      <button className="ail-icon-btn ail-icon-delete" onClick={() => handleDelete(entry.id)}><Trash2 size={14} /></button>
                    </>
                  )}
                </div>
              </div>

              {editingId === entry.id && entry.type === 'task' && (
                <div className="ail-card-fields">
                  <div className="ail-new-fields-label">{t('simple_item_fields_label', { defaultValue: 'FIELDS (optional)' })}</div>
                  <SimpleItemFieldsEditor fields={editingFields} onChange={setEditingFields} />
                </div>
              )}

              {editingId === entry.id && entry.type === 'external_api' && (
                <div className="ail-card-fields">
                  <div className="ail-new-fields-label">{t('workflow_api_calls_label', { defaultValue: 'API CALLS' })}</div>
                  <ExternalApiCallsEditor calls={editingCalls} onChange={setEditingCalls} />
                  <ExternalApiFieldMappingsEditor
                    mappings={editingMappings}
                    onChange={setEditingMappings}
                    ticketFieldKeys={ticketFieldKeys}
                    workflowFieldKeys={workflowFieldKeys}
                    captureNames={captureNamesOf(editingCalls)}
                  />
                </div>
              )}

              {editingId === entry.id && entry.type === 'mcp_tool' && (
                <div className="ail-card-fields">
                  <div className="ail-new-fields-label">{t('workflow_mcp_tool_calls_label', { defaultValue: 'MCP TOOL CALLS' })}</div>
                  <McpServerConnectionEditor
                    serverUrl={editingMcpServerUrl}
                    onServerUrlChange={setEditingMcpServerUrl}
                    auth={editingMcpAuth}
                    onAuthChange={setEditingMcpAuth}
                    onToolsDiscovered={setEditingMcpDiscoveredTools}
                  />
                  <McpToolPicker tools={editingMcpDiscoveredTools} onPick={tool => {
                    const properties = tool?.inputSchema?.properties ?? {};
                    setEditingMcpCalls(prev => [...prev, {
                      id: crypto.randomUUID(), order: prev.length, toolName: tool.name,
                      argumentMappings: Object.keys(properties).map(key => ({ toolArgument: key, ticketField: '' })),
                      responseCaptures: [],
                    }]);
                  }} />
                  <McpToolCallsEditor
                    calls={editingMcpCalls} onChange={setEditingMcpCalls}
                    ticketFieldKeys={ticketFieldKeys} workflowFieldKeys={workflowFieldKeys}
                  />
                  <McpResponseMappingsEditor
                    mappings={editingMcpMappings}
                    onChange={setEditingMcpMappings}
                    captureNames={captureNamesOf(editingMcpCalls)}
                    ticketFieldKeys={ticketFieldKeys}
                    workflowFieldKeys={workflowFieldKeys}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
