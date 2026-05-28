import { useTranslation } from 'react-i18next';
import '../Settings/FieldManager/FieldManager.css';

interface UsersGroupsHubProps {
  onSelect: (entity: 'users' | 'groups') => void;
}

export const UsersGroupsHub = ({ onSelect }: UsersGroupsHubProps) => {
  const { t } = useTranslation();

  const cards = [
    {
      entity: 'users' as const,
      label: t('users_entity'),
      icon: '👤',
      description: t('users_entity_desc'),
    },
    {
      entity: 'groups' as const,
      label: t('groups_entity'),
      icon: '👥',
      description: t('groups_entity_desc'),
    },
  ];

  return (
    <div className="entity-selection-container">
      <h3 className="entity-title">{t('users_groups_management_title')}</h3>
      <div className="entity-grid">
        {cards.map((card) => (
          <div
            key={card.entity}
            className="entity-card category-custom"
            onClick={() => onSelect(card.entity)}
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
