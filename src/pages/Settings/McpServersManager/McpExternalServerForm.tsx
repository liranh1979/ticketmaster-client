import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ExternalLink, CheckCircle2 } from 'lucide-react';
import { SecretInput } from '../TicketsTemplates/ExternalApiCallsEditor';
import type { McpServer } from './McpServersPage';
import api from '../../../api';
import '../TicketsTemplates/WorkflowDesignerModal.css';
import './McpServersPage.css';

type AuthType = 'none' | 'bearer' | 'api_key' | 'basic' | 'oauth2_client_credentials' | 'oauth2_authorization_code';

interface Props {
  mode: 'create' | 'edit';
  server?: McpServer;
  onClose: () => void;
  onSaved: () => void;
}

/** Registers an existing remote MCP server (e.g. https://mcpservers.org/remote-mcp-servers/booking)
 * as a saved, reusable connection — no AI generation, no local process, just "here's the URL and
 * how to authenticate to it." A single form, not a multi-step wizard, since there's no design/
 * generate/deploy pipeline to walk through. Gated on MANAGE_FIELDS only (see McpServersPage) —
 * anyone who can build a template can register the external server it needs to call. */
export const McpExternalServerForm = ({ mode, server, onClose, onSaved }: Props) => {
  const { t } = useTranslation();
  const [id, setId] = useState<number | undefined>(server?.id);
  const [name, setName] = useState(server?.name ?? '');
  const [description, setDescription] = useState(server?.description ?? '');
  const [serverUrl, setServerUrl] = useState(server?.server_url ?? '');
  const [authType, setAuthType] = useState<AuthType>((server?.connection_auth_type as AuthType) ?? 'none');
  const [headerName, setHeaderName] = useState(server?.connection_auth_header_name ?? '');
  const [token, setToken] = useState<string | undefined>(undefined);
  const [hasToken, setHasToken] = useState(!!server && authType !== 'none' && authType !== 'oauth2_authorization_code' && authType !== 'oauth2_client_credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState<string | undefined>(undefined);
  const [hasPassword, setHasPassword] = useState(!!server && authType === 'basic');
  const [oauth2AuthorizeUrl, setOauth2AuthorizeUrl] = useState(server?.oauth2_authorize_url ?? '');
  const [oauth2TokenUrl, setOauth2TokenUrl] = useState(server?.oauth2_token_url ?? '');
  const [oauth2ClientId, setOauth2ClientId] = useState(server?.oauth2_client_id ?? '');
  const [oauth2ClientSecret, setOauth2ClientSecret] = useState<string | undefined>(undefined);
  const [hasClientSecret, setHasClientSecret] = useState(!!server && authType.startsWith('oauth2'));
  const [oauth2Scope, setOauth2Scope] = useState(server?.oauth2_scope ?? '');
  const [oauth2Authorized] = useState(!!server?.oauth2_authorized);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  const buildAuthPayload = () => {
    const auth: Record<string, any> = { type: authType };
    if (authType === 'api_key') { auth.header_name = headerName; if (token !== undefined) auth.token = token; }
    if (authType === 'bearer') { if (token !== undefined) auth.token = token; }
    if (authType === 'basic') {
      auth.username = username;
      if (password !== undefined) auth.password = password;
    }
    if (authType === 'oauth2_client_credentials' || authType === 'oauth2_authorization_code') {
      if (authType === 'oauth2_authorization_code') auth.oauth2_authorize_url = oauth2AuthorizeUrl;
      auth.oauth2_token_url = oauth2TokenUrl;
      auth.oauth2_client_id = oauth2ClientId;
      if (oauth2ClientSecret !== undefined) auth.oauth2_client_secret = oauth2ClientSecret;
      auth.oauth2_scope = oauth2Scope;
    }
    return auth;
  };

  const handleSave = async () => {
    if (!name.trim()) { setError(t('mcp_external_name_required', { defaultValue: 'Name is required' }) as string); return; }
    if (!serverUrl.trim()) { setError(t('mcp_external_url_required', { defaultValue: 'Server URL is required' }) as string); return; }
    setSaving(true);
    setError('');
    try {
      const payload = { name, description, server_url: serverUrl, auth: buildAuthPayload() };
      if (id) {
        await api.patch(`/mcp-servers/external/${id}`, payload);
        onSaved();
      } else {
        const res = await api.post<McpServer>('/mcp-servers/external', payload);
        if (authType === 'oauth2_authorization_code') {
          // Stay on the form so "Authorize" (which needs a real id) becomes available immediately.
          setId(res.data.id);
        } else {
          onSaved();
        }
      }
      setToken(undefined);
      setPassword(undefined);
      setOauth2ClientSecret(undefined);
      setHasToken(authType !== 'none');
      setHasPassword(authType === 'basic');
      setHasClientSecret(authType.startsWith('oauth2'));
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mcp_action_failed', { defaultValue: 'Action failed.' }) as string);
    } finally {
      setSaving(false);
    }
  };

  const handleAuthorize = async () => {
    if (!id) return;
    try {
      const res = await api.get<{ authUrl: string }>(`/mcp-servers/external/${id}/oauth2/authorize`);
      window.open(res.data.authUrl, '_blank', 'width=600,height=700');
    } catch (err: any) {
      setError(err?.response?.data?.message || t('mcp_action_failed', { defaultValue: 'Action failed.' }) as string);
    }
  };

  const handleTest = async () => {
    if (!id) {
      setError(t('mcp_external_save_before_test', { defaultValue: 'Save the server first, then test the connection.' }) as string);
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      await api.post(`/mcp-servers/external/${id}/test`);
      setTestResult({ ok: true, message: t('mcp_external_test_ok', { defaultValue: 'Connected — tools discovered successfully.' }) as string });
    } catch (err: any) {
      setTestResult({ ok: false, message: err?.response?.data?.message || t('mcp_action_failed', { defaultValue: 'Action failed.' }) as string });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mcp-page">
      <header className="mcp-page-head">
        <div className="mcp-page-title-row">
          <button className="mcp-icon-btn" onClick={onClose}><ArrowLeft size={14} /></button>
          <div>
            <h2 className="mcp-page-title">
              {mode === 'edit'
                ? t('mcp_external_form_title_edit', { defaultValue: 'Edit External MCP Server' })
                : t('mcp_external_form_title', { defaultValue: 'Connect External MCP Server' })}
            </h2>
            <p className="mcp-page-sub">{t('mcp_new_server_external_option_desc', { defaultValue: 'Register an existing remote MCP server you already have a URL for.' })}</p>
          </div>
        </div>
      </header>

      <div className="wfd-sec">
        <div className="wfd-sec-lbl">{t('mcp_external_name_label', { defaultValue: 'Name' })}</div>
        <input className="wfd-inp" value={name} onChange={e => setName(e.target.value)} />
      </div>

      <div className="wfd-sec">
        <div className="wfd-sec-lbl">{t('mcp_external_description_label', { defaultValue: 'Description' })}</div>
        <input className="wfd-inp" value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      <div className="wfd-sec">
        <div className="wfd-sec-lbl">{t('mcp_external_server_url_label', { defaultValue: 'Server URL' })}</div>
        <input className="wfd-inp" value={serverUrl} onChange={e => setServerUrl(e.target.value)} placeholder="https://mcp.example.com" />
      </div>

      <div className="wfd-sec">
        <div className="wfd-sec-lbl">{t('mcp_external_auth_type_label', { defaultValue: 'Authentication' })}</div>
        <select className="wfd-sel" value={authType} onChange={e => setAuthType(e.target.value as AuthType)}>
          <option value="none">{t('mcp_auth_type_none', { defaultValue: 'None' })}</option>
          <option value="bearer">{t('mcp_auth_type_bearer', { defaultValue: 'Bearer token' })}</option>
          <option value="api_key">{t('mcp_auth_type_api_key', { defaultValue: 'API key header' })}</option>
          <option value="basic">{t('mcp_auth_type_basic', { defaultValue: 'Basic (username/password)' })}</option>
          <option value="oauth2_client_credentials">{t('mcp_auth_type_oauth2_client_credentials', { defaultValue: 'OAuth2 — Client Credentials (unattended)' })}</option>
          <option value="oauth2_authorization_code">{t('mcp_auth_type_oauth2_authorization_code', { defaultValue: 'OAuth2 — Sign in (user-delegated)' })}</option>
        </select>
      </div>

      {authType === 'bearer' && (
        <div className="wfd-sec">
          <SecretInput label={t('mcp_external_token_label', { defaultValue: 'Token' }) as string} hasValue={hasToken} value={token} onChange={setToken} />
        </div>
      )}

      {authType === 'api_key' && (
        <>
          <div className="wfd-sec">
            <div className="wfd-sec-lbl">{t('mcp_external_header_name_label', { defaultValue: 'Header name (default X-API-Key)' })}</div>
            <input className="wfd-inp" value={headerName} onChange={e => setHeaderName(e.target.value)} placeholder="X-API-Key" />
          </div>
          <div className="wfd-sec">
            <SecretInput label={t('mcp_external_token_label', { defaultValue: 'Token' }) as string} hasValue={hasToken} value={token} onChange={setToken} />
          </div>
        </>
      )}

      {authType === 'basic' && (
        <>
          <div className="wfd-sec">
            <div className="wfd-sec-lbl">{t('mcp_external_username_label', { defaultValue: 'Username' })}</div>
            <input className="wfd-inp" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="wfd-sec">
            <SecretInput label={t('mcp_external_password_label', { defaultValue: 'Password' }) as string} hasValue={hasPassword} value={password} onChange={setPassword} />
          </div>
        </>
      )}

      {(authType === 'oauth2_client_credentials' || authType === 'oauth2_authorization_code') && (
        <>
          {authType === 'oauth2_authorization_code' && (
            <div className="wfd-sec">
              <div className="wfd-sec-lbl">{t('mcp_external_oauth2_authorize_url_label', { defaultValue: 'Authorize URL' })}</div>
              <input className="wfd-inp" value={oauth2AuthorizeUrl} onChange={e => setOauth2AuthorizeUrl(e.target.value)} placeholder="https://provider.example.com/oauth2/authorize" />
            </div>
          )}
          <div className="wfd-sec">
            <div className="wfd-sec-lbl">{t('mcp_external_oauth2_token_url_label', { defaultValue: 'Token URL' })}</div>
            <input className="wfd-inp" value={oauth2TokenUrl} onChange={e => setOauth2TokenUrl(e.target.value)} placeholder="https://provider.example.com/oauth2/token" />
          </div>
          <div className="wfd-sec">
            <div className="wfd-sec-lbl">{t('mcp_external_oauth2_client_id_label', { defaultValue: 'Client ID' })}</div>
            <input className="wfd-inp" value={oauth2ClientId} onChange={e => setOauth2ClientId(e.target.value)} />
          </div>
          <div className="wfd-sec">
            <SecretInput label={t('mcp_external_oauth2_client_secret_label', { defaultValue: 'Client secret' }) as string} hasValue={hasClientSecret} value={oauth2ClientSecret} onChange={setOauth2ClientSecret} />
          </div>
          <div className="wfd-sec">
            <div className="wfd-sec-lbl">{t('mcp_external_oauth2_scope_label', { defaultValue: 'Scope' })}</div>
            <input className="wfd-inp" value={oauth2Scope} onChange={e => setOauth2Scope(e.target.value)} placeholder="read write" />
          </div>

          {authType === 'oauth2_authorization_code' && (
            <div className="wfd-sec">
              {id ? (
                <div className="mcp-oauth-row">
                  <button className="mcp-btn" onClick={handleAuthorize}>
                    <ExternalLink size={13} /> {t('mcp_external_oauth2_authorize_btn', { defaultValue: 'Authorize' })}
                  </button>
                  <span className={`mcp-oauth-status${oauth2Authorized ? ' mcp-oauth-status-ok' : ''}`}>
                    {oauth2Authorized
                      ? <><CheckCircle2 size={13} /> {t('mcp_external_oauth2_authorized_label', { defaultValue: 'Authorized' })}</>
                      : t('mcp_external_oauth2_not_authorized_label', { defaultValue: 'Not authorized yet — click Authorize' })}
                  </span>
                </div>
              ) : (
                <p className="wfd-hint-xs">{t('mcp_external_save_before_authorize', { defaultValue: 'Save the server first (with a token URL and client ID), then click Authorize.' })}</p>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="mte-error">{error}</p>}
      {testResult && <p className={testResult.ok ? 'mcp-test-ok' : 'mte-error'}>{testResult.message}</p>}

      <div className="mcp-form-actions">
        <button className="mcp-btn" onClick={handleTest} disabled={testing || !id}>
          {t('mcp_external_test_btn', { defaultValue: 'Test Connection' })}
        </button>
        <button className="mcp-btn mcp-btn-primary" onClick={handleSave} disabled={saving}>
          {t('mcp_external_save_btn', { defaultValue: 'Save Server' })}
        </button>
      </div>
    </div>
  );
};
