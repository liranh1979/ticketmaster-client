import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, CheckCircle2 } from 'lucide-react';
import api from '../../../api';
import './SetupGuidePage.css';

interface SetupStatus {
  ai_configured:       boolean;
  template_configured: boolean;
  email_configured:    boolean;
  users_configured:    boolean;
  sso_configured:      boolean;
  ssl_configured:      boolean;
}

interface SetupGuidePageProps {
  onNavigate: (view: string) => void;
}

interface StepCardProps {
  index:      number;
  icon:       string;
  title:      string;
  configured: boolean;
  optional?:  boolean;
  open:       boolean;
  onToggle:   () => void;
  children:   React.ReactNode;
}

const StepCard = ({ index, icon, title, configured, optional, open, onToggle, children }: StepCardProps) => {
  const { t } = useTranslation();
  return (
    <div className={`sg-card ${configured ? 'sg-card--done' : ''}`}>
      <div className="sg-card-header" onClick={onToggle}>
        <span className="sg-card-index">{index}</span>
        <span className="sg-card-icon">{icon}</span>
        <span className="sg-card-title">{title}</span>
        <span className={`sg-badge ${configured ? 'sg-badge--done' : optional ? 'sg-badge--optional' : 'sg-badge--pending'}`}>
          {configured ? t('setup_status_done') : optional ? t('setup_status_optional') : t('setup_status_pending')}
        </span>
        <ChevronDown className={`sg-chevron ${open ? 'sg-chevron--open' : ''}`} size={18} />
      </div>
      {open && <div className="sg-card-body">{children}</div>}
    </div>
  );
};

const Steps = ({ items }: { items: string[] }) => (
  <ol className="sg-steps">
    {items.map((text, i) => (
      <li key={i} className="sg-step-item">
        <span className="sg-step-num">{i + 1}</span>
        <span className="sg-step-text">{text}</span>
      </li>
    ))}
  </ol>
);

const NavBtn = ({ label, onClick, secondary }: { label: string; onClick: () => void; secondary?: boolean }) => (
  <button className={`sg-nav-btn ${secondary ? 'sg-nav-btn--secondary' : ''}`} onClick={onClick}>
    {label} →
  </button>
);

const SubHeading = ({ text }: { text: string }) => (
  <p className="sg-sub-heading">{text}</p>
);

