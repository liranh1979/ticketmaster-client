import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api'; 

interface TranslationGridProps {
    targetLang: string;
}

export const TranslationGrid = ({ targetLang }: TranslationGridProps) => {
    const { t, i18n } = useTranslation();
    const [translations, setTranslations] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // 1. Load the translations whenever the selected language changes
    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await api.get(`/locales/${targetLang}`);
                setTranslations(res.data);
            } catch (err) {
                console.error("Failed to load translations:", err);
            }
        };
        loadData();
    }, [targetLang]);

    const handleSave = async () => {
        setLoading(true);
        try {
            await api.post('/languages/update', {
                lang: targetLang,
                translations
            });
            
            // Sync the i18next local cache immediately so the UI updates
            i18n.addResourceBundle(targetLang, 'translation', translations, true, true);
            alert("Saved successfully!");
        } catch (err) {
            console.error("Save error:", err);
            alert("Error saving data");
        } finally { 
            setLoading(false); 
        }
    };

    // FIX: Added the missing return statement below
    return (
        <div className="grid-wrapper">
            <div className="grid-header">
                <h3>{t('editing_language')}: {targetLang.toUpperCase()}</h3>
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
                    disabled={loading}
                >
                    {loading ? t('saving') : t('save_btn')}
                </button>
            </div>
        </div>
    );
};