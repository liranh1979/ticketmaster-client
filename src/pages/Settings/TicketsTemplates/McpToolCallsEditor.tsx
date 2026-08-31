import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, GripVertical, Search, Loader2, AlertCircle, AlertTriangle, ArrowUpFromLine, RefreshCw, Play } from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SecretInput, FieldRefSelect, TICKET_FIELD_BASE, useNodelistTargets, findCollidingTargets } from './ExternalApiCallsEditor';
import api from '../../../api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface McpArgumentMapping {
  toolArgument: string;
  ticketField?: string;
  captureName?: string;
  /** A fixed, admin-typed constant — for a tool parameter that's always the same value for every
   * ticket (e.g. a hotel-search tool's "rooms" argument), where mapping from a ticket field or
   * capture would mean inventing a fake constant field just to hold it. Coerced to a real
   * number/boolean server-side when it looks like one — see McpActionExecutor.coerceLiteral. */
  literalValue?: string;
}
export interface McpResponseCapture {
  name: string;
  resultPath: string;
  // "ai_summary" — the admin selected a whole array/object branch in the Visual JSON Explorer
  // (not a single leaf) and asked the AI to turn it into an HTML summary for a rich-text field,
  // instead of a plain JSONPath extraction. Absent/"jsonpath" is the existing, unchanged behavior
  // — see McpActionExecutor.applyResponseCapture's javadoc for the real runtime dispatch.
  mode?: 'jsonpath' | 'ai_summary';
  summaryInstruction?: string;
}

export interface McpCall {
  id: string;
  order: number;
  toolName: string;
  argumentMappings: McpArgumentMapping[];
  responseCaptures: McpResponseCapture[];
}

export interface McpAuth {
  // "saved_external" is a sentinel: "resolve serverUrl+auth live from a saved external MCP server
  // (Settings → MCP Servers) by id at execution time" instead of an embedded static snapshot —
  // required for OAuth2 connection auth, which genuinely expires and must be refreshed fresh on
  // every real call, not baked in once when this action item was configured. See
  // McpActionExecutor.runSequence's javadoc for the backend side of this.
  type: 'none' | 'bearer' | 'api_key' | 'saved_external';
  headerName?: string;
  hasToken?: boolean;
  token?: string;
  /** saved_external only. */
  mcpServerId?: number;
}

export interface McpResponseMapping { captureName: string; target: string; }

interface DiscoveredTool {
  name: string;
  description?: string;
  inputSchema?: { properties?: Record<string, unknown>; required?: string[] };
}

export function makeDefaultCall(order: number, toolName = ''): McpCall {
  return { id: crypto.randomUUID(), order, toolName, argumentMappings: [], responseCaptures: [] };
}

// ── Server connection (URL + auth + discover) ────────────────────────────────

interface BuiltinMcpServer {
  id: number;
  server_kind: 'generated' | 'external';
  name: string;
  port?: number;
  status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'EXTERNAL';
  server_url?: string;
}

