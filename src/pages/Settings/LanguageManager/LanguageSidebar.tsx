import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../../../api';

interface LanguageSidebarProps {
    languages: any[];
    onRefresh: () => void;
    onSelect: (code: string) => void;
    selectedLang: string;
}

export const LanguageSidebar = ({ languages, onRefresh, onSelect, selectedLang }: LanguageSidebarProps) => {
    const { t } = useTranslation();
    const [newLang, setNewLang] = useState({ code: '', name: '' });

    const handleAdd = async () => {
        if (!newLang.code || !newLang.name) return;
        const formattedLang = { ...newLang, code: newLang.code.toLowerCase() };

        try {
            await api.post('/languages/add', formattedLang);
            setNewLang({ code: '', name: '' });
            onRefresh();
        } catch (err) {
            console.error("Failed to add language", err);
        }
    };

    const handleDelete = async (code: string) => {
        if (code === 'en') return;

        const isCurrent = selectedLang === code;

        if (window.confirm(t('confirm_delete_language', { lang: code.toUpperCase() }))) {
            try {
                await api.delete(`/languages/${code}`);
                if (isCurrent) {
                    onSelect('en');
                }
                onRefresh();
            } catch (err) {
                console.error("Failed to delete", err);
                alert(t('error_delete_language'));
            }
        }
    };

    return (
        <div className="sidebar-content">
            <h4>{t('languages_label')}</h4>
            <ul className="lang-list">
                {languages.map(l => (
                    <li
                        key={l.code}
                        className={`lang-item ${selectedLang === l.code ? 'active' : ''}`}
                        onClick={() => onSelect(l.code)}
                    >
                        <span className="lang-name">{l.name} ({l.code.toUpperCase()})</span>

                        {l.code !== 'en' && (
                            <button
                                className="del-btn"
                                title={t('confirm_delete')}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(l.code);
                                }}
                            >
                                ×
                            </button>
                        )}
                    </li>
                ))}
            </ul>

            <div className="add-lang-box">
                <input
                    placeholder={t('lang_code_placeholder')}
                    maxLength={5}
                    value={newLang.code}
                    onChange={e => setNewLang({...newLang, code: e.target.value})}
                />
                <input
                    placeholder={t('lang_name_placeholder')}
                    value={newLang.name}
                    onChange={e => setNewLang({...newLang, name: e.target.value})}
                />
                <button className="add-btn" onClick={handleAdd}>+</button>
            </div>
        </div>
    );
};
