import { useMemo, useState } from 'react';
import { ErrorBoundary } from '../../../app/ErrorBoundary';
import AnatomyViewer, { type CameraCommand } from '../AnatomyViewer';
import type { Highlight, Theme } from '../visuals/materials';
import {
  asset,
  figures,
  recordedDecisions,
  records,
  references,
  regionLabels,
  toReviewTarget,
  type ReviewSide,
} from './catalog';

const initialCommand: CameraCommand = { action: 'frame', view: 'focus' };

export default function ReviewApp() {
  const [id, setId] = useState(
    () => new URLSearchParams(location.search).get('target') ?? 'masseter',
  );
  const [side, setSide] = useState<ReviewSide>('left');
  const [piece, setPiece] = useState('');
  const [command, setCommand] = useState(initialCommand);
  const [theme, setTheme] = useState<Theme>('dark');
  const [highlight, setHighlight] = useState<Highlight>('red');
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const record = records.find((entry) => entry.id === id) ?? records[0];
  const target = useMemo(() => {
    if (!record) return null;
    const [componentIndex, meshIndex] = piece.split(':');
    return toReviewTarget(
      record,
      side,
      piece ? Number(componentIndex) : null,
      meshIndex === undefined ? null : Number(meshIndex),
    );
  }, [record, side, piece]);

  if (!record) return null;
  const { mapping } = record;
  const decision = recordedDecisions[record.id];
  const hasMultiplePieces =
    mapping.status === 'mapped' &&
    (mapping.components.length > 1 ||
      mapping.components.some(({ meshes }) => meshes.left.length > 1));

  function resetView() {
    setCommand({ ...initialCommand });
  }

  function retry() {
    setReady(false);
    setError('');
    setAttempt((previous) => previous + 1);
    resetView();
  }

  const unavailable = (
    <div className="stage-message" role="alert">
      <strong>Viewer unavailable</strong>
      <p>{error || 'The review renderer could not start.'}</p>
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
        <button
          type="button"
          className="theme-button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        >
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </button>
      </header>
      <main className="page-width">
        <div className="page-heading">
          <h1>Anatomy review</h1>
          <a className="development" href={import.meta.env.BASE_URL}>
            Back to prototype
          </a>
        </div>
        <div className="workspace review-workspace">
          <section className="viewer-card" aria-label="Anatomy review model">
            <div className="viewer-heading">
              <div>
                <span className="region">{regionLabels[record.region]}</span>
                <h2>{record.name}</h2>
              </div>
              <span className="mode">
                {mapping.status === 'mapped' ? 'Human review' : 'Blocked'}
              </span>
            </div>
            <div
              className="stage"
              data-review-target={record.id}
              data-review-side={side}
            >
              {target ? (
                error ? (
                  unavailable
                ) : (
                  <ErrorBoundary
                    key={attempt}
                    fallback={() => unavailable}
                    onError={() =>
                      setError('The review renderer could not start.')
                    }
                  >
                    <AnatomyViewer
                      target={target}
                      theme={theme}
                      highlight={highlight}
                      command={command}
                      inspect
                      onReady={setReady}
                      onError={setError}
                    />
                  </ErrorBoundary>
                )
              ) : (
                <div className="stage-message" role="status">
                  <strong>
                    {mapping.status === 'mapped'
                      ? 'No piece selected'
                      : 'Mapping blocked'}
                  </strong>
                  <p>{mapping.note}</p>
                </div>
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
                  disabled={!target || !ready || Boolean(error)}
                  onClick={() => setCommand({ action: 'zoom', factor: 1.16 })}
                  aria-label="Zoom out"
                >
                  −
                </button>
                <button
                  type="button"
                  disabled={!target || !ready || Boolean(error)}
                  onClick={() => setCommand({ action: 'zoom', factor: 0.86 })}
                  aria-label="Zoom in"
                >
                  +
                </button>
              </div>
            </div>
          </section>
          <aside className="settings" aria-label="Anatomy review controls">
            <div className="settings-section review-fields">
              <div>
                <label htmlFor="review-target">Anatomy target</label>
                <select
                  id="review-target"
                  value={record.id}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const next = records.find((entry) => entry.id === nextId);
                    if (
                      error ||
                      mapping.status !== 'mapped' ||
                      next?.mapping.status !== 'mapped'
                    )
                      setReady(false);
                    setError('');
                    setId(nextId);
                    setPiece('');
                    resetView();
                  }}
                >
                  {records.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </div>
              {target && (
                <div>
                  <label htmlFor="review-side">Side</label>
                  <select
                    id="review-side"
                    value={side}
                    onChange={(event) => {
                      const next = event.target.value;
                      if (
                        next === 'left' ||
                        next === 'right' ||
                        next === 'both'
                      ) {
                        setSide(next);
                        resetView();
                      }
                    }}
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                    <option value="both">Both sides</option>
                  </select>
                </div>
              )}
              {hasMultiplePieces && (
                <div>
                  <label htmlFor="review-component">Component or mesh</label>
                  <select
                    id="review-component"
                    value={piece}
                    onChange={(event) => {
                      setPiece(event.target.value);
                      resetView();
                    }}
                  >
                    <option value="">All components</option>
                    {mapping.components.flatMap(({ label, meshes }, index) => [
                      <option value={index} key={index}>
                        {label}
                      </option>,
                      ...(meshes.left.length > 1
                        ? meshes[side === 'right' ? 'right' : 'left'].map(
                            ({ name }, meshIndex) => (
                              <option
                                value={`${index}:${meshIndex}`}
                                key={`${index}:${meshIndex}`}
                              >
                                {side === 'both'
                                  ? `${label} · Mesh ${meshIndex + 1}`
                                  : name}
                              </option>
                            ),
                          )
                        : []),
                    ])}
                  </select>
                </div>
              )}
            </div>
            {target && (
              <>
                <div className="settings-section">
                  <h2>Highlight</h2>
                  <div
                    className="segmented"
                    role="group"
                    aria-label="Highlight color"
                  >
                    {(['red', 'blue'] as const).map((color) => (
                      <button
                        key={color}
                        type="button"
                        aria-pressed={highlight === color}
                        onClick={() => setHighlight(color)}
                      >
                        <span
                          className={`swatch ${color}`}
                          aria-hidden="true"
                        />
                        {color === 'red' ? 'Red' : 'Blue'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="settings-section">
                  <h2>Camera</h2>
                  <div
                    className="segmented"
                    role="group"
                    aria-label="Camera views"
                  >
                    <button
                      type="button"
                      disabled={!ready || Boolean(error)}
                      onClick={() =>
                        setCommand({ action: 'frame', view: 'front' })
                      }
                    >
                      Front
                    </button>
                    <button
                      type="button"
                      disabled={!ready || Boolean(error)}
                      onClick={() =>
                        setCommand({ action: 'frame', view: 'back' })
                      }
                    >
                      Back
                    </button>
                  </div>
                  <button
                    className="reset"
                    type="button"
                    disabled={!ready || Boolean(error)}
                    onClick={resetView}
                  >
                    Reset review view
                  </button>
                </div>
              </>
            )}
          </aside>
        </div>
        <section className="review-notes" aria-label="Review record">
          <h2>Review record</h2>
          <p>
            {mapping.status !== 'mapped'
              ? 'Blocked'
              : decision
                ? `Recorded decision: ${decision.state}. Run validation to check it against the current mapping.`
                : 'Pending human review'}{' '}
            · {record.id} · {record.laterality}
          </p>
          <p>
            {record.figures
              .map(
                (id) =>
                  `Figure ${id} (${figures[id].view}, p. ${figures[id].page})`,
              )
              .join(' · ')}
          </p>
          {record.figureNote && <p>{record.figureNote}</p>}
          {target && mapping.note && <p>{mapping.note}</p>}
          {mapping.status !== 'mapped' && mapping.candidates.length > 0 && (
            <p>
              Unresolved source candidates:{' '}
              {mapping.candidates.map(({ name }) => name).join(', ')}
            </p>
          )}
          <ul>
            <li>
              <a href={asset.url}>Pinned Écorché geometry</a> · {asset.license}
            </li>
            {mapping.references.map((key) => (
              <li key={key}>
                <a href={references[key][1]}>{references[key][0]}</a>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
