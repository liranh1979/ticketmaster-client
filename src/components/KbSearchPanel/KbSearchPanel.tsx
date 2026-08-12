import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X, Link2 } from 'lucide-react';
import api from '../../api';
import './KbSearchPanel.css';

interface SearchResult { id: number; title: string; }

interface Props {
  ticketId: number;
  open: boolean;
  onClose: () => void;
  onArticleLinked?: () => void;
}

export const KbSearchPanel = ({ ticketId, open, onClose, onArticleLinked }: Props) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [linkedIds, setLinkedIds] = useState<Set<number>>(new Set());

  const runSearch = async () => {
    if (!query.trim()) { setResults([]); return; }
    const res = await api.get<SearchResult[]>('/kb-articles/search', { params: { q: query } });
    setResults(res.data);
  };

  const link = async (articleId: number) => {
    setLinkingId(articleId);
    try {
      await api.post(`/tickets/${ticketId}/kb-links/${articleId}`);
      setLinkedIds(prev => new Set(prev).add(articleId));
      onArticleLinked?.();
    } finally { setLinkingId(null); }
  };

  return (
    <>
      {open && <div className="kbsp-overlay" onClick={onClose} />}
      <div className={`kbsp-drawer${open ? ' kbsp-drawer-open' : ''}`}>
        {open && (
          <>
            <div className="kbsp-header">
              <span className="kbsp-title">{t('kb_search_panel_title', { defaultValue: 'Search Knowledge Base' })}</span>
              <button className="kbsp-close-btn" onClick={onClose}><X size={16} /></button>
            </div>
            <div className="kbsp-search-row">
              <input
                className="kbsp-search-input"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') runSearch(); }}
                placeholder={t('kb_search_placeholder', { defaultValue: 'Search the Knowledge Base…' }) as string}
                autoFocus
              />
              <button className="kbsp-search-btn" onClick={runSearch}><Search size={14} /></button>
            </div>
            <div className="kbsp-results">
              {results.map(r => (
                <div key={r.id} className="kbsp-result-row">
                  <span className="kbsp-result-title">{r.title}</span>
                  <button
                    className="kbsp-link-btn"
                    disabled={linkingId === r.id || linkedIds.has(r.id)}
                    onClick={() => link(r.id)}
                  >
                    <Link2 size={12} />
                    {linkedIds.has(r.id) ? '✓' : t('kb_link_article_btn', { defaultValue: 'Link to ticket' })}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
};
