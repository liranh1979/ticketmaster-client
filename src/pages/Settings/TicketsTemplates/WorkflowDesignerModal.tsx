import { useState, useRef, useCallback, useEffect } from 'react';
import { X, Plus, GitBranch, Trash2, Database, ArrowRight, Lock } from 'lucide-react';
import { UserPickerControl } from '../../../components/UserPickerControl/UserPickerControl';
import './WorkflowDesignerModal.css';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DataFlow {
  id: string;
  direction: 'pull' | 'push';
  source: string;
  target: string;
}

export interface WorkflowNodeDef {
  id: string;
  title: string;
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
  onSave: (config: WorkflowFieldConfig) => void;
  onClose: () => void;
}

type FullNode = WorkflowNodeDef & { x: number; y: number };

export const WorkflowDesignerModal = ({
  fieldLabel,
  fieldConfig,
  ticketFieldKeys = [],
  onSave,
  onClose,
}: Props) => {

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

  // Drag-to-move
  const [dragMove, setDragMove] = useState<{
    nodeId: string; startMX: number; startMY: number; origX: number; origY: number;
  } | null>(null);

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
  }, [dragMove, conn, toCanvas]);

  const onUp = useCallback(() => {
    if (dragMove) setDragMove(null);
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
  }, [dragMove, conn, hoverTgt, nodes]);

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

  // ── CRUD ─────────────────────────────────────────────────────────────────

  const addNode = () => {
    const id = crypto.randomUUID();
    const par = selId ? nm[selId] : null;
    const newN: FullNode = {
      id, title: 'New Item', parentId: selId ?? null, displayOrder: nodes.length,
      defaultAssigneeUserId: null, customFieldKeys: [], dataFlows: [],
      x: par ? Math.min(par.x + NODE_W + 52, CANVAS_W - NODE_W - 20) : CANVAS_W / 2 - NODE_W / 2,
      y: par ? par.y + LEVEL_H : TRIGGER_Y + TRIGGER_H + 72,
    };
    setNodes(prev => [...prev, newN]);
    setSelId(id);
  };

  const delNode = (id: string) => {
    const desc = descendants(id, nodes);
    desc.add(id);
    setNodes(prev => prev.filter(n => !desc.has(n.id)));
    if (selId && desc.has(selId)) setSelId(null);
  };

  const upd = (id: string, patch: Partial<FullNode>) =>
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...patch } : n));

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
                    <div className="wfd-nttl">{n.title || 'Untitled'}</div>
                    {/* meta pills */}
                    {(n.customFieldKeys.length > 0 || n.dataFlows.length > 0) && (
                      <div className="wfd-nmeta">
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
          <aside className="wfd-insp">
            <div className="wfd-insp-top">
              <span className="wfd-sec-lbl">NODE INSPECTOR</span>
              <button className="wfd-add-btn" onClick={addNode}><Plus size={11} /> Add item</button>
            </div>

            {!selNode ? (
              <div className="wfd-insp-empty">
                <GitBranch size={26} className="wfd-ie-icon" />
                <p>Select a node to edit</p>
                <p className="wfd-ie-hint">
                  Click any node on the canvas,<br />or click "Add item" to start
                </p>
                {nodes.length === 0 && (
                  <button className="wfd-btn-save wfd-mt16" onClick={addNode}><Plus size={12} /> Add first item</button>
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

                {/* Custom fields */}
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

                {/* Data flows */}
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
    </div>
  );
};
