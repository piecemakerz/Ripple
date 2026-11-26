import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import { LanguageProvider } from './i18n.js';
import './styles.css';
import './studio.css';
import './workspace.css';
import './workflow.css';
import './onboarding.css';
import './language.css';
import './first-look.css';
import './ripple-map.css';
import './first-use.css';
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </StrictMode>,
);
