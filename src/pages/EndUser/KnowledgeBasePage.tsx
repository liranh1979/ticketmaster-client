import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Search, ThumbsUp, ThumbsDown, Eye } from 'lucide-react';
import api from '../../api';
import './KnowledgeBasePage.css';

interface Category { id: number; name: string; icon: string | null; }
interface ArticleLabel { id: number; labelKey: string; color: string; name: string; }
interface ArticleListItem {
  id: number; title: string; categoryId: number | null; categoryName: string | null;
  labels: ArticleLabel[] | null; viewCount: number; helpfulCount: number; notHelpfulCount: number;
}
interface ArticleDetail extends ArticleListItem { body: string; }

interface Props { onBack: () => void; }

export const KnowledgeBasePage = ({ onBack }: Props) => {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [articles, setArticles] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [selected, setSelected] = useState<ArticleDetail | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState(false);

  const fetchArticles = async (q: string) => {
    setLoading(true);
    try {
      const res = q.trim()
        ? await api.get<ArticleListItem[]>('/kb-articles/search', { params: { q } })
        : await api.get<ArticleListItem[]>('/kb-articles');
      setArticles(res.data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => {
    api.get<Category[]>('/kb-categories').then(r => setCategories(r.data)).catch(() => {});
    fetchArticles('');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchArticles(query), 400);
    return () => clearTimeout(t);
  }, [query]);

  const filtered = activeCategory == null ? articles : articles.filter(a => a.categoryId === activeCategory);

  const openArticle = async (id: number) => {
    setFeedbackGiven(false);
    const res = await api.get<ArticleDetail>(`/kb-articles/${id}`);
    setSelected(res.data);
  };

  const sendFeedback = async (helpful: boolean) => {
    if (!selected || feedbackGiven) return;
    await api.post(`/kb-articles/${selected.id}/feedback`, null, { params: { helpful } });
    setFeedbackGiven(true);
  };

  if (selected) {
    return (
      <div className="kbp-page">
        <button className="kbp-back-btn" onClick={() => setSelected(null)}>
          <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
        </button>
        <div className="kbp-article-card">
          <h2 className="kbp-article-title">{selected.title}</h2>
          <div className="kbp-article-meta">
            <span><Eye size={12} /> {selected.viewCount}</span>
            {selected.categoryName && <span>{selected.categoryName}</span>}
          </div>
          <div className="kbp-article-body" dangerouslySetInnerHTML={{ __html: selected.body }} />
          <div className="kbp-feedback">
            <button className="kbp-feedback-btn" disabled={feedbackGiven} onClick={() => sendFeedback(true)}>
              <ThumbsUp size={13} /> {t('kb_helpful_btn', { defaultValue: 'Helpful' })}
            </button>
            <button className="kbp-feedback-btn" disabled={feedbackGiven} onClick={() => sendFeedback(false)}>
              <ThumbsDown size={13} /> {t('kb_not_helpful_btn', { defaultValue: 'Not Helpful' })}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kbp-page">
      <button className="kbp-back-btn" onClick={onBack}>
        <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
      </button>

      <div className="kbp-search">
        <Search size={16} className="kbp-search-icon" />
        <input
          className="kbp-search-input"
          placeholder={t('kb_search_placeholder', { defaultValue: 'Search the Knowledge Base…' }) as string}
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="kbp-cats">
        <span className={`kbp-cat${activeCategory == null ? ' kbp-cat-active' : ''}`} onClick={() => setActiveCategory(null)}>
          {t('kb_category_all', { defaultValue: 'All' })}
        </span>
        {categories.map(c => (
          <span key={c.id} className={`kbp-cat${activeCategory === c.id ? ' kbp-cat-active' : ''}`}
                onClick={() => setActiveCategory(c.id)}>
            {c.icon} {c.name}
          </span>
        ))}
      </div>

      {loading ? (
        <div className="kbp-loading">…</div>
      ) : filtered.length === 0 ? (
        <div className="kbp-empty">{t('kb_list_empty', { defaultValue: 'No articles found.' })}</div>
      ) : (
        <div className="kbp-list">
          {filtered.map(a => (
            <div key={a.id} className="kbp-article-row" onClick={() => openArticle(a.id)}>
              <div className="kbp-article-row-title">{a.title}</div>
              <div className="kbp-article-row-meta">
                {a.categoryName && <span className="kbp-tag">{a.categoryName}</span>}
                {(a.labels ?? []).map(l => (
                  <span key={l.id} className="kbp-tag" style={{ backgroundColor: l.color + '22', color: l.color }}>
                    {l.name}
                  </span>
                ))}
                <span className="kbp-article-row-views"><Eye size={11} /> {a.viewCount}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
