import { previewTargets } from '../anatomy/targets';
import type { Question } from './questions';

export const previewQuestions: readonly Question[] = previewTargets.map(
  (target) => ({
    target,
    name: target.label,
    kind: 'muscle',
    acceptedAnswers: [],
    explanation:
      'This name comes from the source model. Its anatomy review is pending.',
    hint: 'Region: Head & face.',
    citations: [
      ['Écorché source model', 'https://github.com/Charleeh/ecorche'],
    ],
    figureLabel: 'Figure 6.22',
    shownSide: 'left',
    sidePolicy: 'either',
  }),
);
