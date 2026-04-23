import { useState } from 'react';
import api from '../../../api'; 

interface LanguageSidebarProps {
    languages: any[];
    onRefresh: () => void;
    onSelect: (code: string) => void;
    selectedLang: string;
}

export const LanguageSidebar = ({ languages, onRefresh, onSelect, selectedLang }: LanguageSidebarProps) => {
    const [newLang, setNewLang] = useState({ code: '', name: '' });

    const handleAdd = async () => {
        // Basic validation: force lowercase for language codes (e.g., 'FR')
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
        // 1. Safety check for default language
        if (code === 'en') return;

        // 2. Alert the user if they are trying to delete the language they are currently looking at
        const isCurrent = selectedLang === code;

        if (window.confirm(`Delete ${code.toUpperCase()}? This will permanently remove all its translations.`)) {
            try {
                // Adjust endpoint if your backend uses a different path
                await api.delete(`/languages/${code}`); 
                
                // 3. If we deleted the active language, switch the view back to English
                if (isCurrent) {
                    onSelect('en');
                }
                
                onRefresh();
            } catch (err) {
                console.error("Failed to delete", err);
                alert("Could not delete language. Ensure the backend route /languages/:code exists.");
            }
        }
    };

    return (
        <div className="sidebar-content">
            <h4>Languages</h4>
            <ul className="lang-list">
                {languages.map(l => (
                    <li 
                        key={l.code} 
                        // Visual feedback for the active language
                        className={`lang-item ${selectedLang === l.code ? 'active' : ''}`}
                        onClick={() => onSelect(l.code)}
                    >
                        <span className="lang-name">{l.name} ({l.code.toUpperCase()})</span>
                        
                        {/* Only show delete for non-English languages */}
                        {l.code !== 'en' && (
                            <button 
                                className="del-btn" 
                                title="Delete Language"
                                onClick={(e) => { 
                                    e.stopPropagation(); // Prevents the 'li' onClick from firing
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
                    placeholder="code (e.g. fr)" 
                    maxLength={5}
                    value={newLang.code} 
                    onChange={e => setNewLang({...newLang, code: e.target.value})} 
                />
                <input 
                    placeholder="Name (e.g. French)" 
                    value={newLang.name} 
                    onChange={e => setNewLang({...newLang, name: e.target.value})} 
                />
                <button className="add-btn" onClick={handleAdd}>+</button>
            </div>
        </div>
    );
};