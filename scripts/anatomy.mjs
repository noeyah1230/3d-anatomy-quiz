import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAnatomyModel } from '../src/features/anatomy/model.ts';
import {
  asset,
  figures,
  recordedDecisions,
  records,
  references,
  regionLabels,
  releaseTargetCount,
  sides,
} from '../src/features/anatomy/review/catalog.ts';
import {
  mappingFingerprint,
  releaseProblems,
  resolveReview,
  sha256,
  validateCatalog,
} from '../src/features/anatomy/review/validation.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const modelDir = resolve(root, 'public/models');
const screenshotDir = resolve(root, 'docs/screenshots/anatomy');

async function optionalBytes(path) {
  try {
    return await readFile(path);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

const [binary, manifestBytes] = await Promise.all([
  readFile(resolve(modelDir, asset.model)),
  readFile(resolve(modelDir, asset.manifest)),
]);
if (
  sha256(binary) !== asset.sha256 ||
  sha256(manifestBytes) !== asset.manifestSha256
) {
  throw new Error(
    'The local Écorché assets do not match the pinned checksums.',
  );
}
for (const [name, expectedHash] of Object.entries(asset.notices)) {
  if (sha256(await readFile(resolve(modelDir, name))) !== expectedHash) {
    throw new Error(`The pinned Écorché notice was changed: ${name}.`);
  }
}
const model = await parseAnatomyModel(Uint8Array.from(binary).buffer);

try {
  const errors = validateCatalog(records, model, JSON.parse(manifestBytes));
  const captureBytes = await optionalBytes(
    resolve(screenshotDir, 'captures.json'),
  );
  const captures = captureBytes ? JSON.parse(captureBytes) : {};
  for (const id of Object.keys(recordedDecisions)) {
    if (!records.some((record) => record.id === id))
      errors.push(`Unknown human review ID: ${id}.`);
  }
  for (const id of Object.keys(captures)) {
    if (
      !records.some(
        (record) => record.id === id && record.mapping.status === 'mapped',
      )
    )
      errors.push(`Unknown or unresolved screenshot ID: ${id}.`);
  }

  const rows = await Promise.all(
    records.map(async (record) => {
      const { id, mapping } = record;
      const decision = recordedDecisions[id];
      const capture = captures[id];
      const bytes = capture
        ? await optionalBytes(resolve(screenshotDir, `${id}.jpg`))
        : undefined;
      const review = resolveReview(
        record,
        decision,
        capture,
        bytes && sha256(bytes),
      );
      if (review.issue) errors.push(`${id}: ${review.issue}`);
      if (capture && !review.captureValid)
        errors.push(`${id}: screenshot is missing or out of date.`);
      return {
        id,
        name: record.name,
        textbookLabels: record.labels,
        region: record.region,
        kind: record.kind,
        laterality: record.laterality,
        figures: record.figures.map((figure) => ({
          figure,
          ...figures[figure],
        })),
        figureNote: record.figureNote,
        mappingStatus: mapping.status,
        mapping,
        sources: [
          asset.url,
          ...mapping.references.map((key) => references[key][1]),
        ],
        reviewState: review.state,
        decision,
        mappingFingerprint: mappingFingerprint(record),
        captureValid: review.captureValid,
        evidence: review.captureValid
          ? {
              path: `screenshots/anatomy/${id}.jpg`,
              sha256: capture.sha256,
              sides,
            }
          : undefined,
      };
    }),
  );
  const count = (predicate) => rows.filter(predicate).length;
  const counts = {
    total: rows.length,
    mapped: count(({ mappingStatus }) => mappingStatus === 'mapped'),
    missing: count(({ mappingStatus }) => mappingStatus === 'missing'),
    partial: count(({ mappingStatus }) => mappingStatus === 'partial'),
    ambiguous: count(({ mappingStatus }) => mappingStatus === 'ambiguous'),
    blocked: count(({ reviewState }) => reviewState === 'blocked'),
    pending: count(({ reviewState }) => reviewState === 'pending'),
    rejected: count(({ reviewState }) => reviewState === 'rejected'),
    humanApproved: count(({ reviewState }) => reviewState === 'approved'),
    withEvidence: count(({ captureValid }) => captureValid),
  };
  console.log(
    `${counts.humanApproved}/${releaseTargetCount} human-approved · ${counts.mapped} mapped · ${counts.missing} missing · ${counts.blocked} blocked · ${counts.withEvidence} with two-side review images`,
  );

  switch (process.argv[2]) {
    case 'validate': {
      if (errors.length) throw new Error(errors.join('\n'));
      console.log('Catalog and decoded source metadata passed.');
      break;
    }
    case 'release': {
      const filenames = [
        asset.model,
        asset.manifest,
        ...Object.keys(asset.notices),
      ];
      const assetChecks = await Promise.all(
        filenames.map(async (filename) => {
          const [original, built] = await Promise.all([
            readFile(resolve(modelDir, filename)),
            optionalBytes(resolve(root, 'dist/models', filename)),
          ]);
          return Boolean(built?.equals(original));
        }),
      );
      const problems = releaseProblems(
        rows,
        errors,
        assetChecks.every(Boolean),
      );
      if (problems.length) {
        console.error(['Release gate failed.', ...problems].join('\n'));
        process.exitCode = 1;
      } else {
        console.log('The 46-target anatomical release gate passed.');
      }
      break;
    }
    case 'coverage': {
      if (errors.length) throw new Error(errors.join('\n'));
      const tableRows = rows.map((row) => {
        const views = row.figures
          .map(({ figure, view }) => `${figure} (${view})`)
          .join(', ');
        const details =
          row.mapping.status === 'mapped'
            ? row.mapping.components
                .map(
                  ({ label, meshes }) =>
                    `${label} — ${sides.map((side) => meshes[side].map(({ name }) => `\`${name}\``).join(', ')).join(' / ')}`,
                )
                .join('<br>')
            : [
                row.mapping.note,
                ...row.mapping.candidates.map(
                  ({ name }) => `Candidate: \`${name}\``,
                ),
              ].join('<br>');
        const evidence = row.evidence
          ? `[Left / right](${row.evidence.path})`
          : '—';
        return `| \`${row.id}\` · ${row.name} | ${regionLabels[row.region]} | ${row.kind.replaceAll('_', ' ')} | ${views} | ${row.mappingStatus} / ${row.reviewState} | ${row.mapping.initialView} | ${evidence} | ${details} |`;
      });
      const markdown = [
        '# V1 muscle coverage',
        '',
        `**Human-approved: ${counts.humanApproved} / ${releaseTargetCount}**`,
        '',
        `Mapped for review: ${counts.mapped}. Blocked: ${counts.blocked} (${counts.missing} missing, ${counts.partial} partial, ${counts.ambiguous} ambiguous). Pending: ${counts.pending}. Rejected: ${counts.rejected}. Two-side review images: ${counts.withEvidence}.`,
        '',
        'Mapped entries refer to exact decoded mesh metadata. The screenshots show candidate geometry from the initial camera on each side. Human approval is recorded separately.',
        '',
        `Asset: [pinned Écorché revision](${asset.url}), [${asset.license}](../public/models/CC-BY-SA-4.0.txt). Figure 6.22 is textbook page 232; Figure 6.23 is page 233. The [JSON report](MUSCLE_COVERAGE_V1.json) includes source links, laterality, layers, source IDs, occluders and fingerprints.`,
        '',
        '| Target | Region | Kind | Reference figure | Mapping / review | Initial view | Evidence | Exact left / right mesh names or blocker |',
        '| --- | --- | --- | --- | --- | --- | --- | --- |',
        ...tableRows,
        '',
        'Regenerate with `npm run anatomy:coverage`. See [the review instructions](ANATOMY_VALIDATION.md).',
        '',
      ].join('\n');
      const reports = [
        ['MUSCLE_COVERAGE_V1.md', markdown],
        [
          'MUSCLE_COVERAGE_V1.json',
          JSON.stringify({ asset, counts, rows }, null, 2) + '\n',
        ],
      ];
      if (process.argv.includes('--check')) {
        for (const [name, expected] of reports) {
          const bytes = await optionalBytes(resolve(root, 'docs', name));
          if (bytes?.toString().replace(/\r\n/g, '\n') !== expected) {
            throw new Error(
              `docs/${name} is stale. Run npm run anatomy:coverage.`,
            );
          }
        }
        console.log(
          'Both coverage reports match the current model and reviews.',
        );
      } else {
        await mkdir(resolve(root, 'docs'), { recursive: true });
        await Promise.all(
          reports.map(([name, contents]) =>
            writeFile(resolve(root, 'docs', name), contents),
          ),
        );
        console.log(
          'Wrote docs/MUSCLE_COVERAGE_V1.md and docs/MUSCLE_COVERAGE_V1.json.',
        );
      }
      break;
    }
    default:
      throw new Error('Choose validate, coverage, or release.');
  }
} finally {
  model.dispose();
}
