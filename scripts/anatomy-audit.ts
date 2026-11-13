import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseAnatomyModel } from '../src/features/anatomy/model.ts';
import {
  asset,
  figures,
  recordedDecisions,
  records,
  references,
  sides,
} from '../src/features/anatomy/review/catalog.ts';
import {
  mappingFingerprint,
  resolveReview,
  sha256,
  validateCatalog,
  type Capture,
} from '../src/features/anatomy/review/validation.ts';

export async function optionalBytes(path: string) {
  try {
    return await readFile(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

export async function readAnatomyAudit(root: string) {
  const modelDir = resolve(root, 'public/models');
  const screenshotDir = resolve(root, 'docs/screenshots/anatomy');
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
    const errors = validateCatalog(
      records,
      model,
      JSON.parse(manifestBytes.toString('utf8')),
    );
    const captureBytes = await optionalBytes(
      resolve(screenshotDir, 'captures.json'),
    );
    const captures: Record<string, Capture> = captureBytes
      ? JSON.parse(captureBytes.toString('utf8'))
      : {};
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
                sha256: capture?.sha256,
                sides,
              }
            : undefined,
        };
      }),
    );
    return { rows, errors };
  } finally {
    model.dispose();
  }
}
