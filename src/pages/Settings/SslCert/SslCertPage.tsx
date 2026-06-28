import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Shield, Lock, RefreshCw, Upload, Trash2 } from 'lucide-react';
import api from '../../../api';
import './SslCertPage.css';

interface SslInfo {
  enabled:      boolean;
  cert_type:    string | null;
  domain:       string | null;
  https_port:   number;
  cert_subject: string | null;
  cert_issuer:  string | null;
  cert_expiry:  string | null;
  installed_at: string | null;
}

type Format = 'pem' | 'pkcs12';

export const SslCertPage = () => {
  const { t } = useTranslation();

  const [info, setInfo]           = useState<SslInfo | null>(null);
  const [format, setFormat]       = useState<Format>('pem');
  const [certType, setCertType]   = useState('self_signed');
  const [domain, setDomain]       = useState('');
  const [httpsPort, setHttpsPort] = useState(3443);
  const [certFile, setCertFile]   = useState<File | null>(null);
  const [keyFile, setKeyFile]     = useState<File | null>(null);
  const [p12File, setP12File]     = useState<File | null>(null);
  const [p12Pass, setP12Pass]     = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');
  const [restarting, setRestarting]   = useState(false);
  const [restartMode, setRestartMode] = useState<'install' | 'remove'>('install');
  const [countdown, setCountdown]    = useState(20);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const certInputRef = useRef<HTMLInputElement>(null);
  const keyInputRef  = useRef<HTMLInputElement>(null);
  const p12InputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.get<SslInfo>('/ssl/info').then(r => {
      setInfo(r.data);
      if (r.data.domain) setDomain(r.data.domain);
      if (r.data.https_port) setHttpsPort(r.data.https_port);
    }).catch(() => setInfo({ enabled: false, cert_type: null, domain: null, https_port: 3443, cert_subject: null, cert_issuer: null, cert_expiry: null, installed_at: null }));
  }, []);

  // Countdown timer while server restarts
  useEffect(() => {
    if (!restarting) return;
    if (countdown <= 0) {
      const host = window.location.hostname;
      if (restartMode === 'install') {
        window.location.href = `https://${host}:${httpsPort}`;
      } else {
        window.location.href = `http://${host}:3000`;
      }
      return;
    }
    const id = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(id);
  }, [restarting, countdown]);

  const handleInstall = async () => {
    setError('');
    if (format === 'pem' && (!certFile || !keyFile)) {
      setError(t('ssl_error_invalid_cert'));
      return;
    }
    if (format === 'pkcs12' && !p12File) {
      setError(t('ssl_error_bad_pkcs12'));
      return;
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('certType', certType);
      fd.append('domain', domain);
      fd.append('httpsPort', String(httpsPort));
      if (format === 'pem') {
        fd.append('certFile', certFile!);
        fd.append('keyFile', keyFile!);
      } else {
        fd.append('p12File', p12File!);
        fd.append('p12Password', p12Pass);
      }
      await api.post('/ssl/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRestartMode('install');
      setCountdown(20);
      setRestarting(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data || '';
      setError(String(msg) || t('ssl_error_invalid_cert'));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    setConfirmRemove(false);
    setBusy(true);
    setError('');
    try {
      await api.delete('/ssl');
      setRestartMode('remove');
      setCountdown(20);
      setRestarting(true);
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.response?.data || '';
      setError(String(msg) || 'Failed to remove certificate');
    } finally {
      setBusy(false);
    }
  };

  // ── Restart overlay ──────────────────────────────────────────────────────
  if (restarting) {
    const msg = restartMode === 'install' ? t('ssl_restarting_msg') : t('ssl_removing_msg');
    return (
      <div className="ssl-restart-overlay">
        <div className="ssl-restart-box">
          <RefreshCw size={36} className="ssl-restart-icon icon-spin" />
          <h2 className="ssl-restart-title">{t('ssl_restarting_title')}</h2>
          <p className="ssl-restart-msg">{msg}</p>
          <p className="ssl-restart-countdown">
            {t('ssl_redirect_seconds')} <strong>{countdown}</strong> {t('ssl_redirect_seconds_unit')}
          </p>
          {restartMode === 'install' && (
            <p className="ssl-restart-note">{t('ssl_docker_note')}</p>
          )}
          <a
            className="ssl-restart-manual"
            href={restartMode === 'install' ? `https://${window.location.hostname}:${httpsPort}` : `http://${window.location.hostname}:3000`}
          >
            {restartMode === 'install' ? `Open https://${window.location.hostname}:${httpsPort}` : `Open http://${window.location.hostname}:3000`}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="ssl-page">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="ssl-header">
        <div className="ssl-header-icon">
          <Lock size={20} />
        </div>
        <div>
          <h1 className="ssl-title">{t('ssl_title')}</h1>
          <p className="ssl-subtitle">{t('ssl_desc')}</p>
        </div>
      </div>

      {/* ── Current certificate info ─────────────────────────────── */}
      <div className="ssl-card">
        <div className="ssl-status-row">
          <span className="ssl-label">{t('ssl_status_label')}</span>
          <span className={`ssl-badge ${info?.enabled ? 'ssl-badge--active' : 'ssl-badge--inactive'}`}>
            <Shield size={12} />
            {info?.enabled ? t('ssl_status_enabled') : t('ssl_status_disabled')}
          </span>
        </div>

        {info?.enabled && (
          <div className="ssl-cert-info">
            <h3 className="ssl-cert-info-title">{t('ssl_cert_info_title')}</h3>
            <table className="ssl-cert-table">
              <tbody>
                {info.cert_subject && (
                  <tr><td className="ssl-cert-key">{t('ssl_cert_subject')}</td><td className="ssl-cert-val">{info.cert_subject}</td></tr>
                )}
                {info.cert_issuer && (
                  <tr><td className="ssl-cert-key">{t('ssl_cert_issuer')}</td><td className="ssl-cert-val">{info.cert_issuer}</td></tr>
                )}
                {info.cert_expiry && (
                  <tr><td className="ssl-cert-key">{t('ssl_cert_expiry')}</td><td className="ssl-cert-val">{info.cert_expiry}</td></tr>
                )}
                {info.domain && (
                  <tr><td className="ssl-cert-key">{t('ssl_cert_domain')}</td><td className="ssl-cert-val">{info.domain}</td></tr>
                )}
                <tr><td className="ssl-cert-key">{t('ssl_port_label')}</td><td className="ssl-cert-val">{info.https_port}</td></tr>
                {info.installed_at && (
                  <tr><td className="ssl-cert-key">{t('ssl_installed_label')}</td><td className="ssl-cert-val">{info.installed_at}</td></tr>
                )}
              </tbody>
            </table>

            {/* Remove */}
            {!confirmRemove ? (
              <button className="ssl-btn ssl-btn--danger" onClick={() => setConfirmRemove(true)} disabled={busy}>
                <Trash2 size={14} /> {t('ssl_remove_btn')}
              </button>
            ) : (
              <div className="ssl-confirm-row">
                <p className="ssl-confirm-text">{t('ssl_remove_confirm')}</p>
                <button className="ssl-btn ssl-btn--danger" onClick={handleRemove} disabled={busy}>
                  {t('ssl_remove_btn')}
                </button>
                <button className="ssl-btn ssl-btn--ghost" onClick={() => setConfirmRemove(false)}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Install / Replace form ───────────────────────────────── */}
      <div className="ssl-card">
        {info?.enabled && (
          <p className="ssl-replace-note">{t('ssl_install_replace_note')}</p>
        )}

        {/* Format toggle */}
        <div>
          <span className="ssl-label">{t('ssl_format_label')}</span>
          <div className="ssl-toggle-group">
            <button className={`ssl-toggle-btn ${format === 'pem' ? 'ssl-toggle-btn--active' : ''}`} onClick={() => setFormat('pem')}>
              {t('ssl_format_pem')}
            </button>
            <button className={`ssl-toggle-btn ${format === 'pkcs12' ? 'ssl-toggle-btn--active' : ''}`} onClick={() => setFormat('pkcs12')}>
              {t('ssl_format_pkcs12')}
            </button>
          </div>
        </div>

        {/* PEM fields */}
        {format === 'pem' && (
          <>
            <div className="ssl-field">
              <label className="ssl-label">{t('ssl_cert_file_label')}</label>
              <div className="ssl-file-row">
                <span className="ssl-file-name">{certFile?.name ?? '—'}</span>
                <button className="ssl-btn ssl-btn--outline" onClick={() => certInputRef.current?.click()}>
                  <Upload size={13} /> Browse
                </button>
                <input ref={certInputRef} type="file" accept=".pem,.crt,.cer" hidden onChange={e => setCertFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="ssl-field">
              <label className="ssl-label">{t('ssl_key_file_label')}</label>
              <div className="ssl-file-row">
                <span className="ssl-file-name">{keyFile?.name ?? '—'}</span>
                <button className="ssl-btn ssl-btn--outline" onClick={() => keyInputRef.current?.click()}>
                  <Upload size={13} /> Browse
                </button>
                <input ref={keyInputRef} type="file" accept=".pem,.key" hidden onChange={e => setKeyFile(e.target.files?.[0] ?? null)} />
              </div>
            </div>
          </>
        )}

        {/* PKCS12 fields */}
        {format === 'pkcs12' && (
          <>
            <div className="ssl-field">
              <label className="ssl-label">{t('ssl_p12_file_label')}</label>
              <div className="ssl-file-row">
                <span className="ssl-file-name">{p12File?.name ?? '—'}</span>
                <button className="ssl-btn ssl-btn--outline" onClick={() => p12InputRef.current?.click()}>
                  <Upload size={13} /> Browse
                </button>
                <input ref={p12InputRef} type="file" accept=".p12,.pfx" hidden onChange={e => setP12File(e.target.files?.[0] ?? null)} />
              </div>
            </div>
            <div className="ssl-field">
              <label className="ssl-label">{t('ssl_p12_password_label')}</label>
              <input
                type="password"
                className="ssl-input"
                value={p12Pass}
                onChange={e => setP12Pass(e.target.value)}
                placeholder="(leave blank if no password)"
                autoComplete="off"
              />
            </div>
          </>
        )}

        {/* Cert type */}
        <div className="ssl-field">
          <label className="ssl-label">{t('ssl_cert_type_label')}</label>
          <select className="ssl-select" value={certType} onChange={e => setCertType(e.target.value)}>
            <option value="self_signed">{t('ssl_cert_type_self')}</option>
            <option value="public">{t('ssl_cert_type_public')}</option>
          </select>
        </div>

        {/* Domain */}
        <div className="ssl-field">
          <label className="ssl-label">{t('ssl_domain_label')}</label>
          <input
            type="text"
            className="ssl-input"
            value={domain}
            onChange={e => setDomain(e.target.value)}
            placeholder="e.g. tickets.example.com or localhost"
          />
        </div>

        {/* HTTPS port */}
        <div className="ssl-field">
          <label className="ssl-label">{t('ssl_https_port_label')}</label>
          <input
            type="number"
            className="ssl-input ssl-input--narrow"
            value={httpsPort}
            min={1}
            max={65535}
            onChange={e => setHttpsPort(Number(e.target.value))}
          />
        </div>

        {error && <p className="ssl-error">{error}</p>}

        <button className="ssl-btn ssl-btn--primary" onClick={handleInstall} disabled={busy}>
          {busy ? <RefreshCw size={14} className="icon-spin" /> : <Lock size={14} />}
          {t('ssl_install_btn')}
        </button>
      </div>
    </div>
  );
};
