import { useTranslation } from 'react-i18next';
import './FieldManager.css'; // Make sure this is imported

interface FieldEntityListProps {
  onSelectEntity: (entity: string) => void;
}

export const FieldEntityList = ({ onSelectEntity }: FieldEntityListProps) => {
  const { t } = useTranslation();

  // We only have 'user' for now as requested
  const entities = [
    { key: 'user', label: t('entity_users'), icon: '👤' }
  ];

  return (
    <div className="entity-selection-container">
      <h3 className="entity-title">{t('select_entity_to_manage')}</h3>
      <div className="entity-grid">
        {entities.map((item) => (
          <div 
            key={item.key} 
            className="entity-card" 
            onClick={() => onSelectEntity(item.key)}
          >
            <div className="entity-icon-wrapper">{item.icon}</div>
            <span className="entity-text">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};