export const McpServerConnectionEditor = ({
  serverUrl, onServerUrlChange, auth, onAuthChange, onToolsDiscovered,
}: {
  serverUrl: string;
  onServerUrlChange: (v: string) => void;
  auth: McpAuth;
  onAuthChange: (a: McpAuth) => void;
  onToolsDiscovered: (tools: DiscoveredTool[]) => void;
}) => {
  const { t } = useTranslation();
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState('');

  // Built-in servers are admin-generated locally-run MCP servers (Settings → MCP Servers) — this
  // toggle just switches which inputs populate serverUrl/auth; everything downstream (discover,
  // McpToolPicker, McpToolCallsEditor, McpResponseMappingsEditor) is unchanged either way.
  const [mode, setMode] = useState<'builtin' | 'public'>(serverUrl?.startsWith('http://localhost:') ? 'builtin' : 'public');
  const [builtinServers, setBuiltinServers] = useState<BuiltinMcpServer[]>([]);
  // A real gap found live: this picker used to only discover tools via the generic
  // /mcp/discover-tools endpoint, which has no idea what this built-in server was originally
  // designed to have — so a script the AI under-generated (fewer real parameters than intended)
  // looked like a completely valid, argument-less tool here, with no warning at all, even though
  // the dedicated MCP Servers management wizard already flags exactly this. Checking it here too,
  // right when the server is picked, catches it before the admin builds a call around it.
  const [designMismatches, setDesignMismatches] = useState<{ tool: string; missing_args: string[]; not_deployed: boolean }[]>([]);

  useEffect(() => {
    api.get('/mcp-servers/available').then(res => setBuiltinServers(res.data)).catch(() => setBuiltinServers([]));
  }, []);

  const handlePickBuiltin = (id: string) => {
    const server = builtinServers.find(s => String(s.id) === id);
    if (!server) return;
    if (server.server_kind === 'external') {
      // Display-only snapshot of the current URL — the source of truth for real execution is the
      // live entity, resolved fresh (including OAuth2 refresh) via the saved_external auth
      // sentinel, never this embedded copy.
      onServerUrlChange(server.server_url ?? '');
      onAuthChange({ type: 'saved_external', mcpServerId: server.id });
      setDesignMismatches([]);
      return;
    }
    onServerUrlChange(`http://localhost:${server.port}`);
    onAuthChange({ type: 'none' });
    setDesignMismatches([]);
    api.get(`/mcp-servers/${server.id}/design-mismatches`).then(res => setDesignMismatches(res.data || [])).catch(() => setDesignMismatches([]));
  };

  const handleDiscover = async () => {
    setDiscoverError('');
    setDiscovering(true);
    try {
      if (auth.type === 'saved_external' && auth.mcpServerId) {
        // Auth (including OAuth2 resolution/refresh) is resolved server-side from the saved
        // entity — the frontend never sees the real token, so it can't call the generic
        // /mcp/discover-tools endpoint the way it does for a raw Public URL.
        const res = await api.post(`/mcp-servers/external/${auth.mcpServerId}/test`);
        onToolsDiscovered(res.data.tools ?? []);
      } else {
        const res = await api.post('/mcp/discover-tools', {
          serverUrl,
          type: auth.type,
          headerName: auth.type === 'api_key' ? auth.headerName : undefined,
          token: (auth.type === 'bearer' || auth.type === 'api_key') ? auth.token : undefined,
        });
        onToolsDiscovered(res.data);
      }
    } catch (err: any) {
      setDiscoverError(err?.response?.data?.message || t('mcp_discover_failed', { defaultValue: 'Could not reach the MCP server.' }));
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="eae-subsec">
      <div className="eae-subsec-lbl">{t('mcp_server_section_label', { defaultValue: 'MCP SERVER' })}</div>

      <div className="mte-mode-toggle">
        <button type="button" className={`mte-mode-opt${mode === 'builtin' ? ' sel' : ''}`} onClick={() => setMode('builtin')}>
          {t('mcp_mode_saved', { defaultValue: 'Saved Server' })}
        </button>
        <button type="button" className={`mte-mode-opt${mode === 'public' ? ' sel' : ''}`} onClick={() => setMode('public')}>
          {t('mcp_mode_public', { defaultValue: 'Public URL' })}
        </button>
      </div>

      {mode === 'builtin' ? (
        <>
          <select
            className="wfd-sel"
            value={auth.type === 'saved_external' ? String(auth.mcpServerId ?? '') : (builtinServers.find(s => s.server_kind === 'generated' && `http://localhost:${s.port}` === serverUrl)?.id ?? '')}
            onChange={e => handlePickBuiltin(e.target.value)}
          >
            <option value="">{t('mcp_select_builtin_placeholder', { defaultValue: 'Select a saved server…' })}</option>
            {builtinServers.map(s => (
              <option key={s.id} value={s.id}>
                {s.server_kind === 'external' ? `${s.name} — ${t('mcp_server_kind_external', { defaultValue: 'External' })}` : `${s.name} — :${s.port} (${s.status})`}
              </option>
            ))}
          </select>
          {builtinServers.length === 0 && (
            <p className="wfd-hint-xs">{t('mcp_no_builtin_servers_hint', { defaultValue: 'No saved MCP servers yet — create one under Settings → MCP Servers.' })}</p>
          )}
          {designMismatches.length > 0 && (
            <p className="mte-error">
              <AlertCircle size={11} />{' '}
              {t('mcp_builtin_design_mismatch_hint', { defaultValue: "This server is missing some inputs it was designed to have — {{details}}. A super-admin can fix this under Settings → MCP Servers." , details: designMismatches.map(m => m.not_deployed ? `"${m.tool}" isn't deployed` : `"${m.tool}" is missing ${m.missing_args.join(', ')}`).join('; ') })}
            </p>
          )}
        </>
      ) : (
        <>
          <input
            className="wfd-inp"
            value={serverUrl}
            onChange={e => onServerUrlChange(e.target.value)}
            placeholder={t('mcp_server_url_placeholder', { defaultValue: 'https://mcp.example.com' }) as string}
          />
          <select className="wfd-sel" value={auth.type} onChange={e => onAuthChange({ ...auth, type: e.target.value as McpAuth['type'] })}>
            <option value="none">{t('mcp_no_auth_option', { defaultValue: 'No auth' })}</option>
            <option value="bearer">{t('auth_bearer_token_option', { defaultValue: 'Bearer token' })}</option>
            <option value="api_key">{t('auth_api_key_header_option', { defaultValue: 'API key header' })}</option>
          </select>
          {auth.type === 'bearer' && (
            <SecretInput label={t('secret_token_label', { defaultValue: 'Token' })} hasValue={auth.hasToken} value={auth.token} onChange={v => onAuthChange({ ...auth, token: v })} />
          )}
          {auth.type === 'api_key' && (
            <>
              <input
                className="wfd-inp"
                value={auth.headerName ?? ''}
                onChange={e => onAuthChange({ ...auth, headerName: e.target.value })}
                placeholder={t('eae_header_name_placeholder', { defaultValue: 'Header name (default X-API-Key)' }) as string}
              />
              <SecretInput label={t('secret_api_key_label', { defaultValue: 'API key' })} hasValue={auth.hasToken} value={auth.token} onChange={v => onAuthChange({ ...auth, token: v })} />
            </>
          )}
        </>
      )}

      <button className="wfd-add-flow-btn" onClick={handleDiscover} disabled={!serverUrl || discovering}>
        {discovering ? <><Loader2 size={10} className="mte-spin" /> {t('mcp_connecting_ellipsis', { defaultValue: 'Connecting…' })}</> : <><Search size={10} /> {t('mcp_discover_tools_btn', { defaultValue: 'Discover Tools' })}</>}
      </button>
      {discoverError && <p className="mte-error"><AlertCircle size={11} /> {discoverError}</p>}
      {(auth.type === 'bearer' || auth.type === 'api_key') && !auth.token && (
        <p className="wfd-hint-xs">{t('mcp_discover_token_hint', { defaultValue: "Discovery uses the token you type above this session — a previously saved token can't be read back to test with; re-enter it here if the server requires auth." })}</p>
      )}
    </div>
  );
};

// ── Discovered tools picker ──────────────────────────────────────────────────

export const McpToolPicker = ({
  tools, onPick,
}: {
  tools: DiscoveredTool[];
  onPick: (tool: DiscoveredTool) => void;
}) => {
  const { t } = useTranslation();
  if (tools.length === 0) return null;
  return (
    <div className="eae-subsec">
      <div className="eae-subsec-lbl">{t('mcp_discovered_tools_label', { defaultValue: 'DISCOVERED TOOLS — click to add a call' })}</div>
      <div className="mte-tool-list">
        {tools.map(tool => (
          <button key={tool.name} className="mte-tool-chip" onClick={() => onPick(tool)} title={tool.description}>
            {tool.name}
          </button>
        ))}
      </div>
    </div>
  );
};

// ── Call row ──────────────────────────────────────────────────────────────

function ArgMappingRow({
  mapping, onChange, onRemove, ticketFieldKeys, workflowFieldKeys,
}: {
  mapping: McpArgumentMapping;
  onChange: (m: McpArgumentMapping) => void;
  onRemove: () => void;
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
}) {
  const { t } = useTranslation();
  const sourceKind = mapping.captureName !== undefined ? 'capture' : mapping.literalValue !== undefined ? 'literal' : 'ticket';
  const ticketFieldOpts = [...TICKET_FIELD_BASE, ...ticketFieldKeys.filter(k => !TICKET_FIELD_BASE.includes(k))];
  return (
    <div className="eae-kv-row">
      <input className="wfd-inp" value={mapping.toolArgument} onChange={e => onChange({ ...mapping, toolArgument: e.target.value })} placeholder={t('mcp_argument_name_placeholder', { defaultValue: 'argument name' }) as string} />
      <select
        className="wfd-sel"
        value={sourceKind}
        onChange={e => onChange(
          e.target.value === 'capture' ? { toolArgument: mapping.toolArgument, captureName: '' }
          : e.target.value === 'literal' ? { toolArgument: mapping.toolArgument, literalValue: '' }
          : { toolArgument: mapping.toolArgument, ticketField: `ticket.${ticketFieldOpts[0] ?? 'title'}` })}
      >
        <option value="ticket">{t('mcp_arg_from_ticket_field_option', { defaultValue: 'from ticket field' })}</option>
        <option value="capture">{t('mcp_arg_from_capture_option', { defaultValue: 'from earlier capture' })}</option>
        <option value="literal">{t('mcp_arg_fixed_value_option', { defaultValue: 'fixed value' })}</option>
      </select>
      {sourceKind === 'capture' ? (
        <input className="wfd-inp" value={mapping.captureName ?? ''} onChange={e => onChange({ toolArgument: mapping.toolArgument, captureName: e.target.value })} placeholder={t('capture_name_placeholder', { defaultValue: 'captureName' }) as string} />
      ) : sourceKind === 'literal' ? (
        <input className="wfd-inp" value={mapping.literalValue ?? ''} onChange={e => onChange({ toolArgument: mapping.toolArgument, literalValue: e.target.value })} placeholder={t('mcp_arg_fixed_value_placeholder', { defaultValue: 'e.g. 1, true, or some text' }) as string} />
      ) : (
        <FieldRefSelect
          value={mapping.ticketField && mapping.ticketField.includes('.') ? mapping.ticketField : ''}
          onChange={v => onChange({ toolArgument: mapping.toolArgument, ticketField: v })}
          ticketFieldOpts={ticketFieldOpts}
          workflowFieldKeys={workflowFieldKeys}
          allowEmpty
        />
      )}
      <button className="ale-rm-btn" onClick={onRemove}><X size={11} /></button>
    </div>
  );
}

function CallRow({
  call, index, onChange, onRemove, ticketFieldKeys, workflowFieldKeys, serverUrl, auth,
}: {
  call: McpCall;
  index: number;
  onChange: (updated: McpCall) => void;
  onRemove: () => void;
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
  serverUrl: string;
  auth: McpAuth;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: call.id });
  const [expanded, setExpanded] = useState(index === 0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState('');

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const upd = (patch: Partial<McpCall>) => onChange({ ...call, ...patch });

  const addArg = () => upd({ argumentMappings: [...call.argumentMappings, { toolArgument: '', ticketField: '' }] });
  const updArg = (i: number, m: McpArgumentMapping) => upd({ argumentMappings: call.argumentMappings.map((a, idx) => idx === i ? m : a) });
  const rmArg = (i: number) => upd({ argumentMappings: call.argumentMappings.filter((_, idx) => idx !== i) });

  // A real bug found live: argumentMappings is a one-time snapshot taken when the tool was first
  // picked (addMcpCallFromTool). If the underlying MCP server's script is edited/regenerated
  // afterward (e.g. via "Ask AI to Fix" adding parameters it was missing), an ALREADY-CONFIGURED
  // call here never picks that up automatically — it silently keeps calling with fewer arguments
  // than the tool now actually has, exactly matching "it works when I test the MCP directly, but
  // the action item doesn't ask for all the fields." This re-fetches the tool's current real
  // schema and adds any newly-appeared parameters as blank rows — existing mappings are left
  // untouched, so nothing an admin already configured gets silently discarded.
  const refreshArgs = async () => {
    if (!serverUrl || !call.toolName) return;
    setRefreshError('');
    setRefreshing(true);
    try {
      const res = await api.post('/mcp/discover-tools', {
        serverUrl,
        type: auth.type,
        headerName: auth.type === 'api_key' ? auth.headerName : undefined,
        token: (auth.type === 'bearer' || auth.type === 'api_key') ? auth.token : undefined,
      });
      const tool = (res.data as { name: string; inputSchema?: { properties?: Record<string, unknown> } }[])
        .find(t => t.name === call.toolName);
      const liveArgNames = Object.keys(tool?.inputSchema?.properties ?? {});
      const existingArgNames = new Set(call.argumentMappings.map(m => m.toolArgument));
      const newRows: McpArgumentMapping[] = liveArgNames
        .filter(name => !existingArgNames.has(name))
        .map(name => ({ toolArgument: name, ticketField: '' }));
      if (newRows.length > 0) {
        upd({ argumentMappings: [...call.argumentMappings, ...newRows] });
      } else if (!tool) {
        setRefreshError(t('mcp_refresh_tool_not_found', { defaultValue: 'This tool was not found on the server — has it been renamed or removed?' }) as string);
      }
    } catch (err: any) {
      setRefreshError(err?.response?.data?.message || t('mcp_discover_failed', { defaultValue: 'Could not reach the MCP server.' }) as string);
    } finally {
      setRefreshing(false);
    }
  };

  const addCapture = () => upd({ responseCaptures: [...call.responseCaptures, { name: '', resultPath: '$.text' }] });
  const updCapture = (i: number, patch: Partial<McpResponseCapture>) =>
    upd({ responseCaptures: call.responseCaptures.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const rmCapture = (i: number) => upd({ responseCaptures: call.responseCaptures.filter((_, idx) => idx !== i) });

  return (
    <div ref={setNodeRef} style={style} className="eae-call">
      <div className="eae-call-top">
        <span className="eae-grip" {...attributes} {...listeners}><GripVertical size={13} /></span>
        <span className="eae-call-order">#{index + 1}</span>
        <input
          className="wfd-inp eae-call-name"
          value={call.toolName}
          onChange={e => upd({ toolName: e.target.value })}
          placeholder={t('mcp_tool_name_placeholder', { defaultValue: 'toolName' }) as string}
        />
        <button className="eae-toggle-btn" onClick={() => setExpanded(v => !v)}>{expanded ? '▾' : '▸'}</button>
        <button className="ale-rm-btn" onClick={onRemove}><X size={12} /></button>
      </div>

      {expanded && (
        <div className="eae-call-body">
          <div className="eae-subsec">
            <div className="eae-subsec-row">
              <div className="eae-subsec-lbl">{t('mcp_arguments_label', { defaultValue: 'ARGUMENTS' })}</div>
              <button className="wfd-add-flow-btn" onClick={refreshArgs} disabled={refreshing || !serverUrl || !call.toolName} title={t('mcp_refresh_args_hint', { defaultValue: "Re-check the tool's current real parameters and add any that are missing here" }) as string}>
                {refreshing ? <Loader2 size={10} className="mte-spin" /> : <RefreshCw size={10} />} {t('mcp_refresh_args_btn', { defaultValue: 'Refresh' })}
              </button>
              <button className="wfd-add-flow-btn" onClick={addArg}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
            </div>
            {refreshError && <p className="mte-error"><AlertCircle size={11} /> {refreshError}</p>}
            {call.argumentMappings.length === 0 && <p className="wfd-empty-txt">{t('mcp_no_arguments_empty', { defaultValue: 'No arguments mapped — the tool will be called with an empty argument set' })}</p>}
            {call.argumentMappings.map((m, i) => (
              <ArgMappingRow
                key={i} mapping={m} onChange={updated => updArg(i, updated)} onRemove={() => rmArg(i)}
                ticketFieldKeys={ticketFieldKeys} workflowFieldKeys={workflowFieldKeys}
              />
            ))}
          </div>

          <div className="eae-subsec">
            <div className="eae-subsec-row">
              <div className="eae-subsec-lbl">{t('response_captures_label', { defaultValue: 'RESPONSE CAPTURES' })}</div>
              <button className="wfd-add-flow-btn" onClick={addCapture}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
            </div>
            {call.responseCaptures.length === 0 && <p className="wfd-empty-txt">{t('mcp_no_response_captures_empty', { defaultValue: "No values captured from this call's result yet" })}</p>}
            {call.responseCaptures.map((c, i) => (
              <div key={i} className="eae-kv-row">
                <input className="wfd-inp" value={c.name} onChange={e => updCapture(i, { name: e.target.value })} placeholder={t('capture_name_placeholder', { defaultValue: 'captureName' }) as string} />
                <input className="wfd-inp" value={c.resultPath} onChange={e => updCapture(i, { resultPath: e.target.value })} placeholder={t('mcp_result_path_placeholder', { defaultValue: '$.text or $.field' }) as string} />
                <button className="ale-rm-btn" onClick={() => rmCapture(i)}><X size={11} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calls list editor ─────────────────────────────────────────────────────

export const McpToolCallsEditor = ({
  calls, onChange, ticketFieldKeys, workflowFieldKeys, serverUrl, auth,
}: {
  calls: McpCall[];
  onChange: (calls: McpCall[]) => void;
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
  /** Needed for each call row's "Refresh" action, which re-checks the tool's current real
   * parameters against a possibly-stale saved argument list — see CallRow's refreshArgs javadoc. */
  serverUrl: string;
  auth: McpAuth;
}) => {
  const { t } = useTranslation();
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = calls.map(c => c.id);
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    onChange(arrayMove(calls, oldIdx, newIdx).map((c, i) => ({ ...c, order: i })));
  };

  const updateCall = (i: number, updated: McpCall) => onChange(calls.map((c, idx) => idx === i ? updated : c));
  const removeCall = (i: number) => onChange(calls.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, order: idx })));
  const addCall = () => onChange([...calls, makeDefaultCall(calls.length)]);

  return (
    <div className="ale-wrap">
      {calls.length === 0 ? (
        <p className="wfd-empty-txt">{t('mcp_calls_empty', { defaultValue: 'No tool calls configured yet — discover tools above, or add one manually.' })}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={calls.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {calls.map((call, i) => (
              <CallRow
                key={call.id} call={call} index={i} onChange={updated => updateCall(i, updated)} onRemove={() => removeCall(i)}
                ticketFieldKeys={ticketFieldKeys} workflowFieldKeys={workflowFieldKeys} serverUrl={serverUrl} auth={auth}
              />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <button className="wfd-add-flow-btn ale-add-btn" onClick={addCall}><Plus size={10} /> {t('mcp_add_call_manually_btn', { defaultValue: 'Add call manually' })}</button>
    </div>
  );
};

// ── Response field mappings ────────────────────────────────────────────────

export const McpResponseMappingsEditor = ({
  mappings, onChange, captureNames, ticketFieldKeys, workflowFieldKeys, onTestClick,
}: {
  mappings: McpResponseMapping[];
  onChange: (m: McpResponseMapping[]) => void;
  captureNames: string[];
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
  // See ExternalApiFieldMappingsEditor's identical prop for why — only the Workflow Designer
  // passes this (its "Test this call now" entry point lives up in MCP TOOL CALLS' header, nowhere
  // near this RESPONSE DATA section).
  onTestClick?: () => void;
}) => {
  const { t } = useTranslation();
  const ticketFieldOpts = [...TICKET_FIELD_BASE, ...ticketFieldKeys.filter(k => !TICKET_FIELD_BASE.includes(k))];
  const nodelistTargets = useNodelistTargets();
  const collidingTargets = findCollidingTargets(mappings, nodelistTargets);
  const add = () => onChange([...mappings, { captureName: captureNames[0] ?? '', target: `ticket.${ticketFieldOpts[0] ?? 'title'}` }]);
  const upd = (i: number, patch: Partial<McpResponseMapping>) => onChange(mappings.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  const rm = (i: number) => onChange(mappings.filter((_, idx) => idx !== i));

  return (
    <div className="wfd-sec">
      <div className="wfd-sec-row">
        <div className="wfd-sec-lbl"><ArrowUpFromLine size={9} /> {t('response_data_mapping_label', { defaultValue: 'RESPONSE DATA (captures → fields)' })}</div>
        <div className="wfd-sec-row-btns">
          {onTestClick && (
            <button className="wfd-add-flow-btn" onClick={onTestClick}>
              <Play size={10} /> {t('response_mapping_test_map_btn', { defaultValue: 'Test & Map with AI' })}
            </button>
          )}
          <button className="wfd-add-flow-btn" onClick={add}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
        </div>
      </div>
      {mappings.length === 0 && <p className="wfd-empty-txt">{t('response_mapping_empty', { defaultValue: 'No captured values are saved anywhere yet' })}</p>}
      {collidingTargets.size > 0 && (
        <p className="mte-error">
          <AlertTriangle size={11} />{' '}
          {t('response_mapping_collision_hint', {
            defaultValue: 'Multiple captures are mapped to the same field — only the last one applied will actually be saved: {{targets}}',
            targets: [...collidingTargets].join(', '),
          })}
        </p>
      )}
      {mappings.map((m, i) => (
        <div key={i} className={`eae-kv-row${m.target && collidingTargets.has(m.target) ? ' eae-kv-row-warn' : ''}`}>
          <input className="wfd-inp" value={m.captureName} onChange={e => upd(i, { captureName: e.target.value })} placeholder={t('capture_name_placeholder', { defaultValue: 'captureName' }) as string} list="mte-capture-names" />
          <span className="eae-arrow">→</span>
          <FieldRefSelect
            value={m.target || `ticket.${ticketFieldOpts[0] ?? 'title'}`}
            onChange={v => upd(i, { target: v })}
            ticketFieldOpts={ticketFieldOpts}
            workflowFieldKeys={workflowFieldKeys}
          />
          <button className="ale-rm-btn" onClick={() => rm(i)}><X size={11} /></button>
        </div>
      ))}
      <datalist id="mte-capture-names">
        {captureNames.map(n => <option key={n} value={n} />)}
      </datalist>
    </div>
  );
};
