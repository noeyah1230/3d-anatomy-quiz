import { useEffect, useRef, useState } from 'react';
import { gradeAnswer, type Question } from './questions';

export type StudyMode = 'typing' | 'flashcards';
export const ratings = ['Again', 'Hard', 'Good', 'Easy'] as const;
type Rating = (typeof ratings)[number];
export type Result = boolean | Rating | 'preview';

function interactive(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      Boolean(
        target.closest(
          'input, textarea, select, button, a[href], summary, [role="button"], [role="textbox"]',
        ),
      ))
  );
}

export function QuestionPanel({
  mode,
  preview,
  question,
  ready,
  last,
  onNext,
  onResetCamera,
  onToggleOrbit,
}: {
  mode: StudyMode;
  preview: boolean;
  question: Question;
  ready: boolean;
  last: boolean;
  onNext: (result: Result) => void;
  onResetCamera: () => void;
  onToggleOrbit: () => void;
}) {
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState<boolean | 'preview' | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const composing = useRef(false);
  const prompt = useRef<HTMLHeadingElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const showAnswer = mode === 'typing' ? checked !== null : revealed;

  useEffect(() => {
    if (!ready) return;
    if (mode === 'flashcards') prompt.current?.focus({ preventScroll: true });
    else if (checked === null) input.current?.focus({ preventScroll: true });
    else next.current?.focus();
  }, [checked, mode, ready]);

  useEffect(() => {
    function shortcuts(event: KeyboardEvent) {
      if (
        !ready ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.keyCode === 229 ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey ||
        interactive(event.target)
      )
        return;

      const key = event.key.toLowerCase();
      if (mode === 'flashcards' && key === ' ') {
        event.preventDefault();
        setRevealed((value) => !value);
      } else if (
        mode === 'flashcards' &&
        !preview &&
        revealed &&
        /^[1-4]$/u.test(key)
      ) {
        const rating = ratings[Number(key) - 1];
        if (rating) {
          event.preventDefault();
          onNext(rating);
        }
      } else if (key === 'h') {
        setHint((value) => !value);
      } else if (key === 'r') {
        onResetCamera();
      } else if (key === 'a') {
        onToggleOrbit();
      } else if (
        (key === 'enter' || key === 'arrowright') &&
        checked !== null
      ) {
        event.preventDefault();
        onNext(checked);
      }
    }

    window.addEventListener('keydown', shortcuts);
    return () => window.removeEventListener('keydown', shortcuts);
  }, [
    checked,
    mode,
    preview,
    onNext,
    onResetCamera,
    onToggleOrbit,
    ready,
    revealed,
  ]);

  return (
    <section
      className="settings study-question"
      aria-labelledby="study-prompt"
      onKeyDown={(event) => {
        if (event.repeat && (event.key === 'Enter' || event.key === ' '))
          event.preventDefault();
      }}
    >
      <h2 id="study-prompt" ref={prompt} tabIndex={-1}>
        {question.sidePolicy === 'either'
          ? 'Name the highlighted'
          : 'Name the side and highlighted'}{' '}
        {question.kind === 'group' ? 'muscle group' : 'muscle'}
      </h2>
      {mode === 'typing' && checked === null && (
        <form
          className="study-answer-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ready || composing.current || (!preview && !answer.trim()))
              return;
            setChecked(
              (previous) =>
                previous ??
                (preview ? 'preview' : gradeAnswer(question, answer)),
            );
          }}
        >
          <label htmlFor="study-answer">Your answer</label>
          <input
            id="study-answer"
            ref={input}
            value={answer}
            disabled={!ready}
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="done"
            onChange={(event) => setAnswer(event.currentTarget.value)}
            onCompositionStart={() => {
              composing.current = true;
            }}
            onCompositionEnd={() => {
              composing.current = false;
            }}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (composing.current ||
                  event.nativeEvent.isComposing ||
                  event.nativeEvent.keyCode === 229 ||
                  event.repeat ||
                  event.altKey ||
                  event.ctrlKey ||
                  event.metaKey ||
                  event.shiftKey)
              ) {
                event.preventDefault();
              }
            }}
          />
          <button
            type="submit"
            className="study-primary"
            disabled={!ready || (!preview && !answer.trim())}
          >
            {preview ? 'Reveal model label' : 'Check answer'}
          </button>
        </form>
      )}
      {mode === 'flashcards' && (
        <button
          type="button"
          className="study-primary"
          disabled={!ready}
          aria-expanded={revealed}
          onClick={() => setRevealed((value) => !value)}
        >
          {revealed ? 'Hide answer' : 'Reveal answer'}
        </button>
      )}
      {!showAnswer && (
        <div className="study-hint">
          <button
            type="button"
            className="quiet-button"
            aria-expanded={hint}
            onClick={() => setHint((value) => !value)}
          >
            {hint ? 'Hide hint' : 'Show hint'}
          </button>
          {hint && <p role="status">{question.hint}</p>}
        </div>
      )}
      {showAnswer && (
        <div className="study-feedback">
          <div role="status">
            {typeof checked === 'boolean' && (
              <p>
                <strong>{checked ? 'Correct' : 'Incorrect'}</strong> · You
                entered {answer}
              </p>
            )}
            {checked === 'preview' && answer.trim() && (
              <p>You entered {answer}</p>
            )}
            <h3>
              {question.sidePolicy === 'either'
                ? ''
                : `${question.sidePolicy === 'left' ? 'Left' : 'Right'} `}
              {question.name}
            </h3>
            <p>{question.explanation}</p>
            {question.acceptedAnswers.length > 1 && (
              <p>
                Also accepted: {question.acceptedAnswers.slice(1).join(', ')}
              </p>
            )}
          </div>
          <p className="study-sources">
            {question.figureLabel} ·{' '}
            {question.citations.map(([label, url], index) => (
              <span key={url}>
                {index > 0 ? ' · ' : ''}
                <a href={url} target="_blank" rel="noreferrer">
                  {label}
                </a>
              </span>
            ))}
          </p>
          {preview ? (
            <button
              type="button"
              className="study-primary"
              ref={next}
              disabled={!ready}
              onClick={() => onNext('preview')}
            >
              {last ? 'Finish preview' : 'Next question'}
            </button>
          ) : mode === 'flashcards' ? (
            <div
              role="group"
              aria-label="Rate your recall"
              className="study-ratings"
            >
              <p>How well did you recall it?</p>
              {ratings.map((rating, index) => (
                <button
                  type="button"
                  key={rating}
                  disabled={!ready}
                  onClick={() => onNext(rating)}
                >
                  {rating}
                  <span aria-hidden="true">{index + 1}</span>
                </button>
              ))}
            </div>
          ) : (
            checked !== null && (
              <button
                type="button"
                className="study-primary"
                ref={next}
                disabled={!ready}
                onClick={() => onNext(checked)}
              >
                {last ? 'See results' : 'Next question'}
              </button>
            )
          )}
        </div>
      )}
    </section>
  );
}
