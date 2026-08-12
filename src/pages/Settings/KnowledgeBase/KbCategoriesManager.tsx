import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Trash2 } from 'lucide-react';
import api from '../../../api';
import './KbCategoriesManager.css';

interface Category { id: number; name: string; icon: string | null; displayOrder: number; }

interface Props { onBack: () => void; }

export const KbCategoriesManager = ({ onBack }: Props) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState('');
  const [iconInput, setIconInput] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchAll = async () => {
    try {
      const res = await api.get<Category[]>('/kb-categories');
      setCategories(res.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleAdd = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setAdding(true);
    try {
      await api.post('/kb-categories', { name, icon: iconInput.trim() || null });
      setNameInput(''); setIconInput('');
      fetchAll();
    } finally { setAdding(false); }
  };

  const handleDelete = async (c: Category) => {
    if (!window.confirm(t('kb_category_delete_confirm', { defaultValue: 'Delete this category? Articles keep their content but lose this category.' }))) return;
    await api.delete(`/kb-categories/${c.id}`);
    setCategories(prev => prev.filter(x => x.id !== c.id));
  };

  return (
    <div className="kbc-page">
      <button className="kbc-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
      </button>

      <h2 className="kbc-title">{t('kb_categories_page_title', { defaultValue: 'Knowledge Base Categories' })}</h2>

      <div className="kbc-add-row">
        <input className="kbc-input" placeholder={t('kb_category_name_label', { defaultValue: 'Name' }) as string}
               value={nameInput} onChange={e => setNameInput(e.target.value)} />
        <input className="kbc-input kbc-input-icon" placeholder="🔧"
               value={iconInput} onChange={e => setIconInput(e.target.value)} maxLength={4} />
        <button className="kbc-add-btn" onClick={handleAdd} disabled={adding || !nameInput.trim()}>
          {t('kb_category_create_btn', { defaultValue: '+ Add Category' })}
        </button>
      </div>

      {loading ? (
        <div className="kbc-loading">…</div>
      ) : categories.length === 0 ? (
        <div className="kbc-empty">{t('no_kb_categories', { defaultValue: 'No categories defined.' })}</div>
      ) : (
        <div className="kbc-list">
          {categories.map(c => (
            <div key={c.id} className="kbc-row">
              <span className="kbc-row-icon">{c.icon || '●'}</span>
              <span className="kbc-row-name">{c.name}</span>
              <button className="kbc-delete-btn" onClick={() => handleDelete(c)}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
