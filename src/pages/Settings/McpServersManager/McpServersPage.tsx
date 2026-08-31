import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Plug, Plus, Play, Square, RotateCw, Beaker, ScrollText, Pencil, Trash2, Sparkles, Globe2, Bot } from 'lucide-react';
import { McpServerWizard } from './McpServerWizard';
import { McpExternalServerForm } from './McpExternalServerForm';
import { hasPermission, isSuperAdmin, PERMISSIONS } from '../../../utils/permissions';
import api from '../../../api';
import './McpServersPage.css';

export interface McpServer {
  id: number;
  server_kind: 'generated' | 'external';
  name: string;
  description?: string;
  target_api_base_url?: string;
  port?: number;
  is_enabled: boolean;
  is_system: boolean;
  status: 'STOPPED' | 'STARTING' | 'RUNNING' | 'ERROR' | 'EXTERNAL';
  tool_count?: number;
  last_error?: string;
  // external-kind only
  server_url?: string;
  connection_auth_type?: string;
  connection_auth_header_name?: string;
  oauth2_client_id?: string;
  oauth2_authorize_url?: string;
  oauth2_token_url?: string;
  oauth2_scope?: string;
  oauth2_authorized?: boolean;
}

interface Props {
  user?: any;
}

export const McpServersPage = ({ user }: Props) => {
  const { t } = useTranslation();
  const [servers, setServers] = useState<McpServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [logsFor, setLogsFor] = useState<McpServer | null>(null);
  const [logsText, setLogsText] = useState('');
  const [showNewChoice, setShowNewChoice] = useState(false);

  // wizardMode: 'create' opens a fresh flow; 'edit'/'fix' reopen at the script-review step for
  // the given server (see McpServerWizard's mode prop). Built-in (generated) servers only.
  const [wizard, setWizard] = useState<{ mode: 'create' | 'edit' | 'fix'; server?: McpServer } | null>(null);
  // External servers use a much simpler single-page form, not the AI wizard.
  const [externalForm, setExternalForm] = useState<{ mode: 'create' | 'edit'; server?: McpServer } | null>(null);

  // Built-in (process-spawning) actions stay super-admin + MANAGE_MCP_SERVERS, exactly as before.
  // External (no-process) actions only need MANAGE_FIELDS — the same permission that already gates
  // building the templates/workflows that will call them.
  const canBuiltIn = isSuperAdmin(user) && hasPermission(user, PERMISSIONS.MANAGE_MCP_SERVERS);
  const canExternal = hasPermission(user, PERMISSIONS.MANAGE_FIELDS);

  const fetchAll = async () => {
    try {
      const res = await api.get<McpServer[]>('/mcp-servers');
      setServers(res.data);
    } catch (err) {
      console.error('Failed to load MCP servers', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const runAction = async (id: number, action: 'start' | 'stop' | 'restart' | 'test') => {
    setBusyId(id);
    try {
      await api.post(`/mcp-servers/${id}/${action}`);
      await fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.message || t('mcp_action_failed', { defaultValue: 'Action failed.' }));
    } finally {
      setBusyId(null);
    }
  };

  const runExternalTest = async (id: number) => {
    setBusyId(id);
    try {
      await api.post(`/mcp-servers/external/${id}/test`);
      alert(t('mcp_external_test_ok', { defaultValue: 'Connected — tools discovered successfully.' }));
    } catch (err: any) {
      alert(err?.response?.data?.message || t('mcp_action_failed', { defaultValue: 'Action failed.' }));
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleEnabled = async (server: McpServer) => {
    setBusyId(server.id);
    try {
      await api.patch(`/mcp-servers/${server.id}`, { is_enabled: !server.is_enabled });
      await fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.message || t('mcp_action_failed', { defaultValue: 'Action failed.' }));
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (server: McpServer) => {
    if (!window.confirm(t('mcp_confirm_delete', { defaultValue: `Delete "${server.name}"? This stops its process and removes it permanently.`, name: server.name }))) return;
    setBusyId(server.id);
    try {
      if (server.server_kind === 'external') {
        await api.delete(`/mcp-servers/external/${server.id}`);
      } else {
        await api.delete(`/mcp-servers/${server.id}`);
      }
      await fetchAll();
    } catch (err: any) {
      alert(err?.response?.data?.message || t('mcp_action_failed', { defaultValue: 'Action failed.' }));
    } finally {
      setBusyId(null);
    }
  };

  const handleShowLogs = async (server: McpServer) => {
    setLogsFor(server);
    setLogsText(t('mcp_logs_loading', { defaultValue: 'Loading…' }));
    try {
      const res = await api.get<{ logs: string }>(`/mcp-servers/${server.id}/logs`);
      setLogsText(res.data.logs || t('mcp_logs_empty', { defaultValue: '(no output yet)' }));
    } catch {
      setLogsText(t('mcp_logs_error', { defaultValue: 'Could not load logs.' }));
    }
  };

  const statusLabel = (s: McpServer['status']) => ({
    RUNNING: t('mcp_status_running', { defaultValue: 'Running' }),
    STOPPED: t('mcp_status_stopped', { defaultValue: 'Stopped' }),
    STARTING: t('mcp_status_starting', { defaultValue: 'Starting…' }),
    ERROR: t('mcp_status_error', { defaultValue: 'Error' }),
    EXTERNAL: t('mcp_server_kind_external', { defaultValue: 'External' }),
  }[s]);

  const handleNewClick = () => {
    if (canBuiltIn && canExternal) setShowNewChoice(true);
    else if (canBuiltIn) setWizard({ mode: 'create' });
    else if (canExternal) setExternalForm({ mode: 'create' });
  };

  if (loading) return <div className="p-4">{t('mcp_loading', { defaultValue: 'Loading MCP servers…' })}</div>;

  // Full-page wizard, not a dismissible overlay — a stray outside click must never silently
  // discard an in-progress AI-generated script the admin hasn't saved yet.
  if (wizard) {
    return (
      <McpServerWizard
        mode={wizard.mode}
        server={wizard.server}
        onClose={() => setWizard(null)}
        onSaved={() => { setWizard(null); fetchAll(); }}
      />
    );
  }

  if (externalForm) {
    return (
      <McpExternalServerForm
        mode={externalForm.mode}
        server={externalForm.server}
        onClose={() => setExternalForm(null)}
        onSaved={() => { setExternalForm(null); fetchAll(); }}
      />
    );
  }

  return (
    <div className="mcp-page">
      <header className="mcp-page-head">
        <div className="mcp-page-title-row">
          <div className="mcp-icon-box"><Plug size={17} /></div>
          <div>
            <h2 className="mcp-page-title">{t('mcp_servers_title', { defaultValue: 'MCP Servers' })}</h2>
            <p className="mcp-page-sub">{t('mcp_servers_sub', { defaultValue: 'Built-in servers an AI agent generates, or external servers you connect with their own authentication.' })}</p>
          </div>
        </div>
        {(canBuiltIn || canExternal) && (
          <button className="mcp-btn mcp-btn-primary" onClick={handleNewClick}>
            <Plus size={14} /> {t('mcp_new_server_btn', { defaultValue: 'New MCP Server' })}
          </button>
        )}
      </header>

      {canBuiltIn && !canExternal && (
        <div className="mcp-super-admin-note">
          🔒 {t('mcp_super_admin_note', { defaultValue: 'Built-in servers are visible to super-admins only — these run as real OS processes.' })}
        </div>
      )}

      {servers.length === 0 ? (
        <div className="mcp-empty">{t('mcp_no_servers', { defaultValue: 'No MCP servers yet.' })}</div>
      ) : (
        <table className="mcp-tbl">
          <thead>
            <tr>
              <th>{t('mcp_col_name', { defaultValue: 'Name' })}</th>
              <th>{t('mcp_col_kind', { defaultValue: 'Kind' })}</th>
              <th>{t('mcp_col_port', { defaultValue: 'Port / URL' })}</th>
              <th>{t('mcp_col_status', { defaultValue: 'Status' })}</th>
              <th>{t('mcp_col_tools', { defaultValue: 'Tools' })}</th>
              <th>{t('mcp_col_enabled', { defaultValue: 'Enabled' })}</th>
              <th style={{ textAlign: 'right' }}>{t('mcp_col_actions', { defaultValue: 'Actions' })}</th>
            </tr>
          </thead>
          <tbody>
            {servers.map(s => (
              <tr key={s.id}>
                <td>
                  <div className="mcp-name-cell">
                    <span className="mcp-name">{s.name}</span>
                    <span className="mcp-desc">{s.description || s.target_api_base_url || s.server_url}</span>
                  </div>
                </td>
                <td>
                  <span className={`mcp-kind-badge mcp-kind-${s.server_kind}`}>
                    {s.server_kind === 'external' ? <Globe2 size={11} /> : <Bot size={11} />}
                    {t(s.server_kind === 'external' ? 'mcp_server_kind_external' : 'mcp_server_kind_generated', { defaultValue: s.server_kind === 'external' ? 'External' : 'Built-in' })}
                  </span>
                </td>
                <td>
                  {s.server_kind === 'external'
                    ? <span className="mcp-url-chip" title={s.server_url}>{s.server_url}</span>
                    : <span className="mcp-port-chip">:{s.port}</span>}
                </td>
                <td>
                  <span className={`mcp-status mcp-status-${s.status.toLowerCase()}`}>
                    <span className="mcp-status-dot" />{statusLabel(s.status)}
                  </span>
                  {s.status === 'ERROR' && s.last_error && <div className="mcp-last-error" title={s.last_error}>{s.last_error}</div>}
                </td>
                <td>{s.tool_count ?? '—'}</td>
                <td>
                  {s.server_kind === 'external' ? '—' : (
                    <div
                      className={`mcp-toggle${s.is_enabled ? '' : ' mcp-toggle-off'}${canBuiltIn ? '' : ' mcp-toggle-disabled'}`}
                      onClick={() => (busyId || !canBuiltIn) ? undefined : handleToggleEnabled(s)}
                      role="switch"
                      aria-checked={s.is_enabled}
                    />
                  )}
                </td>
                <td>
                  <div className="mcp-row-actions">
                    {s.server_kind === 'external' ? (
                      canExternal && (
                        <>
                          <button className="mcp-icon-btn" title={t('mcp_external_test_btn', { defaultValue: 'Test Connection' }) as string}
                            onClick={() => runExternalTest(s.id)} disabled={busyId === s.id}>
                            <Beaker size={13} />
                          </button>
                          <button className="mcp-icon-btn" title={t('mcp_edit', { defaultValue: 'Edit' }) as string}
                            onClick={() => setExternalForm({ mode: 'edit', server: s })}>
                            <Pencil size={13} />
                          </button>
                          <button className="mcp-icon-btn mcp-icon-btn-danger" title={t('mcp_delete', { defaultValue: 'Delete' }) as string}
                            onClick={() => handleDelete(s)} disabled={busyId === s.id}>
                            <Trash2 size={13} />
                          </button>
                        </>
                      )
                    ) : canBuiltIn && (
                      <>
                        {s.status === 'ERROR' && (
                          <button className="mcp-icon-btn mcp-icon-btn-fix" title={t('mcp_fix_with_ai', { defaultValue: 'Fix with AI' }) as string}
                            onClick={() => setWizard({ mode: 'fix', server: s })} disabled={busyId === s.id}>
                            <Sparkles size={13} />
                          </button>
                        )}
                        {s.status === 'RUNNING' || s.status === 'STARTING' ? (
                          <button className="mcp-icon-btn" title={t('mcp_stop', { defaultValue: 'Stop' }) as string}
                            onClick={() => runAction(s.id, 'stop')} disabled={busyId === s.id}>
                            <Square size={13} />
                          </button>
                        ) : (
                          <button className="mcp-icon-btn" title={t('mcp_start', { defaultValue: 'Start' }) as string}
                            onClick={() => runAction(s.id, 'start')} disabled={busyId === s.id}>
                            <Play size={13} />
                          </button>
                        )}
                        <button className="mcp-icon-btn" title={t('mcp_restart', { defaultValue: 'Restart' }) as string}
                          onClick={() => runAction(s.id, 'restart')} disabled={busyId === s.id}>
                          <RotateCw size={13} />
                        </button>
                        <button className="mcp-icon-btn" title={t('mcp_test', { defaultValue: 'Test connection' }) as string}
                          onClick={() => runAction(s.id, 'test')} disabled={busyId === s.id}>
                          <Beaker size={13} />
                        </button>
                        <button className="mcp-icon-btn" title={t('mcp_logs', { defaultValue: 'Logs' }) as string}
                          onClick={() => handleShowLogs(s)}>
                          <ScrollText size={13} />
                        </button>
                        <button className="mcp-icon-btn" title={t('mcp_edit', { defaultValue: 'Edit script' }) as string}
                          onClick={() => setWizard({ mode: 'edit', server: s })}>
                          <Pencil size={13} />
                        </button>
                        {!s.is_system && (
                          <button className="mcp-icon-btn mcp-icon-btn-danger" title={t('mcp_delete', { defaultValue: 'Delete' }) as string}
                            onClick={() => handleDelete(s)} disabled={busyId === s.id}>
                            <Trash2 size={13} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {logsFor && (
        <div className="mcp-modal-overlay" onClick={() => setLogsFor(null)}>
          <div className="mcp-modal" onClick={e => e.stopPropagation()}>
            <div className="mcp-modal-head">
              <span>{t('mcp_logs_title', { defaultValue: 'Logs — {{name}}', name: logsFor.name })}</span>
              <button className="mcp-modal-close" onClick={() => setLogsFor(null)}>×</button>
            </div>
            <pre className="mcp-logs-pre">{logsText}</pre>
          </div>
        </div>
      )}

      {showNewChoice && (
        <div className="mcp-modal-overlay" onClick={() => setShowNewChoice(false)}>
          <div className="mcp-modal mcp-choice-modal" onClick={e => e.stopPropagation()}>
            <div className="mcp-modal-head">
              <span>{t('mcp_new_server_choice_title', { defaultValue: 'New MCP Server' })}</span>
              <button className="mcp-modal-close" onClick={() => setShowNewChoice(false)}>×</button>
            </div>
            <div className="mcp-choice-options">
              <button className="mcp-choice-opt" onClick={() => { setShowNewChoice(false); setWizard({ mode: 'create' }); }}>
                <Sparkles size={18} />
                <div>
                  <div className="mcp-choice-opt-title">{t('mcp_new_server_generate_option', { defaultValue: 'AI-Generate (Built-in)' })}</div>
                  <div className="mcp-choice-opt-desc">{t('mcp_new_server_generate_option_desc', { defaultValue: 'Describe a target API — the AI writes and runs a wrapper server for you.' })}</div>
                </div>
              </button>
              <button className="mcp-choice-opt" onClick={() => { setShowNewChoice(false); setExternalForm({ mode: 'create' }); }}>
                <Globe2 size={18} />
                <div>
                  <div className="mcp-choice-opt-title">{t('mcp_new_server_external_option', { defaultValue: 'Connect External Server' })}</div>
                  <div className="mcp-choice-opt-desc">{t('mcp_new_server_external_option_desc', { defaultValue: 'Register an existing remote MCP server you already have a URL for.' })}</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
