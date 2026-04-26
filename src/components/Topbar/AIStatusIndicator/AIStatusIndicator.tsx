import React, { useState, useEffect } from 'react';
import api from '../../../api'; 
import { Bot, AlertTriangle, Loader2 } from 'lucide-react';
import './AIStatusIndicator.css'; 

export const AIStatusIndicator = () => {
    const [status, setStatus] = useState<'loading' | 'ok' | 'error' | 'none'>('loading');

    const checkStatus = async () => {
        try {
            // 1. Check if AI should be active
            const statusRes = await api.get('/ai/status');
            const { hasActiveAI } = statusRes.data;

            if (!hasActiveAI) {
                setStatus('none');
                return;
            }

            // 2. Fetch all settings to find the ID of the active one
            // (Since /ai/status doesn't return the ID directly)
            const settingsRes = await api.get('/ai/settings');
            const activeSetting = settingsRes.data.find((s: any) => s.is_active === 1 || s.is_active === true);

            if (activeSetting && activeSetting.id) {
                // 3. Perform the test ONCE
                const testRes = await api.post(`/ai/settings/${activeSetting.id}/test`);
                setStatus(testRes.data.success ? 'ok' : 'error');
            } else {
                // Fallback if no active setting found in list
                setStatus('ok');
            }
        } catch (err) {
            console.error("AI Status Check Error:", err);
            setStatus('error');
        }
    };

    useEffect(() => {
        // Run ONLY ONCE when the component/toolbar first loads
        checkStatus();
        
        // Removed the setInterval (the repeat) to save API calls
    }, []); 

    if (status === 'none') return null;

    return (
        <div className={`ai-status-pill ${status}`} title={`AI Status: ${status}`}>
            {status === 'loading' && <Loader2 className="icon-spin" size={22} />}
            {status === 'ok' && <Bot size={22} color="#10b981" />} 
            {status === 'error' && <AlertTriangle size={22} color="#ef4444" />}
            
            <span className="status-text">
                {status === 'ok' ? 'AI Online' : status === 'error' ? 'AI Error' : 'Checking...'}
            </span>
        </div>
    );
};