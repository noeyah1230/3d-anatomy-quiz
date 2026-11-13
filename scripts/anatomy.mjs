import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  asset,
  regionLabels,
  releaseTargetCount,
  sides,
} from '../src/features/anatomy/review/catalog.ts';
import { releaseProblems } from '../src/features/anatomy/review/validation.ts';
import { optionalBytes, readAnatomyAudit } from './anatomy-audit.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const modelDir = resolve(root, 'public/models');
const { rows, errors } = await readAnatomyAudit(root);
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
    const problems = releaseProblems(rows, errors, assetChecks.every(Boolean));
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
      console.log('Both coverage reports match the current model and reviews.');
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
