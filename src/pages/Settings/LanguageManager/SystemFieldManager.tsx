import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api'; // Path to your api.ts
import { LanguageSidebar } from './LanguageSidebar';
import { TranslationGrid } from './TranslationGrid';
import './LanguageManager.css';

export const SystemFieldManager = () => {
    const { t } = useTranslation();
    const [languages, setLanguages] = useState([]);
    const [selectedLang, setSelectedLang] = useState('en');
    const [loading, setLoading] = useState(true);

    // Fetch the list of supported languages from the database
    const fetchLanguages = async () => {
        try {
            const res = await api.get('/languages');
            setLanguages(res.data);
        } catch (err) {
            console.error("Failed to fetch languages:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLanguages();
    }, []);

    if (loading) {
        return <div className="loading-spinner">Loading System Fields...</div>;
    }

    return (
        <div className="system-manager-page">
            {/* Header Area - Cleaned up to avoid double back buttons */}
            <header className="manager-header">
                <h2>{t('manage_system_translations')}</h2>
                
                <div className="header-info">
                    <span>{t('editing_language')}: <strong>{selectedLang.toUpperCase()}</strong></span>
                </div>
            </header>

            <div className="manager-layout">
                {/* Left Sidebar: Language Management */}
                <aside className="lang-sidebar">
                    <LanguageSidebar 
                        languages={languages} 
                        onRefresh={fetchLanguages} 
                        onSelect={setSelectedLang}
                        selectedLang={selectedLang}
                    />
                </aside>

                {/* Right Content: The Interactive Grid */}
                <main className="translation-content">
                    <TranslationGrid targetLang={selectedLang} />
                </main>
            </div>
        </div>
    );
};