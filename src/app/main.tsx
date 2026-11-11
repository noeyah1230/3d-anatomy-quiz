import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/instrument-serif/400.css';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import '../styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('App root is missing.');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary
      fallback={() => (
        <main className="app fatal">
          <h1>Anatomy Quiz could not start</h1>
          <button type="button" onClick={() => location.reload()}>
            Reload app
          </button>
        </main>
      )}
    >
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
