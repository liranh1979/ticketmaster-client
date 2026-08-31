import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, GripVertical, Lock, Unlock, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Play } from 'lucide-react';
import {
  DndContext, closestCenter,
  PointerSensor, useSensors, useSensor,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../../../api';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExternalApiHeader { key: string; valueTemplate: string; }
export interface ExternalApiCapture {
  name: string;
  // Absent/undefined behaves exactly as 'jsonpath' — every already-saved capture predates this
  // field and must keep resolving identically. 'llm' captures the admin's own plain-language
  // instruction instead of a path — the backend calls the currently-active AI provider live, per
  // field, at both "Verify Captures"/"Test this call now" and real ticket-execution time.
  mode?: 'jsonpath' | 'llm';
  jsonPath?: string;
  llmInstruction?: string;
}

export interface ExternalApiAuth {
  type: 'none' | 'bearer' | 'api_key' | 'basic';
  // api_key only — where the key gets placed. Defaults to 'header' (undefined == 'header', for
  // backward compat with every entry saved before this existed). Some real APIs (e.g. SerpAPI)
  // require the key as a query parameter, not a header — without this, the only way to
  // authenticate one of those was a this.<key> request-mapping placeholder with no admin-facing
  // UI anywhere to ever fill in a value, or hardcoding the real secret in plaintext in the URL.
  location?: 'header' | 'query';
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
              <option value="api_key">{t('auth_api_key_header_option', { defaultValue: 'API key' })}</option>
              <option value="basic">{t('auth_basic_option', { defaultValue: 'Basic (username/password)' })}</option>
            </select>
            {call.auth.type === 'bearer' && (
              <SecretInput label={t('secret_token_label', { defaultValue: 'Token' })} hasValue={call.auth.hasToken} value={call.auth.token} onChange={v => updAuth({ token: v })} />
            )}
            {call.auth.type === 'api_key' && (
              <>
                <select
                  className="wfd-sel"
                  value={call.auth.location ?? 'header'}
                  onChange={e => updAuth({ location: e.target.value as 'header' | 'query' })}
                >
                  <option value="header">{t('auth_api_key_location_header_option', { defaultValue: 'Send as header' })}</option>
                  <option value="query">{t('auth_api_key_location_query_option', { defaultValue: 'Send as query parameter' })}</option>
                </select>
                <input
                  className="wfd-inp"
                  value={call.auth.headerName ?? ''}
                  onChange={e => updAuth({ headerName: e.target.value })}
                  placeholder={
                    (call.auth.location === 'query'
                      ? t('eae_query_param_name_placeholder', { defaultValue: 'Parameter name (default api_key)' })
                      : t('eae_header_name_placeholder', { defaultValue: 'Header name (default X-API-Key)' })) as string
                  }
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
          <ResponseCapturesEditor call={call} onChange={onChange} />
        </div>
      )}
    </div>
  );
}

