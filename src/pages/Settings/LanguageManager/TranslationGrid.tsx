import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api'; 
import { Sparkles, Loader2 } from 'lucide-react'; 

interface TranslationGridProps {
    targetLang: string;
}

export const TranslationGrid = ({ targetLang }: TranslationGridProps) => {
    const { t, i18n } = useTranslation();
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [isBulkTranslating, setIsBulkTranslating] = useState(false);
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
            // Create a source object of English texts for the AI to translate
            const sourceTexts: Record<string, string> = {};
            Object.keys(translations).forEach(key => {
                sourceTexts[key] = t(key, { lng: 'en' });
            });

            const res = await api.post('/ai/translate-bulk', {
                translations: sourceTexts,
                targetLanguage: targetLang
            });

            if (res.data.success) {
                setTranslations(prev => ({ ...prev, ...res.data.translations }));
            }
        } catch (err) {
            console.error("Bulk AI Translation failed:", err);
            alert("Translation failed. Please check your AI settings.");
        } finally {
            setIsBulkTranslating(false);
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