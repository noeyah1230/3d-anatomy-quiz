import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter/wght.css';
import '@fontsource/instrument-serif/400.css';
import { App } from './App';
import { ErrorBoundary } from './ErrorBoundary';
import '../styles/app.css';

const ReviewApp =
  import.meta.env.DEV && new URLSearchParams(location.search).has('review')
    ? lazy(() => import('../features/anatomy/review/ReviewApp'))
    : null;

const params = new URLSearchParams(location.search);
const study = params.get('study');
const StudyApp =
  study === 'typing' || study === 'flashcards'
    ? lazy(() => import('../features/quiz/StudyApp'))
    : null;

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
      {ReviewApp ? (
        <Suspense fallback={<p>Loading anatomy review…</p>}>
          <ReviewApp />
        </Suspense>
      ) : StudyApp ? (
        <Suspense fallback={<p>Loading practice…</p>}>
          <StudyApp
            mode={study === 'flashcards' ? 'flashcards' : 'typing'}
            preview={params.get('preview') === '1'}
          />
        </Suspense>
      ) : (
        <App />
      )}
    </ErrorBoundary>
  </StrictMode>,
);