export const SetupGuidePage = ({ onNavigate }: SetupGuidePageProps) => {
  const { t } = useTranslation();
  const [status, setStatus]   = useState<SetupStatus | null>(null);
  const [openStep, setOpenStep] = useState<number | null>(0);

  useEffect(() => {
    api.get<SetupStatus>('/setup/status')
      .then(r => setStatus(r.data))
      .catch(() => {});
  }, []);

  const toggle = (i: number) => setOpenStep(prev => (prev === i ? null : i));

  const s = status;
  const requiredDone = [s?.ai_configured, s?.template_configured, s?.email_configured, s?.users_configured].filter(Boolean).length;
  const totalRequired = 4;
  const pct = Math.round((requiredDone / totalRequired) * 100);

  return (
    <div className="sg-page">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="sg-header">
        <h1 className="sg-title">{t('setup_guide_title')}</h1>
        <p className="sg-subtitle">{t('setup_guide_subtitle')}</p>

        <div className="sg-progress-wrap">
          <div className="sg-progress-bar">
            <div className="sg-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="sg-progress-label">
            {t('setup_guide_progress', { done: requiredDone, total: totalRequired })}
          </span>
        </div>
      </div>

      {/* ── Step 1: AI Provider ───────────────────────────────── */}
      <StepCard
        index={1} icon="🤖"
        title={t('setup_ai_title')}
        configured={!!s?.ai_configured}
        open={openStep === 0}
        onToggle={() => toggle(0)}
      >
        <p className="sg-desc">{t('setup_ai_desc')}</p>
        <Steps items={[
          t('setup_ai_s1'), t('setup_ai_s2'), t('setup_ai_s3'),
          t('setup_ai_s4'), t('setup_ai_s5'),
        ]} />
        <div className="sg-btn-row">
          <NavBtn label={t('setup_ai_btn')} onClick={() => onNavigate('ai-manager')} />
        </div>
      </StepCard>

      {/* ── Step 2: Custom Fields + Template ─────────────────── */}
      <StepCard
        index={2} icon="🎫"
        title={t('setup_template_title')}
        configured={!!s?.template_configured}
        open={openStep === 1}
        onToggle={() => toggle(1)}
      >
        <p className="sg-desc">{t('setup_template_desc')}</p>

        <SubHeading text={t('setup_template_part_a')} />
        <Steps items={[
          t('setup_template_a_s1'), t('setup_template_a_s2'), t('setup_template_a_s3'),
          t('setup_template_a_s4'), t('setup_template_a_s5'),
        ]} />
        <div className="sg-btn-row">
          <NavBtn label={t('setup_template_btn_fields')} onClick={() => onNavigate('ticket-custom-fields')} />
        </div>

        <SubHeading text={t('setup_template_part_b')} />
        <Steps items={[
          t('setup_template_b_s1'), t('setup_template_b_s2'), t('setup_template_b_s3'),
          t('setup_template_b_s4'), t('setup_template_b_s5'),
        ]} />
        <div className="sg-btn-row">
          <NavBtn label={t('setup_template_btn_tpl')} onClick={() => onNavigate('tickets-templates')} />
        </div>
      </StepCard>

      {/* ── Step 3: Email Integration ─────────────────────────── */}
      <StepCard
        index={3} icon="✉️"
        title={t('setup_email_title')}
        configured={!!s?.email_configured}
        open={openStep === 2}
        onToggle={() => toggle(2)}
      >
        <p className="sg-desc">{t('setup_email_desc')}</p>
        <Steps items={[
          t('setup_email_s1'), t('setup_email_s2'), t('setup_email_s3'),
          t('setup_email_s4'), t('setup_email_s5'), t('setup_email_s6'),
          t('setup_email_s7'),
        ]} />
        <div className="sg-btn-row">
          <NavBtn label={t('setup_email_btn')} onClick={() => onNavigate('email-manager')} />
        </div>
      </StepCard>

      {/* ── Step 4: Add Users ─────────────────────────────────── */}
      <StepCard
        index={4} icon="👥"
        title={t('setup_users_title')}
        configured={!!s?.users_configured}
        open={openStep === 3}
        onToggle={() => toggle(3)}
      >
        <p className="sg-desc">{t('setup_users_desc')}</p>

        <SubHeading text={t('setup_users_opt_a')} />
        <Steps items={[
          t('setup_users_a_s1'), t('setup_users_a_s2'),
          t('setup_users_a_s3'), t('setup_users_a_s4'),
        ]} />
        <div className="sg-btn-row">
          <NavBtn label={t('setup_users_btn_manual')} onClick={() => onNavigate('users-groups-hub')} />
        </div>

        <SubHeading text={t('setup_users_opt_b')} />
        <Steps items={[t('setup_users_b_s1'), t('setup_users_b_s2'), t('setup_users_b_s3')]} />

        <SubHeading text={t('setup_users_opt_c')} />
        <Steps items={[t('setup_users_c_s1'), t('setup_users_c_s2'), t('setup_users_c_s3')]} />

        <div className="sg-btn-row">
          <NavBtn label={t('setup_users_btn_ext')} onClick={() => onNavigate('users-groups-hub')} secondary />
        </div>
      </StepCard>

      {/* ── Step 5: SSO Login (optional) ─────────────────────── */}
      <StepCard
        index={5} icon="🔐"
        title={t('setup_sso_title')}
        configured={!!s?.sso_configured}
        optional
        open={openStep === 4}
        onToggle={() => toggle(4)}
      >
        <p className="sg-desc">{t('setup_sso_desc')}</p>
        <p className="sg-prereq">ℹ️ {t('setup_sso_prereq')}</p>
        <Steps items={[
          t('setup_sso_s1'), t('setup_sso_s2'), t('setup_sso_s3'),
          t('setup_sso_s4'), t('setup_sso_s5'), t('setup_sso_s6'),
          t('setup_sso_s7'),
        ]} />
        <div className="sg-btn-row">
          <NavBtn label={t('setup_sso_btn')} onClick={() => onNavigate('users-groups-hub')} />
        </div>
      </StepCard>

      {/* ── Step 6: SSL / TLS Certificate (optional) ─────────── */}
      <StepCard
        index={6} icon="🔒"
        title={t('setup_ssl_title')}
        configured={!!s?.ssl_configured}
        optional
        open={openStep === 5}
        onToggle={() => toggle(5)}
      >
        <p className="sg-desc">{t('setup_ssl_desc')}</p>
        <Steps items={[
          t('setup_ssl_s1'), t('setup_ssl_s2'),
          t('setup_ssl_s3'), t('setup_ssl_s4'),
        ]} />
        <div className="sg-btn-row">
          <NavBtn label={t('setup_ssl_btn')} onClick={() => onNavigate('ssl-manager')} />
        </div>
      </StepCard>

      {/* ── All done banner ───────────────────────────────────── */}
      {requiredDone === totalRequired && (
        <div className="sg-done-banner">
          <CheckCircle2 size={22} />
          <span>All required steps are configured — your system is ready!</span>
        </div>
      )}
    </div>
  );
};
