import { useState } from 'react';
import './JsonTreeExplorer.css';

// Renders arbitrary JSON as a collapsible, clickable tree — the "Map & Verify Output" step's
// visual mapping method (see V2/mcp-server-management/07-mockup-response-mapping.html). Clicking
// a LEAF value reports its exact JSONPath, derived purely from the click (accumulated while
// walking the tree, the same key/index-concatenation Jayway's own JsonPath syntax uses) — never
// hand-typed, so it can't be syntactically wrong the way a guessed path can. Only leaves are
// clickable: a capture's resultPath always resolves to one scalar/array/object value, never "this
// whole branch, whatever it turns out to contain."
export interface JsonLeafClick {
  path: string;
  value: unknown;
  keyHint: string;
}

interface Props {
  data: unknown;
  onPickLeaf: (click: JsonLeafClick) => void;
  activePath?: string | null;
  // Real feature added live: an admin picking a whole array/object (not one scalar) has nothing
  // sensible to JSONPath-extract as a single value — offered here as a distinct "map this branch"
  // affordance (a small button on the bracket, not the same click as expand/collapse) feeding an
  // "AI Summary" capture instead of a plain path+target mapping. Optional — omitting it keeps every
  // other JsonTreeExplorer usage exactly as before, branches un-clickable.
  onPickBranch?: (click: JsonLeafClick) => void;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Real bug found live: a tool typed to return a plain string (this codebase's generated scripts
// commonly do — a Python "-> str" tool returning json.dumps(data)) gets its MCP structuredContent
// wrapped as a synthetic single-property envelope, {"result": "<the JSON, still escaped as one big
// string>"} — the admin saw one giant unreadable string leaf instead of a real tree. Mirrors
// McpActionExecutor.deepUnwrapJsonStrings exactly (same recursion, same "looks like JSON" check,
// same depth guard) so the tree an admin clicks through matches what a real capture's resultPath
// actually evaluates against server-side — a path clicked here must resolve identically at verify
// and real-execution time, not just look right in this preview.
export function deepParseJsonStrings(value: unknown, depth = 0): unknown {
  if (depth > 10) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const looksLikeJson = (trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'));
    if (!looksLikeJson) return value;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') return deepParseJsonStrings(parsed, depth + 1);
    } catch {
      // not actually JSON despite looking like it — leave as-is
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(v => deepParseJsonStrings(v, depth + 1));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = deepParseJsonStrings(v, depth + 1);
    return out;
  }
  return value;
}

function formatScalar(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  return String(v);
}

function BranchSummarizeBtn({ path, value, keyHint, activePath, onPickBranch }: {
  path: string; value: unknown; keyHint: string; activePath?: string | null;
  onPickBranch?: (click: JsonLeafClick) => void;
}) {
  if (!onPickBranch) return null;
  const active = activePath === path;
  return (
    <button
      type="button"
      className={`jt-branch-btn${active ? ' jt-branch-btn-active' : ''}`}
      title="Map this whole branch as an AI Summary"
      onClick={e => { e.stopPropagation(); onPickBranch({ path, value, keyHint }); }}
    >
      🤖
    </button>
  );
}

function JsonNode({ data, path, keyHint, onPickLeaf, onPickBranch, activePath, depth }: {
  data: unknown;
  path: string;
  keyHint: string;
  onPickLeaf: (click: JsonLeafClick) => void;
  onPickBranch?: (click: JsonLeafClick) => void;
  activePath?: string | null;
  depth: number;
}) {
  // Starts fully expanded — a real captured response commonly nests a useful leaf 4-5 levels deep
  // (e.g. airports[0].departure[0].airport.name), so collapsing by depth would force several
  // manual expand-clicks before ANY leaf is reachable. Admins can still collapse a noisy branch
  // (a huge array, a section they don't care about) by hand; nothing starts hidden from them.
  const [collapsed, setCollapsed] = useState(false);

  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="jt-punc">[]</span>;
    return (
      <span>
        <span className="jt-toggle" onClick={() => setCollapsed(c => !c)}>{collapsed ? '[…]' : '['}</span>
        <BranchSummarizeBtn path={path} value={data} keyHint={keyHint} activePath={activePath} onPickBranch={onPickBranch} />
        {!collapsed && (
          <div className="jt-children">
            {data.map((item, i) => (
              <div key={i} className="jt-row">
                <span className="jt-idx">{i}</span>
                <span className="jt-punc">: </span>
                <JsonNode data={item} path={`${path}[${i}]`} keyHint={String(i)} onPickLeaf={onPickLeaf} onPickBranch={onPickBranch} activePath={activePath} depth={depth + 1} />
                {i < data.length - 1 && <span className="jt-punc">,</span>}
              </div>
            ))}
          </div>
        )}
        {!collapsed && <span className="jt-punc">]</span>}
      </span>
    );
  }

  if (isPlainObject(data)) {
    const keys = Object.keys(data);
    if (keys.length === 0) return <span className="jt-punc">{'{}'}</span>;
    return (
      <span>
        <span className="jt-toggle" onClick={() => setCollapsed(c => !c)}>{collapsed ? '{…}' : '{'}</span>
        <BranchSummarizeBtn path={path} value={data} keyHint={keyHint} activePath={activePath} onPickBranch={onPickBranch} />
        {!collapsed && (
          <div className="jt-children">
            {keys.map((k, i) => (
              <div key={k} className="jt-row">
                <span className="jt-key">"{k}"</span>
                <span className="jt-punc">: </span>
                <JsonNode data={data[k]} path={`${path}.${k}`} keyHint={k} onPickLeaf={onPickLeaf} onPickBranch={onPickBranch} activePath={activePath} depth={depth + 1} />
                {i < keys.length - 1 && <span className="jt-punc">,</span>}
              </div>
            ))}
          </div>
        )}
        {!collapsed && <span className="jt-punc">{'}'}</span>}
      </span>
    );
  }

  // Leaf — string, number, boolean, or null.
  const active = activePath === path;
  return (
    <span
      className={`jt-leaf${active ? ' jt-leaf-active' : ''}`}
      onClick={() => onPickLeaf({ path, value: data, keyHint })}
      title={path}
    >
      {formatScalar(data)}
    </span>
  );
}

export const JsonTreeExplorer = ({ data, onPickLeaf, onPickBranch, activePath }: Props) => (
  <div className="json-tree">
    <JsonNode data={data} path="$" keyHint="" onPickLeaf={onPickLeaf} onPickBranch={onPickBranch} activePath={activePath} depth={0} />
  </div>
);
