import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, GripVertical, Lock, Unlock, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExternalApiHeader { key: string; valueTemplate: string; }
export interface ExternalApiCapture { name: string; jsonPath: string; }

export interface ExternalApiAuth {
  type: 'none' | 'bearer' | 'api_key' | 'basic';
  headerName?: string;
  // Server-computed, read-only — never carries the actual secret.
  hasToken?: boolean;
  hasUsername?: boolean;
  hasPassword?: boolean;
  // Write-only — only present in state when the admin is actively setting/clearing a secret this
  // session. Omitting the key entirely (not just leaving it blank) is what tells the backend
  // "unchanged, carry the existing encrypted value forward" — see TemplateService.carryForwardWorkflowSecrets.
  token?: string;
  username?: string;
  password?: string;
}

export interface ExternalApiCall {
  id: string;
  order: number;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  urlTemplate: string;
  headers: ExternalApiHeader[];
  auth: ExternalApiAuth;
  bodyTemplate: string;
  responseCaptures: ExternalApiCapture[];
}

export function makeDefaultCall(order: number): ExternalApiCall {
  return {
    id: crypto.randomUUID(),
    order,
    name: `call_${order + 1}`,
    method: 'POST',
    urlTemplate: '',
    headers: [],
    auth: { type: 'none' },
    bodyTemplate: '',
    responseCaptures: [],
  };
}

const METHODS: ExternalApiCall['method'][] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

// ── Secret input (masked, set/clear affordance) ──────────────────────────────

