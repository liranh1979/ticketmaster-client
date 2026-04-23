import { useTranslation } from 'react-i18next';
import './FieldManager.css';

interface FieldEntityListProps {
  // We pass 'user' as the entity and either 'system' or 'custom' as the category
  onSelectEntity: (entity: string, category: 'system' | 'custom') => void;
}

export const FieldEntityList = ({ onSelectEntity }: FieldEntityListProps) => {
  const { t } = useTranslation();

  // These are the two cards shown in your screenshot
  const categories = [
    { 
      key: 'system', 
      label: t('field_group_system'), 
      icon: '⚙️', 
      description: t('core_platform_fields') 
    },
    { 
      key: 'custom', 
      label: t('field_group_custom'), 
      icon: '🛠️', 
      description: t('user_defined_fields') 
    }
  ];

  return (
    <div className="entity-selection-container">
      <h3 className="entity-title">{t('select_entity_to_manage')}</h3>
      <div className="entity-grid">
        {categories.map((cat) => (
          <div 
            key={cat.key} 
            className={`entity-card category-${cat.key}`} 
            onClick={() => onSelectEntity('user', cat.key as 'system' | 'custom')}
          >
            <div className="entity-icon-wrapper">{cat.icon}</div>
            <div className="entity-info">
                <span className="entity-text">{cat.label}</span>
                <small className="entity-desc">{cat.description}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};