// ── Response captures editor ──────────────────────────────────────────────
// Extracted out of CallRow so the exact same "select a field, choose JSONPath or write an AI
// instruction" UI can also be rendered directly in Step 5 ("Response Mapping") — a real admin
// complaint found live: this used to live ONLY inside Step 3's per-call editor (buried below
// Auth/Headers/Body), so an admin landing on the step literally named "Response Mapping" had no
// way to see or define a capture there at all, even though that's exactly where they expect to
// find "select a field, tell the AI what to look for."
export const ResponseCapturesEditor = ({
  call, onChange,
}: {
  call: ExternalApiCall;
  onChange: (updated: ExternalApiCall) => void;
}) => {
  const { t } = useTranslation();
  const addCapture = () => onChange({ ...call, responseCaptures: [...call.responseCaptures, { name: '', mode: 'jsonpath', jsonPath: '$.' }] });
  const updCapture = (i: number, patch: Partial<ExternalApiCapture>) =>
    onChange({ ...call, responseCaptures: call.responseCaptures.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  const rmCapture = (i: number) => onChange({ ...call, responseCaptures: call.responseCaptures.filter((_, idx) => idx !== i) });

  return (
    <div className="eae-subsec">
      <div className="eae-subsec-row">
        <div className="eae-subsec-lbl">{t('response_captures_label', { defaultValue: 'RESPONSE CAPTURES' })}</div>
        <button className="wfd-add-flow-btn" onClick={addCapture}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
      </div>
      {call.responseCaptures.length === 0 && (
        <p className="wfd-empty-txt">{t('eae_no_response_captures_empty', { defaultValue: "No values captured from this call's response yet" })}</p>
      )}
      {call.responseCaptures.map((c, i) => {
        const mode = c.mode ?? 'jsonpath';
        return (
          <div key={i} className="eae-capture-block">
            <div className="eae-kv-row">
              <input className="wfd-inp" value={c.name} onChange={e => updCapture(i, { name: e.target.value })} placeholder={t('capture_name_placeholder', { defaultValue: 'captureName' }) as string} />
              <select
                className="wfd-sel"
                value={mode}
                onChange={e => {
                  const newMode = e.target.value as 'jsonpath' | 'llm';
                  updCapture(i, newMode === 'llm'
                    ? { mode: 'llm', jsonPath: undefined }
                    : { mode: 'jsonpath', llmInstruction: undefined, jsonPath: c.jsonPath ?? '$.' });
                }}
              >
                <option value="jsonpath">{t('capture_mode_jsonpath', { defaultValue: 'JSONPath' })}</option>
                <option value="llm">{t('capture_mode_llm', { defaultValue: 'AI: describe what to extract' })}</option>
              </select>
              {mode === 'jsonpath' && (
                <input className="wfd-inp" value={c.jsonPath ?? ''} onChange={e => updCapture(i, { jsonPath: e.target.value })} placeholder={t('json_path_placeholder', { defaultValue: '$.data.id' }) as string} />
              )}
              <button className="ale-rm-btn" onClick={() => rmCapture(i)}><X size={11} /></button>
            </div>
            {mode === 'llm' && (
              <textarea
                className="wfd-inp eae-textarea-sm"
                value={c.llmInstruction ?? ''}
                onChange={e => updCapture(i, { llmInstruction: e.target.value })}
                placeholder={t('capture_llm_instruction_placeholder', { defaultValue: "e.g. the cheapest flight's total price" }) as string}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

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

// Shared across every FieldRefSelect instance (there can be many — one per argument-mapping row)
// so N rows on screen cost one network round-trip pair, not N. A real gap found live: this picker
// showed raw field_definitions keys ("this.rooms", "this.radius") as its option text instead of
// the admin-configured display label — readable enough for a snake_case English key, but wrong in
// general and inconsistent with every other field picker in this app (e.g.
// SimpleItemFieldsEditor's own catalog picker already shows labels, not keys).
let fieldLabelsPromise: Promise<{ ticket: Record<string, string>; workflow: Record<string, string> }> | null = null;
function fetchFieldLabelsOnce() {
  if (!fieldLabelsPromise) {
    fieldLabelsPromise = Promise.all([
      api.get('/field-definitions/translations/en', { params: { translationType: 'ticket_fields' } }),
      api.get('/field-definitions/translations/en', { params: { translationType: 'workflow_fields' } }),
    ]).then(([t, w]) => ({ ticket: t.data as Record<string, string>, workflow: w.data as Record<string, string> }))
      .catch(() => ({ ticket: {}, workflow: {} }));
  }
  return fieldLabelsPromise;
}

// Shared by both the request source picker and the response target picker — "ticket.<field>" (this
// template's ticket fields) or "this.<field>" (this action item's own data, sourced from Workflow
// Fields Manager's field_definitions catalog — see SimpleItemFieldsEditor for the same catalog used
// by Simple items' mini-fields). Renders as a plain <select> with two optgroups.
export const FieldRefSelect = ({
  value, onChange, ticketFieldOpts, workflowFieldKeys, allowEmpty,
}: {
  value: string;
  onChange: (v: string) => void;
  ticketFieldOpts: string[];
  workflowFieldKeys: string[];
  // Real bug found live: an argument row with no real mapping yet used to get silently defaulted
  // to "ticket.title" just so the <select> never looked "empty" — which made a genuinely unmapped
  // MCP tool argument LOOK like a deliberate (if wrong) choice instead of an obvious gap needing
  // attention. Opt-in (existing callers keep always passing a real non-empty value, so this never
  // renders for them) — an actual, selectable "— not mapped —" option instead of a fake default.
  allowEmpty?: boolean;
}) => {
  const { t } = useTranslation();
  const [labels, setLabels] = useState<{ ticket: Record<string, string>; workflow: Record<string, string> }>({ ticket: {}, workflow: {} });
  useEffect(() => { fetchFieldLabelsOnce().then(setLabels); }, []);
  // A draft can reference "this.<key>" for a key the AI just suggested creating (see
  // WorkflowFieldSuggestions.tsx) before the admin has actually created it — without this, the
  // <select> would have no matching <option> for its own value and silently look unselected.
  const pendingKey = value.startsWith('this.') && value.length > 5 && !workflowFieldKeys.includes(value.slice(5))
    ? value.slice(5) : null;
  return (
    <select className="wfd-sel" value={value} onChange={e => onChange(e.target.value)}>
      {allowEmpty && <option value="">{t('field_ref_not_mapped_option', { defaultValue: '— not mapped —' })}</option>}
      <optgroup label={t('eae_ticket_fields_optgroup', { defaultValue: 'Ticket Fields' }) as string}>
        {ticketFieldOpts.map(k => <option key={k} value={`ticket.${k}`}>{labels.ticket[k] ?? k}</option>)}
      </optgroup>
      <optgroup label={t('eae_workflow_fields_optgroup', { defaultValue: 'Workflow Fields' }) as string}>
        {workflowFieldKeys.length === 0 && !pendingKey && <option value="" disabled>{t('eae_workflow_fields_none', { defaultValue: '(none defined yet)' })}</option>}
        {pendingKey && (
          <option value={value} className="eae-pending-field-opt">
            {t('eae_pending_field_option', { defaultValue: 'this.{{key}} (pending — create it below)', key: pendingKey })}
          </option>
        )}
        {workflowFieldKeys.map(k => <option key={k} value={`this.${k}`}>{labels.workflow[k] ?? k}</option>)}
      </optgroup>
    </select>
  );
};

// Real bug found live (FEAT-06/FEAT-19): nothing stopped an admin (or the AI auto-mapper) from
// mapping several response captures to the identical target field — applyTarget/applyNodelistTarget
// in ExternalApiActionExecutor/McpActionExecutor overwrite on every non-nodelist target, so only the
// last-applied mapping's value survives; the others are silently discarded with no error anywhere.
// A "nodelist" target is the one case this is actually fine (append, not overwrite) — this hook
// tells the response-mapping editors which targets are nodelist-typed so they only warn on real
// collisions. Shared (not duplicated) since ExternalApiFieldMappingsEditor and
// McpResponseMappingsEditor hit the exact same target grammar and the exact same bug.
export function useNodelistTargets(): Set<string> {
  const [nodelist, setNodelist] = useState<Set<string>>(new Set());
  useEffect(() => {
    Promise.all([
      api.get('/field-definitions', { params: { entityType: 'ticket' } }),
      api.get('/field-definitions', { params: { entityType: 'workflow' } }),
    ]).then(([ticketRes, workflowRes]) => {
      const s = new Set<string>();
      (ticketRes.data as { fieldKey: string; fieldType: string }[]).forEach(f => {
        if (f.fieldType === 'nodelist') s.add(`ticket.${f.fieldKey}`);
      });
      (workflowRes.data as { fieldKey: string; fieldType: string }[]).forEach(f => {
        if (f.fieldType === 'nodelist') s.add(`this.${f.fieldKey}`);
      });
      setNodelist(s);
    }).catch(() => {});
  }, []);
  return nodelist;
}

/** Targets mapped by 2+ response mappings that AREN'T nodelist — each one after the first silently overwrites the last (see useNodelistTargets javadoc). */
export function findCollidingTargets(mappings: { target: string }[], nodelistTargets: Set<string>): Set<string> {
  const counts = new Map<string, number>();
  for (const m of mappings) {
    if (!m.target) continue;
    counts.set(m.target, (counts.get(m.target) ?? 0) + 1);
  }
  const colliding = new Set<string>();
  for (const [target, count] of counts) {
    if (count > 1 && !nodelistTargets.has(target)) colliding.add(target);
  }
  return colliding;
}

export const ExternalApiFieldMappingsEditor = ({
  mappings, onChange, ticketFieldKeys, workflowFieldKeys, captureNames, showRequest = true, showResponse = true,
  onTestClick,
}: {
  mappings: ExternalApiFieldMappings;
  onChange: (m: ExternalApiFieldMappings) => void;
  ticketFieldKeys: string[];
  workflowFieldKeys: string[];
  captureNames: string[];
  // Field Mapping step only needs the request half (nothing's been captured yet); Response
  // Mapping step only needs the response half (request mapping was already finished in an earlier
  // step — re-showing it there is confusing clutter, a real complaint from live use). Review &
  // Save shows both (the defaults) for a final full look.
  showRequest?: boolean;
  showResponse?: boolean;
  // Real gap found live: the Workflow Designer's only entry point into "Test this call now" (and
  // from there, "Map Response Fields") was a small button up in the API CALLS section header —
  // nothing near THIS section connected the two, so an admin looking at RESPONSE DATA for a way to
  // test/map it found nothing. Optional (the guided AI Workflow Builder wizard has its own
  // dedicated Test step already and doesn't need this) — only the Designer passes it.
  onTestClick?: () => void;
}) => {
  const { t } = useTranslation();
  const ticketFieldOpts = [...TICKET_FIELD_BASE, ...ticketFieldKeys.filter(k => !TICKET_FIELD_BASE.includes(k))];
  const nodelistTargets = useNodelistTargets();
  const collidingTargets = findCollidingTargets(mappings.response, nodelistTargets);

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
      {showRequest && (
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
      )}

      {showResponse && (
        <div className="wfd-sec">
          <div className="wfd-sec-row">
            <div className="wfd-sec-lbl"><ArrowUpFromLine size={9} /> {t('response_data_mapping_label', { defaultValue: 'RESPONSE DATA (captures → fields)' })}</div>
            <div className="wfd-sec-row-btns">
              {onTestClick && (
                <button className="wfd-add-flow-btn" onClick={onTestClick}>
                  <Play size={10} /> {t('response_mapping_test_map_btn', { defaultValue: 'Test & Map with AI' })}
                </button>
              )}
              <button className="wfd-add-flow-btn" onClick={addResp}><Plus size={10} /> {t('add_btn', { defaultValue: 'Add' })}</button>
            </div>
          </div>
          {mappings.response.length === 0 && <p className="wfd-empty-txt">{t('response_mapping_empty', { defaultValue: 'No captured values are saved anywhere yet' })}</p>}
          {collidingTargets.size > 0 && (
            <p className="mte-error">
              <AlertTriangle size={11} />{' '}
              {t('response_mapping_collision_hint', {
                defaultValue: 'Multiple captures are mapped to the same field — only the last one applied will actually be saved: {{targets}}',
                targets: [...collidingTargets].join(', '),
              })}
            </p>
          )}
          {mappings.response.map((r, i) => (
            <div key={i} className={`eae-kv-row${r.target && collidingTargets.has(r.target) ? ' eae-kv-row-warn' : ''}`}>
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
      )}
    </>
  );
};
