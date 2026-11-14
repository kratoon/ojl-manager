import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { DataProvider } from './data/DataProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { PermissionsProvider } from './permissions/PermissionsProvider';
import '@fontsource/noto-serif/700.css';
import '@fontsource/open-sans/400.css';
import '@fontsource/open-sans/600.css';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <PermissionsProvider>
        <DataProvider>
          <App />
        </DataProvider>
      </PermissionsProvider>
    </I18nProvider>
  </StrictMode>,
);
