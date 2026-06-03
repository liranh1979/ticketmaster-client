import { useTranslation } from 'react-i18next';
import './FieldManager.css';

interface FieldEntityListProps {
  onSelectEntity: (entity: string, category: 'system' | 'custom') => void;
}

export const FieldEntityList = ({ onSelectEntity }: FieldEntityListProps) => {
  const { t } = useTranslation();

  const cards = [
    {
      entity: 'user',
      category: 'system' as const,
      label: t('field_group_system'),
      icon: '⚙️',
      description: t('core_platform_fields'),
    },
    {
      entity: 'user',
      category: 'custom' as const,
      label: t('field_group_custom'),
      icon: '🛠️',
      description: t('user_defined_fields'),
    },
    {
      entity: 'group',
      category: 'custom' as const,
      label: t('field_group_groups'),
      icon: '👥',
      description: t('group_defined_fields'),
    },
    {
      entity: 'ticket',
      category: 'custom' as const,
      label: t('field_group_tickets'),
      icon: '🎫',
      description: t('ticket_defined_fields'),
    },
  ];

  return (
    <div className="entity-selection-container">
      <h3 className="entity-title">{t('select_entity_to_manage')}</h3>
      <div className="entity-grid">
        {cards.map((card) => (
          <div
            key={`${card.entity}-${card.category}`}
            className={`entity-card category-${card.category}`}
            onClick={() => onSelectEntity(card.entity, card.category)}
          >
            <div className="entity-icon-wrapper">{card.icon}</div>
            <div className="entity-info">
              <span className="entity-text">{card.label}</span>
              <small className="entity-desc">{card.description}</small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};