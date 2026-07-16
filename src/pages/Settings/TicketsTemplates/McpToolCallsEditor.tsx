import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, GripVertical, Search, Loader2, AlertCircle, ArrowUpFromLine } from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SecretInput, FieldRefSelect, TICKET_FIELD_BASE } from './ExternalApiCallsEditor';
import api from '../../../api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface McpArgumentMapping {
  toolArgument: string;
  ticketField?: string;
  captureName?: string;
}
export interface McpResponseCapture { name: string; resultPath: string; }

export interface McpCall {
  id: string;
  order: number;
  toolName: string;
  argumentMappings: McpArgumentMapping[];
  responseCaptures: McpResponseCapture[];
}

export interface McpAuth {
  type: 'none' | 'bearer';
  hasToken?: boolean;
  token?: string;
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

  const handleDiscover = async () => {
    setDiscoverError('');
    setDiscovering(true);
    try {
      const res = await api.post('/mcp/discover-tools', {
        serverUrl,
        token: auth.type === 'bearer' ? auth.token : undefined,
      });
      onToolsDiscovered(res.data);
    } catch (err: any) {
      setDiscoverError(err?.response?.data?.message || t('mcp_discover_failed', { defaultValue: 'Could not reach the MCP server.' }));
    } finally {
      setDiscovering(false);
    }
  };

  return (
    <div className="eae-subsec">
      <div className="eae-subsec-lbl">{t('mcp_server_section_label', { defaultValue: 'MCP SERVER' })}</div>
      <input
        className="wfd-inp"
        value={serverUrl}
        onChange={e => onServerUrlChange(e.target.value)}
        placeholder={t('mcp_server_url_placeholder', { defaultValue: 'https://mcp.example.com' }) as string}
      />
      <select className="wfd-sel" value={auth.type} onChange={e => onAuthChange({ ...auth, type: e.target.value as McpAuth['type'] })}>
        <option value="none">{t('mcp_no_auth_option', { defaultValue: 'No auth' })}</option>
        <option value="bearer">{t('auth_bearer_token_option', { defaultValue: 'Bearer token' })}</option>
      </select>
      {auth.type === 'bearer' && (
        <SecretInput label={t('secret_token_label', { defaultValue: 'Token' })} hasValue={auth.hasToken} value={auth.token} onChange={v => onAuthChange({ ...auth, token: v })} />
      )}
      <button className="wfd-add-flow-btn" onClick={handleDiscover} disabled={!serverUrl || discovering}>
        {discovering ? <><Loader2 size={10} className="mte-spin" /> {t('mcp_connecting_ellipsis', { defaultValue: 'Connecting…' })}</> : <><Search size={10} /> {t('mcp_discover_tools_btn', { defaultValue: 'Discover Tools' })}</>}
      </button>
      {discoverError && <p className="mte-error"><AlertCircle size={11} /> {discoverError}</p>}
      {auth.type === 'bearer' && !auth.token && (
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
  const sourceKind = mapping.captureName !== undefined ? 'capture' : 'ticket';
  const ticketFieldOpts = [...TICKET_FIELD_BASE, ...ticketFieldKeys.filter(k => !TICKET_FIELD_BASE.includes(k))];
  return (
    <div className="eae-kv-row">
      <input className="wfd-inp" value={mapping.toolArgument} onChange={e => onChange({ ...mapping, toolArgument: e.target.value })} placeholder={t('mcp_argument_name_placeholder', { defaultValue: 'argument name' }) as string} />
      <select
        className="wfd-sel"
        value={sourceKind}
        onChange={e => onChange(e.target.value === 'capture'
          ? { toolArgument: mapping.toolArgument, captureName: '' }
          : { toolArgument: mapping.toolArgument, ticketField: `ticket.${ticketFieldOpts[0] ?? 'title'}` })}
      >
        <option value="ticket">{t('mcp_arg_from_ticket_field_option', { defaultValue: 'from ticket field' })}</option>
        <option value="capture">{t('mcp_arg_from_capture_option', { defaultValue: 'from earlier capture' })}</option>
      </select>
      {sourceKind === 'capture' ? (
        <input className="wfd-inp" value={mapping.captureName ?? ''} onChange={e => onChange({ toolArgument: mapping.toolArgument, captureName: e.target.value })} placeholder={t('capture_name_placeholder', { defaultValue: 'captureName' }) as string} />
      ) : (
        <FieldRefSelect
          value={mapping.ticketField && mapping.ticketField.includes('.') ? mapping.ticketField : `ticket.${mapping.ticketField || 'title'}`}
          onChange={v => onChange({ toolArgument: mapping.toolArgument, ticketField: v })}
          ticketFieldOpts={ticketFieldOpts}
          workflowFieldKeys={workflowFieldKeys}
        />
      )}
      <button className="ale-rm-btn" onClick={onRemove}><X size={11} /></button>
    </div>
  );
}

function CallRow({
  call, index, onChange, onRemove, ticketFieldKeys, workflowFieldKeys,
}: {
  call: McpCall;
  index: number;
  onChange: (updated: McpCall) => void;
  onRemove: () => void;
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: call.id });
  const [expanded, setExpanded] = useState(index === 0);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const upd = (patch: Partial<McpCall>) => onChange({ ...call, ...patch });

  const addArg = () => upd({ argumentMappings: [...call.argumentMappings, { toolArgument: '', ticketField: '' }] });
  const updArg = (i: number, m: McpArgumentMapping) => upd({ argumentMappings: call.argumentMappings.map((a, idx) => idx === i ? m : a) });
  const rmArg = (i: number) => upd({ argumentMappings: call.argumentMappings.filter((_, idx) => idx !== i) });

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
              <button className="wfd-add-flow-btn" onClick={addArg}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
            </div>
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
  calls, onChange, ticketFieldKeys, workflowFieldKeys,
}: {
  calls: McpCall[];
  onChange: (calls: McpCall[]) => void;
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
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
                ticketFieldKeys={ticketFieldKeys} workflowFieldKeys={workflowFieldKeys}
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
  mappings, onChange, captureNames, ticketFieldKeys, workflowFieldKeys,
}: {
  mappings: McpResponseMapping[];
  onChange: (m: McpResponseMapping[]) => void;
  captureNames: string[];
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
}) => {
  const { t } = useTranslation();
  const ticketFieldOpts = [...TICKET_FIELD_BASE, ...ticketFieldKeys.filter(k => !TICKET_FIELD_BASE.includes(k))];
  const add = () => onChange([...mappings, { captureName: captureNames[0] ?? '', target: `ticket.${ticketFieldOpts[0] ?? 'title'}` }]);
  const upd = (i: number, patch: Partial<McpResponseMapping>) => onChange(mappings.map((m, idx) => idx === i ? { ...m, ...patch } : m));
  const rm = (i: number) => onChange(mappings.filter((_, idx) => idx !== i));

  return (
    <div className="wfd-sec">
      <div className="wfd-sec-row">
        <div className="wfd-sec-lbl"><ArrowUpFromLine size={9} /> {t('response_data_mapping_label', { defaultValue: 'RESPONSE DATA (captures → fields)' })}</div>
        <button className="wfd-add-flow-btn" onClick={add}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
      </div>
      {mappings.length === 0 && <p className="wfd-empty-txt">{t('response_mapping_empty', { defaultValue: 'No captured values are saved anywhere yet' })}</p>}
      {mappings.map((m, i) => (
        <div key={i} className="eae-kv-row">
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
