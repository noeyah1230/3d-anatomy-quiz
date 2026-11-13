import { lazy, Suspense, useState } from 'react';
import type { CameraCommand } from '../features/anatomy/AnatomyViewer';
import {
  previewTargets,
  type PreviewTarget,
} from '../features/anatomy/targets';
import { useHighlight, useTheme } from './preferences';
import {
  AppearanceControls,
  useAppearance,
} from '../features/anatomy/visuals/AppearanceControls';
import { defaultAppearance } from '../features/anatomy/visuals/appearance';
import { ErrorBoundary } from './ErrorBoundary';

const AnatomyViewer = lazy(() => import('../features/anatomy/AnatomyViewer'));
const inspect =
  import.meta.env.DEV && new URLSearchParams(location.search).has('inspect');
const initialCamera: CameraCommand = { action: 'frame', view: 'focus' };
const rendererError =
  'The 3D renderer could not start. Check WebGL 2 support and retry.';
const attributionUrl = `${import.meta.env.BASE_URL}models/ECORCHE_ATTRIBUTION.md`;

export function App() {
  const [theme, setTheme] = useTheme();
  const [highlight, setHighlight] = useHighlight();
  const [appearance, setAppearance] = useAppearance();
  const [target, setTarget] = useState<PreviewTarget>(previewTargets[0]);
  const [command, setCommand] = useState<CameraCommand>(initialCamera);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  function resetView() {
    setCommand({ ...initialCamera });
  }

  function retry() {
    resetView();
    setReady(false);
    setError('');
    setAttempt((previous) => previous + 1);
  }

  function chooseTarget(next: PreviewTarget) {
    setTarget(next);
    resetView();
  }

  function zoom(factor: number) {
    setCommand({ action: 'zoom', factor });
  }

  const controlsDisabled = !ready || Boolean(error);
  const viewerMessage = (message: string) => (
    <div className="stage-message" role="alert">
      <strong>Viewer unavailable</strong>
      <p>{message}</p>
      <button type="button" onClick={retry}>
        Retry viewer
      </button>
    </div>
  );

  return (
    <div className="app" data-theme={theme}>
      <header className="masthead page-width">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          Anatomy Quiz
        </div>
        <div className="masthead-controls">
          <a href="?study=typing">Scored practice</a>
          <a href="?study=typing&preview=1">Ungraded preview</a>
          <button
            type="button"
            className="theme-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☼' : '◐'}</span>
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
        </div>
      </header>

      <main className="page-width">
        <div className="page-heading">
          <h1>Muscle viewer</h1>
          <span className="development">
            <span aria-hidden="true" />
            In development
          </span>
        </div>

        <div className="workspace">
          <section className="viewer-card" aria-label="3D model viewer">
            <div className="viewer-heading">
              <div>
                <span className="region">Head &amp; face</span>
                <h2>{target.label}</h2>
              </div>
              <span className="mode">{appearance.mode}</span>
            </div>
            <div className="stage">
              {error ? (
                viewerMessage(error)
              ) : (
                <ErrorBoundary
                  key={attempt}
                  fallback={() => viewerMessage(rendererError)}
                  onError={() => setError(rendererError)}
                >
                  <Suspense
                    fallback={
                      <div className="stage-message" role="status">
                        Preparing 3D viewer…
                      </div>
                    }
                  >
                    <AnatomyViewer
                      target={target}
                      theme={theme}
                      highlight={highlight}
                      appearance={appearance}
                      command={command}
                      inspect={inspect}
                      onReady={setReady}
                      onError={setError}
                    />
                  </Suspense>
                </ErrorBoundary>
              )}
            </div>
            <div className="viewer-footer">
              <p>
                Drag to rotate <span aria-hidden="true">·</span> Scroll or pinch
                to zoom
              </p>
              <div
                className="zoom-buttons"
                role="group"
                aria-label="Zoom controls"
              >
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => zoom(1.16)}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => zoom(0.86)}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>
          </section>

          <aside className="settings" aria-label="Viewer settings">
            <div className="settings-section">
              <h2>Structure</h2>
              <div
                className="structure-options"
                role="group"
                aria-label="Structure"
              >
                {previewTargets.map((option) => (
                  <button
                    type="button"
                    key={option.id}
                    aria-pressed={target.id === option.id}
                    onClick={() => chooseTarget(option)}
                  >
                    <span>
                      {option.label}
                      <small>Left side</small>
                    </span>
                    <span className="selection-dot" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-section">
              <h2>Highlight</h2>
              <div
                className="segmented"
                role="group"
                aria-label="Highlight color"
              >
                <button
                  type="button"
                  aria-pressed={highlight === 'red'}
                  onClick={() => setHighlight('red')}
                >
                  <span className="swatch red" aria-hidden="true" />
                  Red
                </button>
                <button
                  type="button"
                  aria-pressed={highlight === 'blue'}
                  onClick={() => setHighlight('blue')}
                >
                  <span className="swatch blue" aria-hidden="true" />
                  Blue
                </button>
              </div>
            </div>
            <details className="settings-section preview-appearance">
              <summary>Appearance</summary>
              <AppearanceControls
                value={appearance}
                onChange={setAppearance}
                onReset={() => {
                  setAppearance(defaultAppearance);
                  setHighlight('red');
                }}
              />
            </details>
            <div className="settings-section">
              <h2>Camera</h2>
              <div className="segmented" role="group" aria-label="Camera views">
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => setCommand({ action: 'frame', view: 'front' })}
                >
                  Front
                </button>
                <button
                  type="button"
                  disabled={controlsDisabled}
                  onClick={() => setCommand({ action: 'frame', view: 'left' })}
                >
                  Left
                </button>
              </div>
              <button
                type="button"
                className="reset"
                disabled={controlsDisabled}
                onClick={resetView}
              >
                Reset view
              </button>
            </div>
          </aside>
        </div>
        <footer className="credits">
          <p>
            3D model by{' '}
            <a href="https://github.com/Charleeh/ecorche">Écorché</a>, based on
            BodyParts3D © The Database Center for Life Science and Z-Anatomy by
            Gauthier Kervyn.
          </p>
          <p>
            <a href={attributionUrl}>Model credits</a> ·{' '}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/">
              CC BY-SA 4.0
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
}
