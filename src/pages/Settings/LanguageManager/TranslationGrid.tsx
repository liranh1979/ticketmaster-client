import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api';
import { Sparkles, Loader2 } from 'lucide-react';
import { runBulkTranslate, type BulkTranslateProgress } from '../../../utils/bulkTranslateRunner';

interface TranslationGridProps {
    targetLang: string;
}

export const TranslationGrid = ({ targetLang }: TranslationGridProps) => {
    const { t, i18n } = useTranslation();
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [isBulkTranslating, setIsBulkTranslating] = useState(false);
    const [bulkProgress, setBulkProgress] = useState<BulkTranslateProgress | null>(null);
    // 1. Load initial translation data
    useEffect(() => {
        api.get(`/locales/${targetLang}`)
            .then(res => setTranslations(res.data))
            .catch(err => console.error("Failed to load translations:", err));
    }, [targetLang]);

    // 2. Bulk AI Translation Function
    const handleBulkTranslate = async () => {
        if (!window.confirm(`Are you sure you want to auto-translate all fields to ${targetLang.toUpperCase()}?`)) return;

        setIsBulkTranslating(true);
        try {
            // Only translate keys that don't already have a real translation. A key whose
            // current value still equals the English text means it's never been translated —
            // it's just showing the English fallback (see DynamicTranslationsService).
            const sourceTexts: Record<string, string> = {};
            Object.keys(translations).forEach(key => {
                const english = t(key, { lng: 'en' });
                const current = translations[key] ?? '';
                if (current.trim() === '' || current === english) {
                    sourceTexts[key] = english;
                }
            });

            if (Object.keys(sourceTexts).length === 0) {
                alert('All fields are already translated for this language.');
                return;
            }

            setBulkProgress({ done: 0, total: Object.keys(sourceTexts).length, currentBatch: 0, totalBatches: 0 });
            const result = await runBulkTranslate(sourceTexts, targetLang, setBulkProgress);
            const merged = { ...translations, ...result.translations };
            setTranslations(merged);

            if (result.partial) {
                // Save immediately whatever succeeded so a mid-run failure (rate limit, quota,
                // network) doesn't throw away translated fields that were never persisted.
                await api.post('/languages/update', { lang: targetLang, translations: merged });
                alert(`Translation stopped early: ${result.error}\n\nSaved ${Object.keys(result.translations).length} of ${Object.keys(sourceTexts).length} translated fields.`);
            }
        } catch (err) {
            console.error("Bulk AI Translation failed:", err);
            alert("Translation failed. Please check your AI settings.");
        } finally {
            setIsBulkTranslating(false);
            setBulkProgress(null);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.post('/languages/update', {
                lang: targetLang,
                translations
            });
            // Update local i18next cache
            i18n.addResourceBundle(targetLang, 'translation', translations, true, true);
            alert("Saved successfully!");
        } catch (err) {
            console.error("Save error:", err);
            alert("Error saving data");
        } finally { 
            setLoading(false); 
        }
    };

    const showBulkAI = targetLang !== 'en';

    return (
        <div className="grid-wrapper">
            <div className="grid-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>{t('editing_language')}: {targetLang.toUpperCase()}</h3>
                
                {showBulkAI && (
                    <button 
                        className="ai-bulk-btn"
                        onClick={handleBulkTranslate}
                        disabled={isBulkTranslating}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 16px',
                            backgroundColor: '#6366f1',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '600'
                        }}
                    >
                        {isBulkTranslating ? (
                            <><Loader2 className="icon-spin" size={18} /> {t('translating')}...</>
                        ) : (
                            <><Sparkles size={18} /> {t('auto_translate_all')}</>
                        )}
                    </button>
                )}
            </div>

            {bulkProgress && bulkProgress.totalBatches > 0 && (
                <div style={{ marginBottom: '16px' }}>
                    <div style={{ height: '6px', borderRadius: '3px', background: 'var(--sd-surface-3, #e2e8f0)', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${Math.round((bulkProgress.done / Math.max(bulkProgress.total, 1)) * 100)}%`,
                            background: '#6366f1',
                            transition: 'width 0.2s ease',
                        }} />
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--sd-fg-muted, #64748b)', marginTop: '4px' }}>
                        Batch {bulkProgress.currentBatch} of {bulkProgress.totalBatches} · {bulkProgress.done}/{bulkProgress.total} fields
                    </div>
                </div>
            )}

            <table className="translation-table">
                <thead>
                    <tr>
                        <th>{t('key')}</th>
                        <th>{t('english_source')}</th>
                        <th>{targetLang.toUpperCase()} {t('translation')}</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.keys(translations).map(key => (
                        <tr key={key}>
                            <td><code>{key}</code></td>
                            <td className="source-text">{t(key, { lng: 'en' })}</td>
                            <td>
                                <input 
                                    className="trans-input"
                                    value={translations[key] || ''} 
                                    onChange={(e) => setTranslations({
                                        ...translations, 
                                        [key]: e.target.value
                                    })}
                                    style={{ width: '100%' }}
                                />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <div className="grid-actions">
                <button 
                    className="save-btn" 
                    onClick={handleSave} 
                    disabled={loading || isBulkTranslating}
                >
                    {loading ? t('saving') : t('save_btn')}
                </button>
            </div>
        </div>
    );
};