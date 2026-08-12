import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Plus, Trash2, Loader2, ArrowLeft, CheckCircle, Sparkles, Settings as SettingsIcon } from 'lucide-react';
import api from '../../../api';
import { KbEditor } from '../../../components/KbEditor/KbEditor';
import { LabelPickerControl } from '../../../components/LabelPickerControl/LabelPickerControl';
import './KbArticlesPage.css';

interface ArticleLabel { id: number; labelKey: string; color: string; name: string; }
interface Article {
  id: number; title: string; categoryId: number | null; categoryName: string | null;
  labels: ArticleLabel[] | null; visibility: string; viewCount: number; helpfulCount: number; notHelpfulCount: number;
}
interface ArticleDetail extends Article { body: string; }
interface Category { id: number; name: string; icon: string | null; }
interface ReviewChange { type: string; description: string; }

const VISIBILITIES = ['internal', 'public'];

interface Props { onManageCategories: () => void; prefillTicketId?: number | null; }

export const KbArticlesPage = ({ onManageCategories, prefillTicketId }: Props) => {
  const { t } = useTranslation();

  const [articles, setArticles] = useState<Article[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formCategoryId, setFormCategoryId] = useState<number | null>(null);
  const [formLabelIds, setFormLabelIds] = useState<number[]>([]);
  const [formVisibility, setFormVisibility] = useState('internal');

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  const [reviewing, setReviewing] = useState(false);
  const [reviewChanges, setReviewChanges] = useState<ReviewChange[] | null>(null);
  const [originalBody, setOriginalBody] = useState('');

  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateTicketId, setGenerateTicketId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  const fetchAll = async () => {
    try {
      const [articlesRes, categoriesRes] = await Promise.all([
        api.get<Article[]>('/kb-articles'),
        api.get<Category[]>('/kb-categories'),
      ]);
      setArticles(articlesRes.data);
      setCategories(categoriesRes.data);
    } catch { /* silent */ } finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  const categoryName = (id: number | null) => categories.find(c => c.id === id)?.name ?? '—';

  const openCreate = () => {
    setEditingId(null);
    setFormTitle('');
    setFormBody('');
    setFormCategoryId(categories[0]?.id ?? null);
    setFormLabelIds([]);
    setFormVisibility('internal');
    setReviewChanges(null);
    setView('form');
  };

  const openEdit = async (id: number) => {
    const res = await api.get<ArticleDetail>(`/kb-articles/${id}`);
    const a = res.data;
    setEditingId(id);
    setFormTitle(a.title);
    setFormBody(a.body);
    setFormCategoryId(a.categoryId);
    setFormLabelIds((a.labels ?? []).map(l => l.id));
    setFormVisibility(a.visibility);
    setReviewChanges(null);
    setView('form');
  };

  const backToList = () => { setView('list'); fetchAll(); };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      title: formTitle,
      body: formBody,
      categoryId: formCategoryId,
      labelIds: formLabelIds,
      visibility: formVisibility,
    };
    try {
      if (editingId) {
        await api.put(`/kb-articles/${editingId}`, payload);
      } else {
        await api.post('/kb-articles', payload);
      }
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      backToList();
    } catch (err: any) {
      alert('Save failed: ' + (err.response?.data?.message ?? err.message));
    } finally { setSaving(false); }
  };

  const handleDelete = async (a: Article) => {
    if (!window.confirm(t('kb_delete_confirm', { defaultValue: 'Delete this article? This cannot be undone.' }))) return;
    await api.delete(`/kb-articles/${a.id}`);
    fetchAll();
  };

  const runAiReview = async () => {
    if (!editingId) return;
    setReviewing(true);
    try {
      const res = await api.post(`/kb-articles/${editingId}/ai-review`);
      setOriginalBody(formBody);
      setFormBody(res.data.proposedBody);
      setReviewChanges(res.data.changes);
    } catch (err: any) {
      alert('AI review failed: ' + (err.response?.data?.message ?? err.message));
    } finally { setReviewing(false); }
  };

  const discardReview = () => {
    setFormBody(originalBody);
    setReviewChanges(null);
  };

  const generateFromTicketId = async (id: number) => {
    setGenerating(true);
    setGenerateError('');
    try {
      const res = await api.post(`/kb-articles/generate-from-ticket/${id}`);
      setGenerateOpen(false);
      setGenerateTicketId('');
      setEditingId(null);
      setFormTitle(res.data.title);
      setFormBody(res.data.body);
      setFormCategoryId(categories[0]?.id ?? null);
      setFormLabelIds(res.data.labelIds ?? []);
      setFormVisibility('internal');
      setReviewChanges(null);
      setView('form');
    } catch (err: any) {
      setGenerateError(err.response?.data?.message ?? err.message);
    } finally { setGenerating(false); }
  };

  const runGenerate = () => {
    const id = parseInt(generateTicketId, 10);
    if (!id) return;
    generateFromTicketId(id);
  };

  // Arriving from a ticket's "Create KB Article" button — skip the manual-ID modal entirely and
  // show the (loading) form immediately so a failure has somewhere visible to render.
  useEffect(() => {
    if (prefillTicketId) {
      setView('form');
      generateFromTicketId(prefillTicketId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTicketId]);

  if (view === 'form') {
    return (
      <div className="kba-page">
        <button className="kba-back-btn" onClick={backToList}>
          <ArrowLeft size={14} /> {t('back_btn', { defaultValue: 'Back' })}
        </button>

        <div className="kba-form-card">
          <div className="kba-form-header">
            <h3 className="kba-form-title">
              {editingId
                ? t('kb_form_title_edit', { defaultValue: 'Edit Article' })
                : t('kb_form_title_new', { defaultValue: 'New Article' })}
            </h3>
            {editingId && (
              <button className="kba-ai-review-btn" onClick={runAiReview} disabled={reviewing}>
                {reviewing ? <Loader2 size={13} className="icon-spin" /> : <Sparkles size={13} />}
                {t('kb_ai_review_btn', { defaultValue: 'AI Review' })}
              </button>
            )}
          </div>

          {!editingId && generating && (
            <div className="kba-ai-review-banner">
              <div className="kba-ai-review-banner-title">
                <Loader2 size={13} className="icon-spin" /> {t('kb_generate_from_ticket_loading', { defaultValue: 'Drafting an article from this ticket…' })}
              </div>
            </div>
          )}

          {!editingId && !generating && generateError && (
            <p className="kba-modal-error">{generateError}</p>
          )}

          {reviewChanges && (
            <div className="kba-ai-review-banner">
              <div className="kba-ai-review-banner-title">
                {t('kb_ai_review_banner', { count: reviewChanges.length, defaultValue: `AI reviewed this article and proposed ${reviewChanges.length} change(s)` })}
              </div>
              <ul className="kba-ai-review-changes">
                {reviewChanges.map((c, i) => <li key={i}>{c.description}</li>)}
              </ul>
              <div className="kba-ai-review-actions">
                <button className="kba-ai-review-accept" onClick={() => setReviewChanges(null)}>
                  {t('kb_ai_review_accept_btn', { defaultValue: 'Accept' })}
                </button>
                <button className="kba-ai-review-discard" onClick={discardReview}>
                  {t('kb_ai_review_discard_btn', { defaultValue: 'Discard' })}
                </button>
              </div>
            </div>
          )}

          <div className="kba-field-group">
            <label className="kba-label">{t('kb_form_title_label', { defaultValue: 'Title' })}</label>
            <input className="kba-input" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
          </div>

          <div className="kba-field-group">
            <label className="kba-label">{t('kb_form_body_label', { defaultValue: 'Body' })}</label>
            <KbEditor value={formBody} onChange={setFormBody} />
          </div>

          <div className="kba-row-inline">
            <div className="kba-field-group">
              <label className="kba-label">{t('kb_form_category_label', { defaultValue: 'Category' })}</label>
              <select className="kba-select" value={formCategoryId ?? ''} onChange={e => setFormCategoryId(e.target.value ? +e.target.value : null)}>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
            </div>
            <div className="kba-field-group">
              <label className="kba-label">{t('kb_form_visibility_label', { defaultValue: 'Visibility' })}</label>
              <select className="kba-select" value={formVisibility} onChange={e => setFormVisibility(e.target.value)}>
                {VISIBILITIES.map(v => (
                  <option key={v} value={v}>
                    {v === 'public'
                      ? t('kb_visibility_public', { defaultValue: 'Public' })
                      : t('kb_visibility_internal', { defaultValue: 'Internal' })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="kba-field-group">
            <label className="kba-label">{t('kb_form_tags_label', { defaultValue: 'Tags' })}</label>
            <LabelPickerControl value={formLabelIds} onChange={setFormLabelIds} />
          </div>

          <div className="kba-form-actions">
            <div className="kba-form-actions-right">
              {savedMsg && <span className="kba-saved-msg"><CheckCircle size={13} /> Saved</span>}
              <button className="kba-cancel-btn" onClick={backToList}>{t('cancel_btn', { defaultValue: 'Cancel' })}</button>
              <button className="kba-save-btn" onClick={handleSave} disabled={saving || !formTitle}>
                {saving ? <Loader2 size={13} className="icon-spin" /> : null}
                {t('save_btn', { defaultValue: 'Save' })}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kba-page">
      <div className="kba-header">
        <div className="kba-header-left">
          <BookOpen size={20} className="kba-header-icon" />
          <h2 className="kba-title">{t('kb_admin_page_title', { defaultValue: 'Knowledge Base' })}</h2>
        </div>
        <div className="kba-header-actions">
          <button className="kba-secondary-btn" onClick={onManageCategories}>
            <SettingsIcon size={14} /> {t('kb_categories_nav_item', { defaultValue: 'KB Categories' })}
          </button>
          <button className="kba-secondary-btn" onClick={() => setGenerateOpen(true)}>
            <Sparkles size={14} /> {t('kb_generate_from_ticket_btn', { defaultValue: 'Generate from Resolved Ticket' })}
          </button>
          <button className="kba-new-btn" onClick={openCreate}>
            <Plus size={14} /> {t('kb_add_article_btn', { defaultValue: '+ New Article' })}
          </button>
        </div>
      </div>

      {generateOpen && (
        <div className="kba-modal-overlay" onClick={() => setGenerateOpen(false)}>
          <div className="kba-modal" onClick={e => e.stopPropagation()}>
            <h3 className="kba-modal-title">{t('kb_generate_from_ticket_title', { defaultValue: 'Generate Article from Ticket' })}</h3>
            <label className="kba-label">{t('kb_generate_from_ticket_pick_label', { defaultValue: 'Pick a resolved ticket' })}</label>
            <input
              className="kba-input"
              type="number"
              placeholder="Ticket ID"
              value={generateTicketId}
              onChange={e => setGenerateTicketId(e.target.value)}
            />
            {generateError && <p className="kba-modal-error">{generateError}</p>}
            <div className="kba-modal-actions">
              <button className="kba-cancel-btn" onClick={() => setGenerateOpen(false)}>{t('cancel_btn', { defaultValue: 'Cancel' })}</button>
              <button className="kba-save-btn" onClick={runGenerate} disabled={generating || !generateTicketId}>
                {generating ? <Loader2 size={13} className="icon-spin" /> : null}
                {t('kb_generate_from_ticket_btn', { defaultValue: 'Generate from Resolved Ticket' })}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="kba-table-wrap">
        {loading ? (
          <div className="kba-loading"><Loader2 size={18} className="icon-spin" /></div>
        ) : articles.length === 0 ? (
          <div className="kba-empty">{t('kb_list_empty', { defaultValue: 'No articles found.' })}</div>
        ) : (
          <table className="kba-table">
            <thead>
              <tr>
                <th className="kba-th">{t('kb_col_title', { defaultValue: 'Title' })}</th>
                <th className="kba-th">{t('kb_col_category', { defaultValue: 'Category' })}</th>
                <th className="kba-th">{t('kb_col_tags', { defaultValue: 'Tags' })}</th>
                <th className="kba-th">{t('kb_col_visibility', { defaultValue: 'Visibility' })}</th>
                <th className="kba-th">{t('kb_col_views', { defaultValue: 'Views' })}</th>
                <th className="kba-th"></th>
              </tr>
            </thead>
            <tbody>
              {articles.map(a => (
                <tr key={a.id} className="kba-table-row">
                  <td className="kba-td">{a.title}</td>
                  <td className="kba-td">{categoryName(a.categoryId)}</td>
                  <td className="kba-td">
                    <div className="kba-tag-chips">
                      {(a.labels ?? []).map(l => (
                        <span key={l.id} className="kba-tag-chip" style={{ backgroundColor: l.color + '22', color: l.color }}>
                          {l.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="kba-td">
                    <span className={`kba-vis-badge kba-vis-${a.visibility}`}>
                      {a.visibility === 'public'
                        ? t('kb_visibility_public', { defaultValue: 'Public' })
                        : t('kb_visibility_internal', { defaultValue: 'Internal' })}
                    </span>
                  </td>
                  <td className="kba-td">{a.viewCount}</td>
                  <td className="kba-td kba-td-actions">
                    <button className="kba-action-btn" onClick={() => openEdit(a.id)}>{t('edit_btn', { defaultValue: 'Edit' })}</button>
                    <button className="kba-action-btn kba-action-btn-del" onClick={() => handleDelete(a)}>
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
