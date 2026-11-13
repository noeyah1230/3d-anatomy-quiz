import { useEffect, useRef, useState } from 'react';
import {
  assetSha256,
  questions as approvedQuestions,
} from 'virtual:approved-quiz';
import { ErrorBoundary } from '../../app/ErrorBoundary';
import { useHighlight, useTheme } from '../../app/preferences';
import AnatomyViewer, { type CameraCommand } from '../anatomy/AnatomyViewer';
import {
  AppearanceControls,
  useAppearance,
} from '../anatomy/visuals/AppearanceControls';
import { defaultAppearance } from '../anatomy/visuals/appearance';
import {
  QuestionPanel,
  ratings,
  type Result,
  type StudyMode,
} from './QuestionPanel';
import { previewQuestions } from './previewQuestions';

const approvedTargets = approvedQuestions.map(({ target }) => target);
const previewTargets = previewQuestions.map(({ target }) => target);
const initialCamera: CameraCommand = { action: 'frame', view: 'focus' };
const views = ['front', 'back', 'left', 'right'] as const;

export default function StudyApp({
  mode,
  preview,
}: {
  mode: StudyMode;
  preview: boolean;
}) {
  const questions = preview ? previewQuestions : approvedQuestions;
  const [session, setSession] = useState(0);
  const targets = preview ? previewTargets : approvedTargets;
  const previewQuery = preview ? '&preview=1' : '';
  const [theme, setTheme] = useTheme();
  const [highlight, setHighlight] = useHighlight();
  const [appearance, setAppearance] = useAppearance();
  const [results, setResults] = useState<Result[]>([]);
  const [command, setCommand] = useState(initialCamera);
  const [orbit, setOrbit] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [reverse, setReverse] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const complete = useRef<HTMLHeadingElement>(null);
  const index = results.length;
  const question = questions[index];
  const available = ready && !error;

  useEffect(() => {
    if (index === questions.length && index > 0) complete.current?.focus();
  }, [index, questions.length]);

  function resetCamera() {
    setOrbit(false);
    setCommand({ ...initialCamera });
  }

  function toggleOrbit() {
    setOrbit((value) => !value);
  }

  function next(result: Result) {
    if (!available || !question) return;
    setResults((previous) =>
      previous.length === index ? [...previous, result] : previous,
    );
    resetCamera();
  }

  function retry() {
    resetCamera();
    setError('');
    setReady(false);
    setAttempt((previous) => previous + 1);
  }

  const fallback = (message: string) => (
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
        <a className="brand study-brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark" aria-hidden="true" />
          Anatomy Quiz
        </a>
        <div className="masthead-controls">
          <a href={import.meta.env.BASE_URL}>Muscle viewer</a>
          <button
            type="button"
            className="theme-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? 'Light theme' : 'Dark theme'}
          </button>
        </div>
      </header>

      <main className="page-width study-page">
        <div className="page-heading">
          <h1>Muscle practice</h1>
        </div>
        <nav aria-label="Practice modes" className="study-tabs">
          <a
            href={`?study=typing${previewQuery}`}
            aria-current={mode === 'typing' ? 'page' : undefined}
          >
            Typing
          </a>
          <a
            href={`?study=flashcards${previewQuery}`}
            aria-current={mode === 'flashcards' ? 'page' : undefined}
          >
            Flashcards
          </a>
        </nav>
        {preview && (
          <p className="study-preview">
            <strong>Ungraded preview.</strong> These models are awaiting anatomy
            review. <a href={`?study=${mode}`}>Go to scored practice</a>
          </p>
        )}
        {questions.length === 0 ? (
          <section className="viewer-card study-empty">
            <p className="region">0 of 46 anatomy targets approved</p>
            <h2>
              {mode === 'typing'
                ? 'No typing questions yet'
                : 'No flashcards yet'}
            </h2>
            <p>
              Scored practice opens after anatomy review. Explore Masseter and
              Temporalis in the ungraded preview.
            </p>
            <a
              className="study-primary study-link"
              href={`?study=${mode}&preview=1`}
            >
              Try ungraded preview
            </a>
          </section>
        ) : question ? (
          <div className="workspace study-workspace">
            <section className="viewer-card" aria-label="Highlighted anatomy">
              <div className="viewer-heading study-viewer-heading">
                <div>
                  <p className="region">
                    Question {index + 1} of {questions.length}
                  </p>
                  <progress
                    aria-label="Round progress"
                    max={questions.length}
                    value={index}
                  />
                </div>
                <span className="mode">{appearance.mode}</span>
              </div>
              <div className="stage">
                {error ? (
                  fallback(error)
                ) : (
                  <ErrorBoundary
                    key={attempt}
                    fallback={() =>
                      fallback('Check WebGL 2 support and try again.')
                    }
                    onError={() =>
                      setError(
                        'The anatomy geometry or WebGL renderer is unavailable.',
                      )
                    }
                  >
                    <AnatomyViewer
                      target={question.target}
                      requiredTargets={targets}
                      expectedAssetHash={assetSha256}
                      appearance={appearance}
                      theme={theme}
                      highlight={highlight}
                      command={command}
                      orbitSpeed={
                        orbit ? speed * (reverse ? -1 : 1) : undefined
                      }
                      inspect={false}
                      onReady={setReady}
                      onError={setError}
                    />
                  </ErrorBoundary>
                )}
              </div>
              <div className="viewer-footer">
                <p>
                  Drag to rotate <span aria-hidden="true">·</span> Scroll or
                  pinch to zoom
                </p>
                <div
                  className="zoom-buttons"
                  role="group"
                  aria-label="Zoom controls"
                >
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => setCommand({ action: 'zoom', factor: 1.16 })}
                    aria-label="Zoom out"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    disabled={!available}
                    onClick={() => setCommand({ action: 'zoom', factor: 0.86 })}
                    aria-label="Zoom in"
                  >
                    +
                  </button>
                </div>
              </div>
            </section>
            <div className="study-sidebar">
              <QuestionPanel
                key={`${session}:${question.target.id}`}
                mode={mode}
                preview={preview}
                question={question}
                ready={available}
                last={index === questions.length - 1}
                onNext={next}
                onResetCamera={resetCamera}
                onToggleOrbit={toggleOrbit}
              />
              <details className="settings study-settings">
                <summary>Appearance</summary>
                <div className="settings-section">
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
                  <AppearanceControls
                    value={appearance}
                    onChange={setAppearance}
                    onReset={() => {
                      setAppearance(defaultAppearance);
                      setHighlight('red');
                    }}
                  />
                </div>
              </details>
              <details className="settings study-settings">
                <summary>Camera</summary>
                <fieldset
                  className="settings-section study-camera"
                  disabled={!available}
                >
                  <legend className="sr-only">Camera controls</legend>
                  <div
                    className="study-camera-views"
                    role="group"
                    aria-label="Camera views"
                  >
                    {views.map((view) => (
                      <button
                        type="button"
                        key={view}
                        onClick={() => {
                          setOrbit(false);
                          setCommand({ action: 'frame', view });
                        }}
                      >
                        {view}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={resetCamera}>
                    Reset view
                  </button>
                  <button type="button" onClick={toggleOrbit}>
                    {orbit ? 'Pause orbit' : 'Start orbit'}
                  </button>
                  <label>
                    Orbit speed
                    <select
                      value={speed}
                      onChange={(event) =>
                        setSpeed(Number(event.currentTarget.value))
                      }
                    >
                      <option value={1}>Slow</option>
                      <option value={2}>Normal</option>
                      <option value={4}>Fast</option>
                    </select>
                  </label>
                  <label className="appearance-check">
                    <input
                      type="checkbox"
                      checked={reverse}
                      onChange={(event) =>
                        setReverse(event.currentTarget.checked)
                      }
                    />{' '}
                    Reverse orbit
                  </label>
                </fieldset>
              </details>
              <details className="settings study-settings">
                <summary>Keyboard shortcuts</summary>
                <p>
                  {mode === 'typing'
                    ? 'Enter reveals or checks the answer. Press Enter again to continue.'
                    : preview
                      ? 'Space flips the card. Use Next question to continue.'
                      : 'Space flips the card. After revealing the answer, use 1–4 to rate your recall.'}
                </p>
                <p>
                  H toggles the hint, R resets the view, and A starts or pauses
                  orbit. Use Tab to move between controls.
                </p>
              </details>
            </div>
          </div>
        ) : (
          <section className="viewer-card study-empty">
            <h2 ref={complete} tabIndex={-1}>
              {preview ? 'Preview complete' : 'Round complete'}
            </h2>
            {preview ? (
              <p>You explored {results.length} structures.</p>
            ) : mode === 'typing' ? (
              <p>
                {results.filter((result) => result === true).length} of{' '}
                {results.length} correct
              </p>
            ) : (
              <ul className="study-results">
                {ratings.map((rating) => (
                  <li key={rating}>
                    {rating}{' '}
                    <strong>
                      {results.filter((result) => result === rating).length}
                    </strong>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="study-primary"
              onClick={() => {
                retry();
                setResults([]);
                setSession((previous) => previous + 1);
              }}
            >
              Practice again
            </button>
          </section>
        )}
        <footer className="credits">
          <p>
            Écorché geometry by Charleeh, based on BodyParts3D and Z-Anatomy.
          </p>
          <a href={`${import.meta.env.BASE_URL}models/ECORCHE_ATTRIBUTION.md`}>
            Model credits · CC BY-SA 4.0
          </a>
        </footer>
      </main>
    </div>
  );
}
