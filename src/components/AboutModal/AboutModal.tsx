import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import api from '../../api';
import './AboutModal.css';

interface Props {
  onClose: () => void;
}

export const AboutModal = ({ onClose }: Props) => {
  const { t } = useTranslation();
  const [version, setVersion] = useState<string>('...');

  useEffect(() => {
    api.get<{ server_version: string }>('/about')
      .then(r => setVersion(r.data.server_version))
      .catch(() => setVersion('—'));
  }, []);

  return (
    <div className="about-overlay" onClick={onClose}>
      <div className="about-modal" onClick={e => e.stopPropagation()}>
        <button className="about-modal__close" onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2} />
        </button>

        <div className="about-modal__header">
          <span className="about-modal__logo">🎫</span>
          <div>
            <h2 className="about-modal__title">{t('about_title')}</h2>
            <p className="about-modal__tagline">{t('about_tagline')}</p>
          </div>
        </div>

        <div className="about-modal__body">
          <div className="about-modal__row">
            <span className="about-modal__label">{t('about_version_label')}</span>
            <span className="about-modal__badge">v{version}</span>
          </div>

          <p className="about-modal__desc">{t('about_desc')}</p>

          <div className="about-modal__row">
            <span className="about-modal__label">{t('about_tech_label')}</span>
            <span className="about-modal__tech">{t('about_tech_value')}</span>
          </div>
        </div>

        <div className="about-modal__footer">
          <span className="about-modal__copyright">{t('about_copyright')}</span>
          <button className="about-modal__close-btn" onClick={onClose}>
            {t('about_close_btn')}
          </button>
        </div>
      </div>
    </div>
  );
};
