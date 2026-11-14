import type { Plugin } from 'vite';
import {
  asset,
  records,
  references,
  regionLabels,
  toReviewTarget,
} from '../src/features/anatomy/review/catalog.ts';
import {
  normalizeAnswer,
  type Question,
} from '../src/features/quiz/questions.ts';
import { readAnatomyAudit } from './anatomy-audit.ts';

type Audit = Awaited<ReturnType<typeof readAnatomyAudit>>;

export function questionsFromAudit(audit: Audit): Question[] {
  if (audit.errors.length) throw new Error(audit.errors.join('\n'));
  const vocabulary = new Map<string, string>();
  function registerAnswer(id: string, label: string, singleMuscle: boolean) {
    const normalized = normalizeAnswer(label);
    if (!normalized || /^(left|right) /u.test(normalized)) {
      throw new Error(`Invalid answer for ${id}`);
    }
    const tokens = singleMuscle
      ? [normalized, normalized.replace(/ muscle$/u, '')]
      : [normalized];
    for (const token of tokens) {
      const owner = vocabulary.get(token);
      if (owner && owner !== id)
        throw new Error(`Conflicting answers for ${owner} and ${id}`);
      vocabulary.set(token, id);
    }
    return normalized;
  }

  for (const record of records) {
    for (const label of [record.name, ...record.labels]) {
      registerAnswer(record.id, label, record.kind === 'individual');
    }
  }

  return audit.rows.flatMap((row) => {
    if (
      row.reviewState !== 'approved' ||
      !row.captureValid ||
      row.mappingStatus !== 'mapped'
    )
      return [];
    const record = records.find(({ id }) => id === row.id);
    if (!record || !row.decision)
      throw new Error(`Approved target has no review record: ${row.id}`);
    const shownSide = record.laterality === 'bilateral' ? 'left' : 'both';
    const target = toReviewTarget(record, shownSide);
    if (!target)
      throw new Error(`Approved target has no renderable geometry: ${row.id}`);

    const aliases = row.decision.acceptedAnswers ?? [];
    if (
      !Array.isArray(aliases) ||
      aliases.some((alias) => typeof alias !== 'string')
    ) {
      throw new Error(`Invalid reviewed aliases for ${row.id}`);
    }
    const accepted = [row.name, ...row.textbookLabels, ...aliases];
    const kind = row.kind === 'individual' ? 'muscle' : 'group';
    const unique = new Map<string, string>();
    for (const label of accepted) {
      const normalized = registerAnswer(row.id, label, kind === 'muscle');
      if (!unique.has(normalized)) unique.set(normalized, label);
    }

    return [
      {
        target,
        name: row.name,
        region: regionLabels[row.region],
        figureViews: row.figures.map(({ view }) => view),
        kind,
        acceptedAnswers: [...unique.values()],
        hint: `Region: ${regionLabels[row.region]}.`,
        explanation:
          row.decision.explanation?.trim() ||
          (shownSide === 'left'
            ? 'This view highlights the reviewed geometry on the anatomical left.'
            : 'This view highlights the reviewed geometry on both sides.'),
        figureLabel: row.figures
          .map(({ figure, page }) => `Figure ${figure}, p. ${page}`)
          .join(' · '),
        citations: [
          ...record.mapping.references.map((key) => references[key]),
          ['Pinned Écorché model', asset.url],
        ],
        shownSide,
        sidePolicy: 'either',
      } satisfies Question,
    ];
  });
}

export function quizCatalog(root: string): Plugin {
  const id = 'virtual:approved-quiz';
  const resolved = '\0' + id;
  let code: Promise<string> | undefined;

  return {
    name: 'anatomy-approved-quiz',
    resolveId(source) {
      if (source === id) return resolved;
    },
    load(source) {
      if (source !== resolved) return;
      code ??= readAnatomyAudit(root).then((audit) => {
        return `export const questions = ${JSON.stringify(questionsFromAudit(audit))}; export const assetSha256 = ${JSON.stringify(asset.sha256)};`;
      });
      return code;
    },
  };
}
