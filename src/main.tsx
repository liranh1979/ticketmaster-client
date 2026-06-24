import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/sd-tokens.css'
import App from './App.tsx'
import './i18n';
import { SystemSettingsProvider } from './contexts/SystemSettingsContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SystemSettingsProvider>
      <App />
    </SystemSettingsProvider>
  </StrictMode>,
)
