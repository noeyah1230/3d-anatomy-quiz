import type { PreviewTarget } from '../anatomy/targets.ts';

export type Question = {
  target: PreviewTarget;
  name: string;
  kind: 'muscle' | 'group';
  acceptedAnswers: readonly string[];
  explanation: string;
  hint: string;
  citations: readonly (readonly [label: string, url: string])[];
  figureLabel: string;
  region?: string;
  figureViews?: readonly ('anterior' | 'posterior')[];
  shownSide: 'left' | 'right' | 'both';
  sidePolicy: 'either' | 'left' | 'right';
};

export function normalizeAnswer(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\p{Pd}]+/gu, ' ')
    .replace(/[.,!?;:]+(?=\s|$)/gu, '')
    .trim()
    .replace(/\s+/gu, ' ');
}

export function gradeAnswer(question: Question, answer: string) {
  let text = normalizeAnswer(answer);
  const side = /^(left|right) /u.exec(text)?.[1];
  if (question.sidePolicy !== 'either' && side !== question.sidePolicy)
    return false;
  if (side) {
    if (question.shownSide !== 'both' && side !== question.shownSide)
      return false;
    text = text.slice(side.length + 1);
  }
  const accepted = question.acceptedAnswers.map(normalizeAnswer);
  return (
    accepted.includes(text) ||
    (question.kind === 'muscle' &&
      text.endsWith(' muscle') &&
      accepted.includes(text.slice(0, -7)))
  );
}
