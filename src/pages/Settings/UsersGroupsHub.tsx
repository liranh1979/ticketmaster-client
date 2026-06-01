import { useTranslation } from 'react-i18next';
import { hasPermission, PERMISSIONS } from '../../utils/permissions';
import '../Settings/FieldManager/FieldManager.css';

interface UsersGroupsHubProps {
  onSelect: (entity: 'users' | 'groups' | 'ldap' | 'azure') => void;
  user?: any;
}

export const UsersGroupsHub = ({ onSelect, user }: UsersGroupsHubProps) => {
  const { t } = useTranslation();

  const allCards = [
    {
      entity: 'users' as const,
      label: t('users_entity'),
      icon: '👤',
      description: t('users_entity_desc'),
      permission: PERMISSIONS.MANAGE_USERS,
    },
    {
      entity: 'groups' as const,
      label: t('groups_entity'),
      icon: '👥',
      description: t('groups_entity_desc'),
      permission: PERMISSIONS.MANAGE_GROUPS,
    },
    {
      entity: 'ldap' as const,
      label: t('settings_ldap_manager'),
      icon: '🗂️',
      description: t('ldap_configs_title'),
      permission: PERMISSIONS.MANAGE_LDAP,
    },
    {
      entity: 'azure' as const,
      label: t('settings_azure_manager'),
      icon: '☁️',
      description: t('azure_configs_title'),
      permission: PERMISSIONS.MANAGE_AZURE,
    },
  ];

  const cards = allCards.filter(c => hasPermission(user, c.permission));

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
