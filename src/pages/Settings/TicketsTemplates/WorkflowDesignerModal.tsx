import { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Plus, GitBranch, Trash2, Database, ArrowRight, Lock, ShieldCheck, Globe2, Plug, Play, LibraryBig, ClipboardList, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import api from '../../../api';
import { UserPickerControl } from '../../../components/UserPickerControl/UserPickerControl';
import { ApprovalLevelsEditor, makeDefaultLevel, type ApprovalLevel } from './ApprovalLevelsEditor';
import { SimpleItemFieldsEditor, type SimpleItemField } from './SimpleItemFieldsEditor';
import {
  ExternalApiCallsEditor, ExternalApiFieldMappingsEditor,
  type ExternalApiCall, type ExternalApiFieldMappings,
} from './ExternalApiCallsEditor';
import {
  McpServerConnectionEditor, McpToolPicker, McpToolCallsEditor, McpResponseMappingsEditor,
  makeDefaultCall as makeDefaultMcpCall,
  type McpCall, type McpAuth, type McpResponseMapping,
} from './McpToolCallsEditor';
import { TestActionModal, type AutoMapProposal } from './TestActionModal';
import { mergeCapturesById } from './AiWorkflowBuilderPage';
import './WorkflowDesignerModal.css';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataFlow {
  id: string;
  direction: 'pull' | 'push';
  source: string;
  target: string;
}

// 'task' (default, today's plain checklist behavior) is the only type with an Inspector UI so far —
// 'approval'/'external_api'/'mcp_tool' round-trip through save/load from here on (backend now
// persists them, see WorkflowService.seedWorkflowItems) but their own Inspector sections and
// type-selector UI debut in the phases that give them real functionality, not before.
export type WorkflowNodeType = 'task' | 'approval' | 'external_api' | 'mcp_tool';

export interface WorkflowNodeDef {
  id: string;
  title: string;
  type?: WorkflowNodeType;
  typeConfig?: Record<string, unknown>;
  // Only meaningful when this node's parent is an 'approval' node — see WorkflowService.activateChildren.
  activationCondition?: 'approved' | 'rejected';
  parentId: string | null;
  displayOrder: number;
  defaultAssigneeUserId: number | null;
  customFieldKeys: string[];
  dataFlows: DataFlow[];
  x?: number;
  y?: number;
}

export interface WorkflowFieldConfig {
  nodes: WorkflowNodeDef[];
}

// A reusable, cross-template action item — see ActionItemLibraryPage.tsx / AiWorkflowBuilderPage.tsx.
// "Add from Library" copies name/type/typeConfig into a brand-new node; editing the node afterward
// never changes this catalog entry, and vice versa.
interface LibraryEntry {
  id: number;
  name: string;
  type: WorkflowNodeType;
  typeConfig: Record<string, unknown> | null;
  source: 'manual' | 'ai';
}

// ── Canvas constants ──────────────────────────────────────────────────────────

const NODE_W = 220;
const NODE_H = 92;       // approximate — used for connector anchor only
const CANVAS_W = 1700;
const CANVAS_H = 1100;
const TRIGGER_W = 248;
const TRIGGER_H = 54;
const TRIGGER_Y = 38;
const LEVEL_H = 160;
const GAP_X = 52;

// ── Auto-layout (BFS, symmetric) ─────────────────────────────────────────────

function autoLayout(nodes: WorkflowNodeDef[]): WorkflowNodeDef[] {
  if (!nodes.length) return nodes;

  const children: Record<string, string[]> = {};
  const roots: string[] = [];
  nodes.forEach(n => { children[n.id] = []; });
  nodes.forEach(n => {
    if (n.parentId && children[n.parentId]) children[n.parentId].push(n.id);
    else roots.push(n.id);
  });

  const levels: string[][] = [];
  let queue = [...roots];
  while (queue.length) {
    levels.push(queue);
    const next: string[] = [];
    queue.forEach(id => children[id]?.forEach(c => next.push(c)));
    queue = next;
  }

  const startY = TRIGGER_Y + TRIGGER_H + 72;
  const pos: Record<string, { x: number; y: number }> = {};
  levels.forEach((lv, li) => {
    const total = lv.length * NODE_W + (lv.length - 1) * GAP_X;
    const sx = (CANVAS_W - total) / 2;
    lv.forEach((id, i) => { pos[id] = { x: sx + i * (NODE_W + GAP_X), y: startY + li * LEVEL_H }; });
  });

  return nodes.map(n => ({ ...n, x: pos[n.id]?.x ?? (n.x ?? 100), y: pos[n.id]?.y ?? (n.y ?? 200) }));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type NMap = Record<string, WorkflowNodeDef & { x: number; y: number }>;

function nodeDepth(nodeId: string, nm: NMap): number {
  let d = 0;
  let cur = nm[nodeId];
  const seen = new Set<string>();
  while (cur?.parentId && !seen.has(cur.id)) { seen.add(cur.id); d++; cur = nm[cur.parentId]; }
  return d;
}

function descendants(nodeId: string, nodes: WorkflowNodeDef[]): Set<string> {
  const s = new Set<string>();
  const q = [nodeId];
  while (q.length) {
    const id = q.shift()!;
    nodes.filter(n => n.parentId === id).forEach(n => { if (!s.has(n.id)) { s.add(n.id); q.push(n.id); } });
  }
  return s;
}

// ── Data-flow option builder ──────────────────────────────────────────────────

const TICKET_BASE = [
  { k: 'title',       l: 'Title' },
  { k: 'description', l: 'Description' },
  { k: 'status',      l: 'Status' },
  { k: 'attachments', l: 'Attachments 📎' },
];

const ITEM_BASE = [
  { k: 'title',       l: 'title' },
  { k: 'status',      l: 'status' },
  { k: 'assignee',    l: 'assignee' },
  { k: 'attachments', l: 'attachments 📎' },
];

function buildOpts(curId: string, nodes: WorkflowNodeDef[], ticketKeys: string[]) {
  const cur = nodes.find(n => n.id === curId);

  const ticketOpts = [
    ...TICKET_BASE,
    ...ticketKeys.filter(k => !TICKET_BASE.find(b => b.k === k)).map(k => ({ k, l: k })),
  ].map(f => ({ v: `ticket.${f.k}`, l: f.l }));

  const thisOpts = [
    ...ITEM_BASE,
    ...(cur?.customFieldKeys ?? []).filter(k => !ITEM_BASE.find(b => b.k === k)).map(k => ({ k, l: k })),
  ].map(f => ({ v: `this.${f.k}`, l: f.l }));

  const otherOpts: { v: string; l: string; g: string }[] = nodes
    .filter(n => n.id !== curId)
    .flatMap(n => [
      { v: `${n.id}.title`,       l: `${n.title || 'Untitled'} → title`,            g: n.title || 'Untitled' },
      { v: `${n.id}.status`,      l: `${n.title || 'Untitled'} → status`,           g: n.title || 'Untitled' },
      { v: `${n.id}.attachments`, l: `${n.title || 'Untitled'} → attachments 📎`,   g: n.title || 'Untitled' },
      ...(n.customFieldKeys ?? []).map(k => ({
        v: `${n.id}.${k}`, l: `${n.title || 'Untitled'} → ${k}`, g: n.title || 'Untitled',
      })),
    ]);

  return { ticketOpts, thisOpts, otherOpts };
}

// ── Depth colors ──────────────────────────────────────────────────────────────

const COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#64748b'];
const dc = (d: number) => COLORS[Math.min(d, COLORS.length - 1)];

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  fieldLabel: string;
  fieldConfig: WorkflowFieldConfig;
  ticketFieldKeys?: string[];
  templateId?: number;
  onSave: (config: WorkflowFieldConfig) => void;
  onClose: () => void;
}

type FullNode = WorkflowNodeDef & { x: number; y: number };

export const WorkflowDesignerModal = ({
  fieldLabel,
  fieldConfig,
  ticketFieldKeys = [],
  templateId,
  onSave,
  onClose,
}: Props) => {
  const { t } = useTranslation();

  // ── State ────────────────────────────────────────────────────────────────

  const [nodes, setNodes] = useState<FullNode[]>(() => {
    const raw = (fieldConfig.nodes ?? []).map(n => ({
      ...n,
      x: (n as any).x ?? 0,
      y: (n as any).y ?? 0,
      customFieldKeys: n.customFieldKeys ?? [],
      dataFlows: (n.dataFlows ?? []).map((f: any) => ({
        ...f,
        id: f.id ?? crypto.randomUUID(),
      })) as DataFlow[],
    })) as FullNode[];
    const hasPos = fieldConfig.nodes.length > 0 && fieldConfig.nodes.every(n => 'x' in n && 'y' in n);
    return hasPos ? raw : autoLayout(raw) as FullNode[];
  });

  const [selId, setSelId] = useState<string | null>(null);
  const [mcpDiscoveredTools, setMcpDiscoveredTools] = useState<any[]>([]);
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [libraryEntries, setLibraryEntries] = useState<LibraryEntry[]>([]);
  const [libraryPickerOpen, setLibraryPickerOpen] = useState(false);
  const [workflowFieldKeys, setWorkflowFieldKeys] = useState<string[]>([]);
  // Typed catalogs (key+type) for "Map Response Fields" (see runAutoMap in TestActionModal) — a
  // real gap found live: this Designer usage of TestActionModal never opted into that feature at
  // all, so an mcp_tool/external_api node's response captures/mappings were stuck with whatever
  // was guessed at design time (against prose docs, or a schema with no real example) — a real API
  // ("mpc flight", SerpApi Google Flights-shaped) came back with array-nested departure/arrival
  // entries and no top-level "result" wrapper, nothing like the guess, so nothing ever captured.
  const [ticketFieldCatalog, setTicketFieldCatalog] = useState<{ key: string; type: string }[]>([]);
  const [workflowFieldCatalog, setWorkflowFieldCatalog] = useState<{ key: string; type: string }[]>([]);

  // Drag-to-move
  const [dragMove, setDragMove] = useState<{
    nodeId: string; startMX: number; startMY: number; origX: number; origY: number;
  } | null>(null);

  // Node Inspector width — a real usability gap found live: the panel's fixed 336px is nowhere
  // near enough once an MCP tool call's arguments/response-captures/response-mappings sections are
  // all populated — field values (ticket field refs, JSONPath captures) were unreadably truncated.
  // Persisted so an admin's preferred width survives closing/reopening the designer.
  const INSP_MIN_W = 336;
  const INSP_DEFAULT_WIDE_W = 640;
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const saved = Number(localStorage.getItem('wfd-insp-width'));
    return saved >= INSP_MIN_W ? saved : INSP_MIN_W;
  });
  const [resizeInsp, setResizeInsp] = useState<{ startMX: number; startWidth: number } | null>(null);
  const inspMaxWidth = () => Math.min(1100, Math.round(window.innerWidth * 0.7));

  // Drag-to-connect (port → parent)
  const [conn, setConn] = useState<{
    fromId: string; fromX: number; fromY: number; curX: number; curY: number;
  } | null>(null);
  const [hoverTgt, setHoverTgt] = useState<string | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);

  // ── Derived ──────────────────────────────────────────────────────────────

  const nm: NMap = Object.fromEntries(nodes.map(n => [n.id, n])) as NMap;
  const selNode = selId ? nm[selId] ?? null : null;
  const fieldOpts = selId ? buildOpts(selId, nodes, ticketFieldKeys) : null;

  // ── Escape key ───────────────────────────────────────────────────────────

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  useEffect(() => {
    // status=complete — a draft (still mid-wizard, no response mapping yet) would silently do
    // nothing useful if copied into a live template node, so this picker only ever offers finished
    // entries. Drafts remain visible in AiWorkflowBuilderPage's own list, where resuming happens.
    api.get('/action-item-library', { params: { status: 'complete' } }).then(r => setLibraryEntries(r.data)).catch(() => {});
    // Only custom (non-system) workflow fields — see AiWorkflowBuilderPage's identical fetch for why.
    api.get('/field-definitions', { params: { entityType: 'workflow' } })
      .then(r => {
        const custom = r.data.filter((f: any) => !f.isSystem);
        setWorkflowFieldKeys(custom.map((f: any) => f.fieldKey));
        setWorkflowFieldCatalog(custom.map((f: any) => ({ key: f.fieldKey, type: f.fieldType })));
      })
      .catch(() => {});
    api.get('/field-definitions', { params: { entityType: 'ticket' } })
      .then(r => setTicketFieldCatalog(r.data.map((f: any) => ({ key: f.fieldKey, type: f.fieldType }))))
      .catch(() => {});
  }, []);

  // Discovered MCP tools and any open test-run panel are transient per-editing-session state
  useEffect(() => { setMcpDiscoveredTools([]); setTestModalOpen(false); }, [selId]);

  // ── Mouse helpers ─────────────────────────────────────────────────────────

  const toCanvas = useCallback((e: MouseEvent) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return {
      x: e.clientX - r.left + (wrapRef.current?.scrollLeft ?? 0),
      y: e.clientY - r.top + (wrapRef.current?.scrollTop ?? 0),
    };
  }, []);

  const onMove = useCallback((e: MouseEvent) => {
    if (dragMove) {
      const dx = e.clientX - dragMove.startMX;
      const dy = e.clientY - dragMove.startMY;
      setNodes(prev => prev.map(n =>
        n.id === dragMove.nodeId
          ? { ...n, x: Math.max(0, dragMove.origX + dx), y: Math.max(0, dragMove.origY + dy) }
          : n
      ));
    }
    if (conn) {
      const p = toCanvas(e);
      setConn(prev => prev ? { ...prev, curX: p.x, curY: p.y } : null);
    }
    if (resizeInsp) {
      // Dragging left (negative dx) widens the panel, since the handle sits on its left edge.
      const dx = e.clientX - resizeInsp.startMX;
      const next = Math.min(inspMaxWidth(), Math.max(INSP_MIN_W, resizeInsp.startWidth - dx));
      setInspectorWidth(next);
    }
  }, [dragMove, conn, resizeInsp, toCanvas]);

  const onUp = useCallback(() => {
    if (dragMove) setDragMove(null);
    if (resizeInsp) {
      setResizeInsp(null);
      setInspectorWidth(w => { localStorage.setItem('wfd-insp-width', String(w)); return w; });
    }
    if (conn) {
      if (hoverTgt && hoverTgt !== conn.fromId) {
        const desc = descendants(hoverTgt, nodes);
        if (!desc.has(conn.fromId)) {
          // hoverTgt becomes CHILD of conn.fromId
          setNodes(prev => prev.map(n =>
            n.id === hoverTgt ? { ...n, parentId: conn.fromId } : n
          ));
        }
      }
      setConn(null);
      setHoverTgt(null);
    }
  }, [dragMove, resizeInsp, conn, hoverTgt, nodes]);

  useEffect(() => {
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [onMove, onUp]);

  // ── Interaction handlers ──────────────────────────────────────────────────

  const startMove = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const n = nm[id]; if (!n) return;
    setDragMove({ nodeId: id, startMX: e.clientX, startMY: e.clientY, origX: n.x, origY: n.y });
    setSelId(id);
  };

  const startConn = (e: React.MouseEvent, fromId: string) => {
    e.stopPropagation(); e.preventDefault();
    const n = nm[fromId]; if (!n) return;
    const fx = n.x + NODE_W / 2, fy = n.y + NODE_H;
    setConn({ fromId, fromX: fx, fromY: fy, curX: fx, curY: fy });
  };

  const startResizeInsp = (e: React.MouseEvent) => {
    e.preventDefault();
    setResizeInsp({ startMX: e.clientX, startWidth: inspectorWidth });
  };

  const toggleInspWide = () => {
    const next = inspectorWidth > INSP_MIN_W ? INSP_MIN_W : Math.min(inspMaxWidth(), INSP_DEFAULT_WIDE_W);
    setInspectorWidth(next);
    localStorage.setItem('wfd-insp-width', String(next));
  };

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const addNode = (overrides?: Partial<FullNode>) => {
    const id = crypto.randomUUID();
    const parentId = selId ?? null;
    const par = selId ? nm[selId] : null;
    // A real bug found live: this only ever positioned the new node relative to the PARENT, with
    // no awareness of siblings already added under that same parent. Re-selecting the same parent
    // and adding a second item from the Library computed the exact same (x, y) as the first child
    // — the new node landed silently on top of it, not underneath, confusing which item was which
    // until an admin noticed and manually dragged one aside. Placing it after the rightmost
    // existing sibling instead — matching autoLayout's own convention that same-parent children
    // sit side by side, not stacked on each other — keeps every add visible immediately.
    const siblings = nodes.filter(n => n.parentId === parentId);
    const lastSibling = siblings.length ? siblings.reduce((a, b) => (a.x > b.x ? a : b)) : null;
    const baseX = par ? Math.min(par.x + NODE_W + 52, CANVAS_W - NODE_W - 20) : CANVAS_W / 2 - NODE_W / 2;
    const baseY = par ? par.y + LEVEL_H : TRIGGER_Y + TRIGGER_H + 72;
    const newN: FullNode = {
      id, title: 'New Item', type: 'task', parentId, displayOrder: nodes.length,
      defaultAssigneeUserId: null, customFieldKeys: [], dataFlows: [],
      x: lastSibling ? Math.min(lastSibling.x + NODE_W + GAP_X, CANVAS_W - NODE_W - 20) : baseX,
      y: lastSibling ? lastSibling.y : baseY,
      ...overrides,
    };
    setNodes(prev => [...prev, newN]);
    setSelId(id);
  };

  const addNodeFromLibrary = (entry: LibraryEntry) => {
    addNode({ title: entry.name, type: entry.type, typeConfig: entry.typeConfig ?? undefined });
    setLibraryPickerOpen(false);
  };

  const delNode = (id: string) => {
    const desc = descendants(id, nodes);
    desc.add(id);
    setNodes(prev => prev.filter(n => !desc.has(n.id)));
    if (selId && desc.has(selId)) setSelId(null);
  };

  const upd = (id: string, patch: Partial<FullNode>) =>
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));

  const setNodeType = (id: string, type: WorkflowNodeType) => {
    const n = nm[id]; if (!n) return;
    if (type === 'approval' && !Array.isArray((n.typeConfig as any)?.levels)) {
      upd(id, { type, typeConfig: { ...n.typeConfig, levels: [makeDefaultLevel()] } });
    } else if (type === 'external_api' && !Array.isArray((n.typeConfig as any)?.calls)) {
      upd(id, { type, typeConfig: { ...n.typeConfig, calls: [], fieldMappings: { request: [], response: [] } } });
    } else if (type === 'mcp_tool' && !Array.isArray((n.typeConfig as any)?.calls)) {
      upd(id, { type, typeConfig: { serverUrl: '', auth: { type: 'none' }, calls: [], fieldMappings: { response: [] } } });
    } else {
      upd(id, { type });
    }
  };

  const approvalLevelsOf = (n: FullNode): ApprovalLevel[] =>
    (n.typeConfig?.levels as ApprovalLevel[] | undefined) ?? [];

  const setApprovalLevels = (id: string, levels: ApprovalLevel[]) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, levels } });
  };

  const taskFieldsOf = (n: FullNode): SimpleItemField[] =>
    (n.typeConfig?.fields as SimpleItemField[] | undefined) ?? [];

  const setTaskFields = (id: string, fields: SimpleItemField[]) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, fields } });
  };

  const externalApiCallsOf = (n: FullNode): ExternalApiCall[] =>
    (n.typeConfig?.calls as ExternalApiCall[] | undefined) ?? [];

  const externalApiMappingsOf = (n: FullNode): ExternalApiFieldMappings =>
    (n.typeConfig?.fieldMappings as ExternalApiFieldMappings | undefined) ?? { request: [], response: [] };

  const setExternalApiCalls = (id: string, calls: ExternalApiCall[]) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, calls } });
  };

  const setExternalApiMappings = (id: string, fieldMappings: ExternalApiFieldMappings) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, fieldMappings } });
  };

  const mcpServerUrlOf = (n: FullNode): string => (n.typeConfig?.serverUrl as string | undefined) ?? '';
  const mcpAuthOf = (n: FullNode): McpAuth => (n.typeConfig?.auth as McpAuth | undefined) ?? { type: 'none' };
  const mcpCallsOf = (n: FullNode): McpCall[] => (n.typeConfig?.calls as McpCall[] | undefined) ?? [];
  const mcpResponseMappingsOf = (n: FullNode): McpResponseMapping[] =>
    ((n.typeConfig?.fieldMappings as { response?: McpResponseMapping[] } | undefined)?.response) ?? [];

  const setMcpServerUrl = (id: string, serverUrl: string) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, serverUrl } });
  };
  const setMcpAuth = (id: string, auth: McpAuth) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, auth } });
  };
  const setMcpCalls = (id: string, calls: McpCall[]) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, calls } });
  };
  const setMcpResponseMappings = (id: string, response: McpResponseMapping[]) => {
    const n = nm[id]; if (!n) return;
    upd(id, { typeConfig: { ...n.typeConfig, fieldMappings: { response } } });
  };
  // "Map Response Fields" proposal (see TestActionModal's runAutoMap/onApplyMapping) applied to
  // whichever node is selected when the admin clicks Apply — mirrors AiWorkflowBuilderPage's
  // handleApplyAutoMap exactly (same mergeCapturesById, same "replace the response mapping
  // wholesale" semantics), just writing into a saved node's typeConfig instead of wizard-draft
  // state. missingWorkflowFields suggestions aren't surfaced here (no WorkflowFieldSuggestions
  // panel in this Inspector) — a proposal referencing a not-yet-created "this.<key>" target still
  // shows up correctly via FieldRefSelect's existing pending-field handling, it just isn't
  // surfaced as an explicit "create this field" prompt the way the guided wizard shows it.
  const handleApplyAutoMap = (id: string, proposal: AutoMapProposal) => {
    const n = nm[id]; if (!n) return;
    if (n.type === 'mcp_tool') {
      const mergedCalls = mergeCapturesById(mcpCallsOf(n), proposal.calls);
      setMcpCalls(id, mergedCalls);
      setMcpResponseMappings(id, proposal.fieldMappingsResponse);
    } else if (n.type === 'external_api') {
      const mergedCalls = mergeCapturesById(externalApiCallsOf(n), proposal.calls);
      setExternalApiCalls(id, mergedCalls);
      setExternalApiMappings(id, { ...externalApiMappingsOf(n), response: proposal.fieldMappingsResponse });
    }
  };

  const addMcpCallFromTool = (id: string, tool: any) => {
    const n = nm[id]; if (!n) return;
    const properties = tool?.inputSchema?.properties ?? {};
    const call = makeDefaultMcpCall(mcpCallsOf(n).length, tool.name);
    call.argumentMappings = Object.keys(properties).map(key => ({ toolArgument: key, ticketField: '' }));
    setMcpCalls(id, [...mcpCallsOf(n), call]);
  };

  const addFlow = (nodeId: string) => {
    const f: DataFlow = { id: crypto.randomUUID(), direction: 'pull', source: '', target: '' };
    upd(nodeId, { dataFlows: [...(nm[nodeId]?.dataFlows ?? []), f] });
  };

  const updFlow = (nodeId: string, flowId: string, patch: Partial<DataFlow>) => {
    const n = nm[nodeId]; if (!n) return;
    upd(nodeId, { dataFlows: n.dataFlows.map(f => f.id === flowId ? { ...f, ...patch } : f) });
  };

  const rmFlow = (nodeId: string, flowId: string) => {
    const n = nm[nodeId]; if (!n) return;
    upd(nodeId, { dataFlows: n.dataFlows.filter(f => f.id !== flowId) });
  };

  // ── SVG helpers ───────────────────────────────────────────────────────────

  const bez = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2;
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`;
  };

  const tcx = CANVAS_W / 2;          // trigger center X
  const tby = TRIGGER_Y + TRIGGER_H; // trigger bottom Y

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="wfd-overlay">
      <div className="wfd-shell">

        {/* ── Header ── */}
        <div className="wfd-header">
          <div className="wfd-header-left">
            <GitBranch size={14} />
            <span className="wfd-title">{fieldLabel} — Workflow Designer</span>
            <span className="wfd-cnt">{nodes.length} item{nodes.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="wfd-header-right">
            <button className="wfd-btn-ghost" onClick={onClose}>Cancel</button>
            <button className="wfd-btn-save" onClick={() => onSave({ nodes })}>Save workflow</button>
            <button className="wfd-icon-btn" onClick={onClose}><X size={14} /></button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="wfd-body">

          {/* ── Canvas ── */}
          <div className="wfd-canvas-wrap" ref={wrapRef}>
            <div className="wfd-canvas" style={{ width: CANVAS_W, height: CANVAS_H }}>

              {/* SVG connector layer */}
              <svg className="wfd-svg" width={CANVAS_W} height={CANVAS_H}>
                <defs>
                  <marker id="wfd-arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#334155" />
                  </marker>
                  <marker id="wfd-arr-live" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
                  </marker>
                </defs>

                {/* Trigger → roots */}
                {nodes.filter(n => !n.parentId).map(n => (
                  <path key={`tr-${n.id}`}
                    d={bez(tcx, tby, n.x + NODE_W / 2, n.y)}
                    stroke="#253347" strokeWidth="1.5" fill="none" markerEnd="url(#wfd-arr)" />
                ))}

                {/* Parent → child */}
                {nodes.filter(n => n.parentId && nm[n.parentId]).map(n => {
                  const p = nm[n.parentId!];
                  return (
                    <path key={`e-${n.id}`}
                      d={bez(p.x + NODE_W / 2, p.y + NODE_H, n.x + NODE_W / 2, n.y)}
                      stroke="#253347" strokeWidth="1.5" fill="none" markerEnd="url(#wfd-arr)" />
                  );
                })}

                {/* Live connect preview */}
                {conn && (
                  <path
                    d={bez(conn.fromX, conn.fromY, conn.curX, conn.curY)}
                    stroke="#6366f1" strokeWidth="2" fill="none"
                    strokeDasharray="6 3" opacity="0.8" markerEnd="url(#wfd-arr-live)" />
                )}
              </svg>

              {/* Trigger node */}
              <div className="wfd-trigger" style={{ left: CANVAS_W / 2 - TRIGGER_W / 2, top: TRIGGER_Y, width: TRIGGER_W }}>
                <span className="wfd-trigger-eye">TRIGGER</span>
                <span className="wfd-trigger-txt">Ticket status → Open</span>
              </div>

              {/* Workflow nodes */}
              {nodes.map(n => {
                const depth = nodeDepth(n.id, nm);
                const color = dc(depth);
                const isSel = n.id === selId;
                const isTgt = hoverTgt === n.id && conn?.fromId !== n.id;
                const pullCnt = n.dataFlows.filter(f => f.direction === 'pull').length;
                const pushCnt = n.dataFlows.filter(f => f.direction === 'push').length;
                return (
                  <div
                    key={n.id}
                    className={`wfd-node${isSel ? ' wfd-node--sel' : ''}${isTgt ? ' wfd-node--tgt' : ''}`}
                    style={{ left: n.x, top: n.y, width: NODE_W, '--nc': color } as React.CSSProperties}
                    onMouseDown={e => startMove(e, n.id)}
                    onClick={e => { e.stopPropagation(); setSelId(n.id); }}
                    onMouseEnter={() => { if (conn) setHoverTgt(n.id); }}
                    onMouseLeave={() => { if (conn) setHoverTgt(null); }}
                  >
                    {/* node header bar */}
                    <div className="wfd-nh">
                      <span className="wfd-nlvl">{depth === 0 ? 'L0 · Root' : `L${depth}`}</span>
                      <button
                        className="wfd-ndel"
                        onMouseDown={e => e.stopPropagation()}
                        onClick={e => { e.stopPropagation(); delNode(n.id); }}
                      ><Trash2 size={9} /></button>
                    </div>
                    {/* title */}
                    <div className="wfd-nttl">
                      {n.type === 'approval' && <ShieldCheck size={11} className="wfd-nttl-icon" />}
                      {n.type === 'external_api' && <Globe2 size={11} className="wfd-nttl-icon" />}
                      {n.type === 'mcp_tool' && <Plug size={11} className="wfd-nttl-icon" />}
                      {n.title || 'Untitled'}
                    </div>
                    {/* meta pills */}
                    {(n.customFieldKeys.length > 0 || n.dataFlows.length > 0 || n.type === 'approval' || n.type === 'external_api' || n.type === 'mcp_tool' || n.activationCondition) && (
                      <div className="wfd-nmeta">
                        {n.type === 'approval' && (
                          <span className="wfd-pill wfd-pill-approval">
                            {t('workflow_levels_count_pill', { defaultValue: '{{count}} level{{s}}', count: approvalLevelsOf(n).length, s: approvalLevelsOf(n).length !== 1 ? 's' : '' })}
                          </span>
                        )}
                        {n.type === 'external_api' && (
                          <span className="wfd-pill wfd-pill-approval">
                            {t('workflow_calls_count_pill', { defaultValue: '{{count}} call{{s}}', count: externalApiCallsOf(n).length, s: externalApiCallsOf(n).length !== 1 ? 's' : '' })}
                          </span>
                        )}
                        {n.type === 'mcp_tool' && (
                          <span className="wfd-pill wfd-pill-approval">
                            {t('workflow_calls_count_pill', { defaultValue: '{{count}} call{{s}}', count: mcpCallsOf(n).length, s: mcpCallsOf(n).length !== 1 ? 's' : '' })}
                          </span>
                        )}
                        {n.activationCondition === 'approved' && <span className="wfd-pill wfd-pill-pull">{t('workflow_pill_on_approved', { defaultValue: 'on approved' })}</span>}
                        {n.activationCondition === 'rejected' && <span className="wfd-pill wfd-pill-push">{t('workflow_pill_on_rejected', { defaultValue: 'on rejected' })}</span>}
                        {n.customFieldKeys.length > 0 && (
                          <span className="wfd-pill">{n.customFieldKeys.length} field{n.customFieldKeys.length > 1 ? 's' : ''}</span>
                        )}
                        {pullCnt > 0 && <span className="wfd-pill wfd-pill-pull">↓{pullCnt} pull</span>}
                        {pushCnt > 0 && <span className="wfd-pill wfd-pill-push">↑{pushCnt} push</span>}
                      </div>
                    )}
                    {/* connect port */}
                    <div
                      className="wfd-port"
                      title="Drag → drop on another node to set it as its child"
                      onMouseDown={e => startConn(e, n.id)}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Inspector ── */}
          <aside className="wfd-insp" style={{ width: inspectorWidth }}>
            <div
              className="wfd-insp-resize-handle"
              onMouseDown={startResizeInsp}
              title={t('workflow_inspector_resize_hint', { defaultValue: 'Drag to resize' }) as string}
            />
            <div className="wfd-insp-top">
              <span className="wfd-sec-lbl">NODE INSPECTOR</span>
              <div className="wfd-insp-top-btns">
                <button
                  className="wfd-add-btn wfd-insp-widen-btn"
                  onClick={toggleInspWide}
                  title={inspectorWidth > INSP_MIN_W
                    ? (t('workflow_inspector_narrow_btn', { defaultValue: 'Narrow panel' }) as string)
                    : (t('workflow_inspector_widen_btn', { defaultValue: 'Widen panel' }) as string)}
                >
                  {inspectorWidth > INSP_MIN_W ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
                </button>
                <div className="wfd-library-picker-wrap">
                  <button className="wfd-add-btn" onClick={() => setLibraryPickerOpen(v => !v)}>
                    <LibraryBig size={11} /> {t('workflow_add_from_library_btn', { defaultValue: 'Add from Library' })}
                  </button>
                  {libraryPickerOpen && (
                    <div className="wfd-library-picker">
                      {libraryEntries.length === 0 ? (
                        <p className="wfd-empty-txt">{t('workflow_library_empty', { defaultValue: 'No action items in the library yet — build one in the Action Items tab.' })}</p>
                      ) : (
                        libraryEntries.map(entry => (
                          <button key={entry.id} className="wfd-library-entry" onClick={() => addNodeFromLibrary(entry)}>
                            {entry.type === 'task' ? <ClipboardList size={13} /> : entry.type === 'mcp_tool' ? <Plug size={13} /> : <Globe2 size={13} />}
                            <span className="wfd-library-entry-name">{entry.name}</span>
                            {entry.source === 'ai' && <Sparkles size={11} className="wfd-library-entry-ai" />}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <button className="wfd-add-btn" onClick={() => addNode()}><Plus size={11} /> Add item</button>
              </div>
            </div>

            {!selNode ? (
              <div className="wfd-insp-empty">
                <GitBranch size={26} className="wfd-ie-icon" />
                <p>Select a node to edit</p>
                <p className="wfd-ie-hint">
                  Click any node on the canvas,<br />or click "Add item" to start
                </p>
                {nodes.length === 0 && (
                  <button className="wfd-btn-save wfd-mt16" onClick={() => addNode()}><Plus size={12} /> Add first item</button>
                )}
              </div>
            ) : (
              <div className="wfd-insp-body">

                {/* Title */}
                <div className="wfd-sec">
                  <div className="wfd-sec-lbl">TITLE</div>
                  <input
                    className="wfd-inp"
                    value={selNode.title}
                    onChange={e => upd(selNode.id, { title: e.target.value })}
                    placeholder="Item title…"
                    autoFocus
                  />
                </div>

                {/* Parent */}
                <div className="wfd-sec">
                  <div className="wfd-sec-lbl">PARENT NODE</div>
                  <select
                    className="wfd-sel"
                    value={selNode.parentId ?? ''}
                    onChange={e => upd(selNode.id, { parentId: e.target.value || null })}
                  >
                    <option value="">— Root (activates on ticket open) —</option>
                    {nodes.filter(n => n.id !== selNode.id && !descendants(selNode.id, nodes).has(n.id))
                      .map(n => <option key={n.id} value={n.id}>{n.title || 'Untitled'}</option>)}
                  </select>
                  <p className="wfd-hint-xs">Or drag the ● port on the canvas to connect</p>
                </div>

                {/* Type */}
                <div className="wfd-sec">
                  <div className="wfd-sec-lbl">{t('workflow_item_type_label', { defaultValue: 'ITEM TYPE' })}</div>
                  <select
                    className="wfd-sel"
                    value={selNode.type ?? 'task'}
                    onChange={e => setNodeType(selNode.id, e.target.value as WorkflowNodeType)}
                  >
                    <option value="task">{t('workflow_node_type_task_option', { defaultValue: 'Task — manual checklist item' })}</option>
                    <option value="approval">{t('workflow_node_type_approval_option', { defaultValue: 'Approval — requires a decision' })}</option>
                    <option value="external_api">{t('workflow_node_type_external_api_option', { defaultValue: 'External API — calls an outside system' })}</option>
                    <option value="mcp_tool">{t('workflow_node_type_mcp_tool_option', { defaultValue: "MCP Tool — calls an MCP server's tools" })}</option>
                  </select>
                </div>

                {/* Activation condition — only meaningful when the parent is an approval item */}
                {selNode.parentId && nm[selNode.parentId]?.type === 'approval' && (
                  <div className="wfd-sec">
                    <div className="wfd-sec-lbl">{t('workflow_activates_on_label', { defaultValue: 'ACTIVATES ON' })}</div>
                    <select
                      className="wfd-sel"
                      value={selNode.activationCondition ?? ''}
                      onChange={e => upd(selNode.id, {
                        activationCondition: (e.target.value || undefined) as 'approved' | 'rejected' | undefined,
                      })}
                    >
                      <option value="">{t('workflow_activation_always_option', { defaultValue: 'Always (any outcome)' })}</option>
                      <option value="approved">{t('workflow_activation_only_approved_option', { defaultValue: 'Only if parent is Approved' })}</option>
                      <option value="rejected">{t('workflow_activation_only_rejected_option', { defaultValue: 'Only if parent is Rejected' })}</option>
                    </select>
                  </div>
                )}

                {/* Approval levels */}
                {selNode.type === 'approval' ? (
                  <div className="wfd-sec">
                    <div className="wfd-sec-row">
                      <div className="wfd-sec-lbl"><ShieldCheck size={9} /> {t('workflow_approval_levels_label', { defaultValue: 'APPROVAL LEVELS' })}</div>
                    </div>
                    <ApprovalLevelsEditor
                      levels={approvalLevelsOf(selNode)}
                      onChange={levels => setApprovalLevels(selNode.id, levels)}
                    />
                  </div>
                ) : selNode.type === 'external_api' ? (
                  <>
                    <div className="wfd-sec">
                      <div className="wfd-sec-row">
                        <div className="wfd-sec-lbl"><Globe2 size={9} /> {t('workflow_api_calls_label', { defaultValue: 'API CALLS' })}</div>
                        {externalApiCallsOf(selNode).length > 0 && (
                          <button className="wfd-add-flow-btn" onClick={() => setTestModalOpen(true)}>
                            <Play size={10} /> {t('test_action_btn', { defaultValue: 'Test this call now' })}
                          </button>
                        )}
                      </div>
                      <p className="wfd-hint-xs">
                        {t('workflow_api_calls_hint', { defaultValue: 'Runs automatically the moment this item activates — no human action needed.' })}
                        {' '}
                        {t('workflow_placeholder_usage_hint_prefix', { defaultValue: 'Use' })} <code>{'{{placeholder}}'}</code> {t('workflow_placeholder_usage_hint_suffix', { defaultValue: 'in URL/header/body templates.' })}
                      </p>
                      <ExternalApiCallsEditor
                        calls={externalApiCallsOf(selNode)}
                        onChange={calls => setExternalApiCalls(selNode.id, calls)}
                      />
                    </div>
                    <ExternalApiFieldMappingsEditor
                      mappings={externalApiMappingsOf(selNode)}
                      onChange={m => setExternalApiMappings(selNode.id, m)}
                      ticketFieldKeys={ticketFieldKeys}
                      workflowFieldKeys={workflowFieldKeys}
                      captureNames={externalApiCallsOf(selNode).flatMap(c => c.responseCaptures.map(r => r.name).filter(Boolean))}
                      onTestClick={externalApiCallsOf(selNode).length > 0 ? () => setTestModalOpen(true) : undefined}
                    />
                  </>
                ) : selNode.type === 'mcp_tool' ? (
                  <>
                    <div className="wfd-sec">
                      <div className="wfd-sec-row">
                        <div className="wfd-sec-lbl"><Plug size={9} /> {t('workflow_mcp_tool_calls_label', { defaultValue: 'MCP TOOL CALLS' })}</div>
                        {mcpCallsOf(selNode).length > 0 && (
                          <button className="wfd-add-flow-btn" onClick={() => setTestModalOpen(true)}>
                            <Play size={10} /> {t('test_action_btn', { defaultValue: 'Test this call now' })}
                          </button>
                        )}
                      </div>
                      <p className="wfd-hint-xs">
                        {t('workflow_api_calls_hint', { defaultValue: 'Runs automatically the moment this item activates — no human action needed.' })}
                      </p>
                      <McpServerConnectionEditor
                        serverUrl={mcpServerUrlOf(selNode)}
                        onServerUrlChange={v => setMcpServerUrl(selNode.id, v)}
                        auth={mcpAuthOf(selNode)}
                        onAuthChange={a => setMcpAuth(selNode.id, a)}
                        onToolsDiscovered={setMcpDiscoveredTools}
                      />
                      <McpToolPicker tools={mcpDiscoveredTools} onPick={tool => addMcpCallFromTool(selNode.id, tool)} />
                      <McpToolCallsEditor
                        calls={mcpCallsOf(selNode)}
                        onChange={calls => setMcpCalls(selNode.id, calls)}
                        ticketFieldKeys={ticketFieldKeys}
                        workflowFieldKeys={workflowFieldKeys}
                        serverUrl={mcpServerUrlOf(selNode)}
                        auth={mcpAuthOf(selNode)}
                      />
                    </div>
                    <McpResponseMappingsEditor
                      mappings={mcpResponseMappingsOf(selNode)}
                      onChange={m => setMcpResponseMappings(selNode.id, m)}
                      captureNames={mcpCallsOf(selNode).flatMap(c => c.responseCaptures.map(r => r.name).filter(Boolean))}
                      ticketFieldKeys={ticketFieldKeys}
                      workflowFieldKeys={workflowFieldKeys}
                      onTestClick={mcpCallsOf(selNode).length > 0 ? () => setTestModalOpen(true) : undefined}
                    />
                  </>
                ) : (
                  <>
                    {/* Assignee */}
                    <div className="wfd-sec">
                      <div className="wfd-sec-lbl">DEFAULT ASSIGNEE</div>
                      <UserPickerControl
                        mode="all"
                        value={selNode.defaultAssigneeUserId?.toString() ?? ''}
                        onChange={v => upd(selNode.id, { defaultAssigneeUserId: v ? Number(v) : null })}
                        compact
                      />
                    </div>

                    {/* Pre-built fields */}
                    <div className="wfd-sec">
                      <div className="wfd-sec-lbl"><Lock size={9} /> PRE-BUILT FIELDS</div>
                      {['Workflow Status', 'Assignee', 'Attachments 📎'].map(f => (
                        <div key={f} className="wfd-locked-row">
                          <span>{f}</span>
                          <span className="wfd-locked-badge">LOCKED</span>
                        </div>
                      ))}
                    </div>

                    {/* Item's own mini-fields — same concept as the Action Item Library builder;
                        this template's copy can be freely tweaked without affecting the library entry. */}
                    <div className="wfd-sec">
                      <div className="wfd-sec-lbl">{t('simple_item_fields_label', { defaultValue: 'FIELDS (optional)' })}</div>
                      <SimpleItemFieldsEditor
                        fields={taskFieldsOf(selNode)}
                        onChange={fields => setTaskFields(selNode.id, fields)}
                      />
                    </div>
                  </>
                )}

                {/* Custom fields — not applicable to external_api (field mapping above covers I/O) or approval */}
                {selNode.type !== 'approval' && selNode.type !== 'external_api' && selNode.type !== 'mcp_tool' && (
                <div className="wfd-sec">
                  <div className="wfd-sec-lbl">CUSTOM FIELDS</div>
                  {selNode.customFieldKeys.length === 0 && (
                    <p className="wfd-empty-txt">No custom fields added yet</p>
                  )}
                  {selNode.customFieldKeys.length > 0 && (
                    <div className="wfd-tags">
                      {selNode.customFieldKeys.map(k => (
                        <div key={k} className="wfd-tag">
                          <span>{k}</span>
                          <button className="wfd-tag-rm" onClick={() =>
                            upd(selNode.id, { customFieldKeys: selNode.customFieldKeys.filter(x => x !== k) })
                          }><X size={9} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  {ticketFieldKeys.length > 0 ? (
                    <select
                      className="wfd-sel"
                      value=""
                      onChange={e => {
                        const k = e.target.value;
                        if (k && !selNode.customFieldKeys.includes(k))
                          upd(selNode.id, { customFieldKeys: [...selNode.customFieldKeys, k] });
                      }}
                    >
                      <option value="">+ Add ticket field to this item…</option>
                      {ticketFieldKeys.filter(k => !selNode.customFieldKeys.includes(k))
                        .map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  ) : (
                    <p className="wfd-empty-txt">No ticket fields available (add fields to the template first)</p>
                  )}
                </div>
                )}

                {/* Data flows — not applicable to approval/external_api items (approvers/decisions
                    aren't field-mapped; external_api has its own dedicated field-mapping section above) */}
                {selNode.type !== 'approval' && selNode.type !== 'external_api' && selNode.type !== 'mcp_tool' && (
                <div className="wfd-sec">
                  <div className="wfd-sec-row">
                    <div className="wfd-sec-lbl"><Database size={9} /> DATA FLOWS</div>
                    <button className="wfd-add-flow-btn" onClick={() => addFlow(selNode.id)}>
                      <Plus size={10} /> Add
                    </button>
                  </div>

                  {selNode.dataFlows.length === 0 && (
                    <p className="wfd-empty-txt">No data flows — use these to sync fields between ticket and workflow items</p>
                  )}

                  {selNode.dataFlows.map(flow => (
                    <div key={flow.id} className="wfd-flow-card">
                      {/* direction + remove */}
                      <div className="wfd-fc-top">
                        <select
                          className={`wfd-flow-dir ${flow.direction}`}
                          value={flow.direction}
                          onChange={e => updFlow(selNode.id, flow.id, {
                            direction: e.target.value as 'pull' | 'push',
                            source: '',
                            target: '',
                          })}
                        >
                          <option value="pull">↓ PULL — import into this item</option>
                          <option value="push">↑ PUSH — export from this item</option>
                        </select>
                        <button className="wfd-flow-rm" onClick={() => rmFlow(selNode.id, flow.id)}>
                          <X size={9} />
                        </button>
                      </div>

                      {/* source → target selects */}
                      <div className="wfd-fc-body">
                        {flow.direction === 'pull' ? (
                          <>
                            {/* PULL: source = ticket/other, target = this */}
                            <select
                              className="wfd-flow-sel"
                              value={flow.source}
                              onChange={e => updFlow(selNode.id, flow.id, { source: e.target.value })}
                            >
                              <option value="">From (source field)…</option>
                              {fieldOpts && (
                                <>
                                  <optgroup label="── Ticket ──">
                                    {fieldOpts.ticketOpts.map(o =>
                                      <option key={o.v} value={o.v}>{o.l}</option>)}
                                  </optgroup>
                                  {fieldOpts.otherOpts.length > 0 && (
                                    <optgroup label="── Other workflow items ──">
                                      {fieldOpts.otherOpts.map(o =>
                                        <option key={o.v} value={o.v}>{o.l}</option>)}
                                    </optgroup>
                                  )}
                                </>
                              )}
                            </select>
                            <div className="wfd-fc-mid">
                              <ArrowRight size={11} />
                              <span className="wfd-fc-hint">into this item</span>
                            </div>
                            <select
                              className="wfd-flow-sel"
                              value={flow.target}
                              onChange={e => updFlow(selNode.id, flow.id, { target: e.target.value })}
                            >
                              <option value="">Into (target field on this item)…</option>
                              {fieldOpts && (
                                <optgroup label="── This item ──">
                                  {fieldOpts.thisOpts.map(o =>
                                    <option key={o.v} value={o.v}>{o.l}</option>)}
                                </optgroup>
                              )}
                            </select>
                          </>
                        ) : (
                          <>
                            {/* PUSH: source = this, target = ticket/other */}
                            <select
                              className="wfd-flow-sel"
                              value={flow.source}
                              onChange={e => updFlow(selNode.id, flow.id, { source: e.target.value })}
                            >
                              <option value="">From this item (source)…</option>
                              {fieldOpts && (
                                <optgroup label="── This item ──">
                                  {fieldOpts.thisOpts.map(o =>
                                    <option key={o.v} value={o.v}>{o.l}</option>)}
                                </optgroup>
                              )}
                            </select>
                            <div className="wfd-fc-mid">
                              <ArrowRight size={11} />
                              <span className="wfd-fc-hint">push to target</span>
                            </div>
                            <select
                              className="wfd-flow-sel"
                              value={flow.target}
                              onChange={e => updFlow(selNode.id, flow.id, { target: e.target.value })}
                            >
                              <option value="">To (target field)…</option>
                              {fieldOpts && (
                                <>
                                  <optgroup label="── Ticket ──">
                                    {fieldOpts.ticketOpts.map(o =>
                                      <option key={o.v} value={o.v}>{o.l}</option>)}
                                  </optgroup>
                                  {fieldOpts.otherOpts.length > 0 && (
                                    <optgroup label="── Other workflow items ──">
                                      {fieldOpts.otherOpts.map(o =>
                                        <option key={o.v} value={o.v}>{o.l}</option>)}
                                    </optgroup>
                                  )}
                                </>
                              )}
                            </select>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                )}

                {/* Delete */}
                <div className="wfd-sec wfd-sec-last">
                  <button
                    className="wfd-del-btn"
                    onClick={() => {
                      const hasChildren = nodes.some(n => n.parentId === selNode.id);
                      if (!hasChildren || window.confirm(
                        `Delete "${selNode.title || 'this item'}" and all its children?`
                      )) delNode(selNode.id);
                    }}
                  >
                    <Trash2 size={11} />
                    Delete item{nodes.some(n => n.parentId === selNode.id) ? ' + children' : ''}
                  </button>
                </div>

              </div>
            )}
          </aside>
        </div>
      </div>

      {testModalOpen && selNode && (selNode.type === 'external_api' || selNode.type === 'mcp_tool') && (
        <TestActionModal
          type={selNode.type}
          nodeId={selNode.id}
          templateId={templateId}
          typeConfig={selNode.typeConfig ?? {}}
          referencedTicketFields={
            selNode.type === 'external_api'
              ? externalApiMappingsOf(selNode).request.map(r => r.ticketField).filter(Boolean)
              : mcpCallsOf(selNode).flatMap(c => c.argumentMappings).map(m => m.ticketField).filter((f): f is string => !!f)
          }
          ticketFields={ticketFieldCatalog}
          workflowFieldCatalog={workflowFieldCatalog}
          onApplyMapping={proposal => handleApplyAutoMap(selNode.id, proposal)}
          onClose={() => setTestModalOpen(false)}
        />
      )}
    </div>
  );
};