export function SecretInput({
  label, hasValue, value, onChange,
}: {
  label: string;
  hasValue?: boolean;
  value: string | undefined;
  onChange: (v: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const editing = value !== undefined;
  if (!editing && hasValue) {
    return (
      <div className="eae-secret-row">
        <span className="eae-secret-set"><Lock size={10} /> {t('secret_configured_text', { defaultValue: '{{label}} configured', label })}</span>
        <button className="eae-secret-change" onClick={() => onChange('')}>{t('change_btn', { defaultValue: 'Change' })}</button>
      </div>
    );
  }
  return (
    <div className="eae-secret-row">
      <input
        className="wfd-inp"
        type="password"
        placeholder={t('secret_input_placeholder', { defaultValue: '{{label}}…', label }) as string}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        autoFocus={editing}
      />
      {hasValue && (
        <button className="eae-secret-cancel" title={t('keep_existing_title', { defaultValue: 'Keep existing' }) as string} onClick={() => onChange(undefined)}>
          <Unlock size={11} />
        </button>
      )}
    </div>
  );
}

// ── Call row ──────────────────────────────────────────────────────────────

function CallRow({
  call, index, onChange, onRemove,
}: {
  call: ExternalApiCall;
  index: number;
  onChange: (updated: ExternalApiCall) => void;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: call.id });
  const [expanded, setExpanded] = useState(index === 0);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const upd = (patch: Partial<ExternalApiCall>) => onChange({ ...call, ...patch });
  const updAuth = (patch: Partial<ExternalApiAuth>) => onChange({ ...call, auth: { ...call.auth, ...patch } });

  const addHeader = () => upd({ headers: [...call.headers, { key: '', valueTemplate: '' }] });
  const updHeader = (i: number, patch: Partial<ExternalApiHeader>) =>
    upd({ headers: call.headers.map((h, idx) => idx === i ? { ...h, ...patch } : h) });
  const rmHeader = (i: number) => upd({ headers: call.headers.filter((_, idx) => idx !== i) });

  const addCapture = () => upd({ responseCaptures: [...call.responseCaptures, { name: '', jsonPath: '$.' }] });
  const updCapture = (i: number, patch: Partial<ExternalApiCapture>) =>
    upd({ responseCaptures: call.responseCaptures.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const rmCapture = (i: number) => upd({ responseCaptures: call.responseCaptures.filter((_, idx) => idx !== i) });

  return (
    <div ref={setNodeRef} style={style} className="eae-call">
      <div className="eae-call-top">
        <span className="eae-grip" {...attributes} {...listeners}><GripVertical size={13} /></span>
        <span className="eae-call-order">#{index + 1}</span>
        <input
          className="wfd-inp eae-call-name"
          value={call.name}
          onChange={e => upd({ name: e.target.value })}
          placeholder={t('eae_call_name_placeholder', { defaultValue: 'call name (used as {{captureName}} namespace)' }) as string}
        />
        <button className="eae-toggle-btn" onClick={() => setExpanded(v => !v)}>{expanded ? '▾' : '▸'}</button>
        <button className="ale-rm-btn" onClick={onRemove}><X size={12} /></button>
      </div>

      {expanded && (
        <div className="eae-call-body">
          <div className="eae-method-url-row">
            <select className="wfd-sel eae-method-sel" value={call.method} onChange={e => upd({ method: e.target.value as ExternalApiCall['method'] })}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <input
              className="wfd-inp"
              value={call.urlTemplate}
              onChange={e => upd({ urlTemplate: e.target.value })}
              placeholder={t('eae_url_template_placeholder', { defaultValue: 'https://api.example.com/users/{{employeeId}}' }) as string}
            />
          </div>

          {/* Auth */}
          <div className="eae-subsec">
            <div className="eae-subsec-lbl">{t('auth_section_label', { defaultValue: 'AUTH' })}</div>
            <select className="wfd-sel" value={call.auth.type} onChange={e => updAuth({ type: e.target.value as ExternalApiAuth['type'] })}>
              <option value="none">{t('auth_none_option', { defaultValue: 'None' })}</option>
              <option value="bearer">{t('auth_bearer_token_option', { defaultValue: 'Bearer token' })}</option>
              <option value="api_key">{t('auth_api_key_header_option', { defaultValue: 'API key header' })}</option>
              <option value="basic">{t('auth_basic_option', { defaultValue: 'Basic (username/password)' })}</option>
            </select>
            {call.auth.type === 'bearer' && (
              <SecretInput label={t('secret_token_label', { defaultValue: 'Token' })} hasValue={call.auth.hasToken} value={call.auth.token} onChange={v => updAuth({ token: v })} />
            )}
            {call.auth.type === 'api_key' && (
              <>
                <input
                  className="wfd-inp"
                  value={call.auth.headerName ?? ''}
                  onChange={e => updAuth({ headerName: e.target.value })}
                  placeholder={t('eae_header_name_placeholder', { defaultValue: 'Header name (default X-API-Key)' }) as string}
                />
                <SecretInput label={t('secret_api_key_label', { defaultValue: 'API key' })} hasValue={call.auth.hasToken} value={call.auth.token} onChange={v => updAuth({ token: v })} />
              </>
            )}
            {call.auth.type === 'basic' && (
              <>
                <SecretInput label={t('secret_username_label', { defaultValue: 'Username' })} hasValue={call.auth.hasUsername} value={call.auth.username} onChange={v => updAuth({ username: v })} />
                <SecretInput label={t('secret_password_label', { defaultValue: 'Password' })} hasValue={call.auth.hasPassword} value={call.auth.password} onChange={v => updAuth({ password: v })} />
              </>
            )}
          </div>

          {/* Headers */}
          <div className="eae-subsec">
            <div className="eae-subsec-row">
              <div className="eae-subsec-lbl">{t('headers_section_label', { defaultValue: 'HEADERS' })}</div>
              <button className="wfd-add-flow-btn" onClick={addHeader}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
            </div>
            {call.headers.map((h, i) => (
              <div key={i} className="eae-kv-row">
                <input className="wfd-inp" value={h.key} onChange={e => updHeader(i, { key: e.target.value })} placeholder={t('eae_header_key_placeholder', { defaultValue: 'Header-Name' }) as string} />
                <input className="wfd-inp" value={h.valueTemplate} onChange={e => updHeader(i, { valueTemplate: e.target.value })} placeholder={t('eae_header_value_placeholder', { defaultValue: 'value or {{placeholder}}' }) as string} />
                <button className="ale-rm-btn" onClick={() => rmHeader(i)}><X size={11} /></button>
              </div>
            ))}
          </div>

          {/* Body */}
          <div className="eae-subsec">
            <div className="eae-subsec-lbl">{t('body_template_label', { defaultValue: 'BODY TEMPLATE' })}</div>
            <textarea
              className="wfd-inp eae-textarea"
              value={call.bodyTemplate}
              onChange={e => upd({ bodyTemplate: e.target.value })}
              placeholder={t('eae_body_template_placeholder', { defaultValue: '{"name": "{{employeeName}}", "email": "{{employeeEmail}}"}' }) as string}
            />
          </div>

          {/* Response captures */}
          <div className="eae-subsec">
            <div className="eae-subsec-row">
              <div className="eae-subsec-lbl">{t('response_captures_label', { defaultValue: 'RESPONSE CAPTURES' })}</div>
              <button className="wfd-add-flow-btn" onClick={addCapture}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
            </div>
            {call.responseCaptures.length === 0 && (
              <p className="wfd-empty-txt">{t('eae_no_response_captures_empty', { defaultValue: "No values captured from this call's response yet" })}</p>
            )}
            {call.responseCaptures.map((c, i) => (
              <div key={i} className="eae-kv-row">
                <input className="wfd-inp" value={c.name} onChange={e => updCapture(i, { name: e.target.value })} placeholder={t('capture_name_placeholder', { defaultValue: 'captureName' }) as string} />
                <input className="wfd-inp" value={c.jsonPath} onChange={e => updCapture(i, { jsonPath: e.target.value })} placeholder={t('json_path_placeholder', { defaultValue: '$.data.id' }) as string} />
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

export const ExternalApiCallsEditor = ({
  calls, onChange,
}: {
  calls: ExternalApiCall[];
  onChange: (calls: ExternalApiCall[]) => void;
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

  const updateCall = (i: number, updated: ExternalApiCall) => onChange(calls.map((c, idx) => idx === i ? updated : c));
  const removeCall = (i: number) => onChange(calls.filter((_, idx) => idx !== i).map((c, idx) => ({ ...c, order: idx })));
  const addCall = () => onChange([...calls, makeDefaultCall(calls.length)]);

  return (
    <div className="ale-wrap">
      {calls.length === 0 ? (
        <p className="wfd-empty-txt">{t('eae_calls_empty', { defaultValue: 'No API calls configured yet — add one to define what this item does.' })}</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={calls.map(c => c.id)} strategy={verticalListSortingStrategy}>
            {calls.map((call, i) => (
              <CallRow key={call.id} call={call} index={i} onChange={updated => updateCall(i, updated)} onRemove={() => removeCall(i)} />
            ))}
          </SortableContext>
        </DndContext>
      )}
      <button className="wfd-add-flow-btn ale-add-btn" onClick={addCall}><Plus size={10} /> {t('eae_add_call_btn', { defaultValue: 'Add call' })}</button>
    </div>
  );
};

// ── Field mappings editor ─────────────────────────────────────────────────

export interface FieldMappingRequest { placeholder: string; ticketField: string; }
export interface FieldMappingResponse { captureName: string; target: string; }
export interface ExternalApiFieldMappings {
  request: FieldMappingRequest[];
  response: FieldMappingResponse[];
}

export const TICKET_FIELD_BASE = ['title', 'description', 'status', 'priority'];

// Shared by both the request source picker and the response target picker — "ticket.<field>" (this
// template's ticket fields) or "this.<field>" (this action item's own data, sourced from Workflow
// Fields Manager's field_definitions catalog — see SimpleItemFieldsEditor for the same catalog used
// by Simple items' mini-fields). Renders as a plain <select> with two optgroups.
export const FieldRefSelect = ({
  value, onChange, ticketFieldOpts, workflowFieldKeys,
}: {
  value: string;
  onChange: (v: string) => void;
  ticketFieldOpts: string[];
  workflowFieldKeys: string[];
}) => {
  const { t } = useTranslation();
  return (
    <select className="wfd-sel" value={value} onChange={e => onChange(e.target.value)}>
      <optgroup label={t('eae_ticket_fields_optgroup', { defaultValue: 'Ticket Fields' }) as string}>
        {ticketFieldOpts.map(k => <option key={k} value={`ticket.${k}`}>ticket.{k}</option>)}
      </optgroup>
      <optgroup label={t('eae_workflow_fields_optgroup', { defaultValue: 'Workflow Fields' }) as string}>
        {workflowFieldKeys.length === 0 && <option value="" disabled>{t('eae_workflow_fields_none', { defaultValue: '(none defined yet)' })}</option>}
        {workflowFieldKeys.map(k => <option key={k} value={`this.${k}`}>this.{k}</option>)}
      </optgroup>
    </select>
  );
};

export const ExternalApiFieldMappingsEditor = ({
  mappings, onChange, ticketFieldKeys, workflowFieldKeys, captureNames,
}: {
  mappings: ExternalApiFieldMappings;
  onChange: (m: ExternalApiFieldMappings) => void;
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
  captureNames: string[];
}) => {
  const { t } = useTranslation();
  const ticketFieldOpts = [...TICKET_FIELD_BASE, ...ticketFieldKeys.filter(k => !TICKET_FIELD_BASE.includes(k))];

  const addReq = () => onChange({ ...mappings, request: [...mappings.request, { placeholder: '', ticketField: `ticket.${ticketFieldOpts[0] ?? 'title'}` }] });
  const updReq = (i: number, patch: Partial<FieldMappingRequest>) =>
    onChange({ ...mappings, request: mappings.request.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
  const rmReq = (i: number) => onChange({ ...mappings, request: mappings.request.filter((_, idx) => idx !== i) });

  const addResp = () => onChange({ ...mappings, response: [...mappings.response, { captureName: captureNames[0] ?? '', target: 'ticket.' }] });
  const updResp = (i: number, patch: Partial<FieldMappingResponse>) =>
    onChange({ ...mappings, response: mappings.response.map((r, idx) => idx === i ? { ...r, ...patch } : r) });
  const rmResp = (i: number) => onChange({ ...mappings, response: mappings.response.filter((_, idx) => idx !== i) });

  return (
    <>
      <div className="wfd-sec">
        <div className="wfd-sec-row">
          <div className="wfd-sec-lbl"><ArrowDownToLine size={9} /> {t('eae_request_data_label', { defaultValue: 'REQUEST DATA (ticket → placeholders)' })}</div>
          <button className="wfd-add-flow-btn" onClick={addReq}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
        </div>
        {mappings.request.length === 0 && <p className="wfd-empty-txt">{t('eae_request_mapping_empty', { defaultValue: 'No ticket fields wired in yet — calls will only see literal text' })}</p>}
        {mappings.request.map((r, i) => (
          <div key={i} className="eae-kv-row">
            <FieldRefSelect
              value={r.ticketField.includes('.') ? r.ticketField : `ticket.${r.ticketField}`}
              onChange={v => updReq(i, { ticketField: v })}
              ticketFieldOpts={ticketFieldOpts}
              workflowFieldKeys={workflowFieldKeys}
            />
            <span className="eae-arrow">→</span>
            <input className="wfd-inp" value={r.placeholder} onChange={e => updReq(i, { placeholder: e.target.value })} placeholder={t('placeholder_input_placeholder', { defaultValue: '{{placeholder}}' }) as string} />
            <button className="ale-rm-btn" onClick={() => rmReq(i)}><X size={11} /></button>
          </div>
        ))}
      </div>

      <div className="wfd-sec">
        <div className="wfd-sec-row">
          <div className="wfd-sec-lbl"><ArrowUpFromLine size={9} /> {t('response_data_mapping_label', { defaultValue: 'RESPONSE DATA (captures → fields)' })}</div>
          <button className="wfd-add-flow-btn" onClick={addResp}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
        </div>
        {mappings.response.length === 0 && <p className="wfd-empty-txt">{t('response_mapping_empty', { defaultValue: 'No captured values are saved anywhere yet' })}</p>}
        {mappings.response.map((r, i) => (
          <div key={i} className="eae-kv-row">
            <input className="wfd-inp" value={r.captureName} onChange={e => updResp(i, { captureName: e.target.value })} placeholder={t('capture_name_placeholder', { defaultValue: 'captureName' }) as string} list="eae-capture-names" />
            <span className="eae-arrow">→</span>
            <FieldRefSelect
              value={r.target || `ticket.${ticketFieldOpts[0] ?? 'title'}`}
              onChange={v => updResp(i, { target: v })}
              ticketFieldOpts={ticketFieldOpts}
              workflowFieldKeys={workflowFieldKeys}
            />
            <button className="ale-rm-btn" onClick={() => rmResp(i)}><X size={11} /></button>
          </div>
        ))}
        <datalist id="eae-capture-names">
          {captureNames.map(n => <option key={n} value={n} />)}
        </datalist>
      </div>
    </>
  );
};
