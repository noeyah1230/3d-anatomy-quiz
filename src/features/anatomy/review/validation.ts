import { createHash } from 'node:crypto';
import scope from '../../../data/scope/muscle_scope_v1.json' with { type: 'json' };
import {
  selectTarget,
  type AnatomyModel,
  type MeshMetadata,
} from '../model.ts';
import {
  asset,
  figures,
  mappings,
  references,
  regionLabels,
  releaseTargetCount,
  reviewChecks,
  reviewDirections,
  sides,
  toReviewTarget,
  type AnatomyRecord,
  type HumanDecision,
} from './catalog.ts';

export type ReviewState = 'pending' | 'approved' | 'rejected' | 'blocked';

export type Capture = {
  mappingFingerprint: string;
  sha256: string;
  sides: readonly string[];
};

export function sha256(value: string | Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

function sameSet(actual: readonly string[], expected: readonly string[]) {
  return (
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    expected.every((value) => actual.includes(value))
  );
}

export function mappingFingerprint(record: AnatomyRecord) {
  return sha256(
    JSON.stringify({
      modelSha256: asset.sha256,
      record,
      referenceSources: record.mapping.references.map(
        (reference) => references[reference],
      ),
      views: sides.map((side) => toReviewTarget(record, side)?.focus),
    }),
  );
}

export function validateCatalog(
  records: readonly AnatomyRecord[],
  model: AnatomyModel,
  manifest: readonly MeshMetadata[],
) {
  const errors: string[] = [];
  const scopeIds = scope.targets.map(({ id }) => id);
  if (
    scopeIds.length !== releaseTargetCount ||
    !sameSet(
      records.map(({ id }) => id),
      scopeIds,
    ) ||
    !sameSet(Object.keys(mappings), scopeIds)
  ) {
    errors.push(
      'The catalog must contain exactly the 46 stable scope IDs, once each.',
    );
  }

  if (
    model.meshes.size !== 634 ||
    manifest.length !== model.meshes.size ||
    !sameSet(
      manifest.map(({ name }) => name),
      [...model.meshes.keys()],
    )
  ) {
    errors.push(
      'Decoded GLB and structure manifest disagree on the 634 source mesh names.',
    );
  }
  for (const entry of manifest) {
    const scene = model.meshes.get(entry.name)?.metadata;
    const keys = [
      'name',
      'layer',
      'side',
      'source',
      'group',
      'fma',
      'tissue',
    ] as const;
    if (!scene || keys.some((key) => scene[key] !== entry[key])) {
      errors.push(`Manifest metadata differs from decoded GLB: ${entry.name}.`);
    }
  }

  for (const [figure, { pdfPage, targetCount }] of Object.entries(figures)) {
    const scoped = scope.targets.filter((target) =>
      target.sourceFigures.includes(figure),
    );
    if (
      scoped.length !== targetCount ||
      scoped.some((target) => !target.sourcePages.includes(pdfPage))
    ) {
      errors.push(
        `Figure ${figure} differs from the audited PDF target count or page mapping.`,
      );
    }
  }
  for (const target of scope.targets) {
    const audited = target.sourceFigures.map(
      (figure) => figures[figure as keyof typeof figures]?.pdfPage,
    );
    if (
      audited.some((page) => page === undefined) ||
      !sameSet(target.sourcePages.map(String), audited.map(String))
    ) {
      errors.push(`${target.id}: figure and PDF page references disagree.`);
    }
  }

  const excluded = new Set([
    'Left iliotibial tract',
    'Right iliotibial tract',
    'Left calcaneal tendon',
    'Right calcaneal tendon',
  ]);
  const meshOwners = new Map<string, string>();
  for (const record of records) {
    const { id, mapping } = record;
    const canonical = scope.targets.find((target) => target.id === id);
    if (
      !canonical ||
      canonical.pdfLabel !== record.name ||
      canonical.region !== record.region ||
      canonical.targetKind !== record.kind ||
      !Object.hasOwn(regionLabels, record.region) ||
      !sameSet(record.figures, canonical.sourceFigures) ||
      !sameSet(record.labels, canonical.pdfLabelVariants)
    ) {
      errors.push(
        `${id}: identity, region, or figures differ from the fixed scope.`,
      );
    }
    if (
      !reviewDirections.includes(mapping.initialView) ||
      !mapping.references.length ||
      mapping.references.some(
        (reference) => !Object.hasOwn(references, reference),
      )
    ) {
      errors.push(`${id}: invalid camera or source references.`);
    }

    if (mapping.status !== 'mapped') {
      if (
        !['missing', 'partial', 'ambiguous'].includes(mapping.status) ||
        !mapping.note.trim() ||
        (mapping.status === 'missing'
          ? mapping.candidates.length !== 0
          : !mapping.candidates.length)
      ) {
        errors.push(
          `${id}: unresolved mapping needs a valid reason and candidate policy.`,
        );
      }
      try {
        selectTarget(model, {
          id,
          label: record.name,
          selectors: mapping.candidates,
        });
      } catch (error) {
        errors.push(`${id} candidate: ${String(error)}`);
      }
      continue;
    }

    const labels = mapping.components.map(({ label }) => label);
    if (
      !labels.length ||
      new Set(labels).size !== labels.length ||
      labels.some((label) => !label.trim())
    ) {
      errors.push(`${id}: components must have unique, nonempty labels.`);
    }
    for (const side of sides) {
      const target = toReviewTarget(record, side);
      if (!target) continue;
      const names = target.selectors.map(({ name }) => name);
      if (
        !names.length ||
        mapping.components.some(
          (component) => !component.meshes[side].length,
        ) ||
        mapping.components.some(
          ({ meshes }) => meshes.left.length !== meshes.right.length,
        ) ||
        new Set(names).size !== names.length ||
        target.selectors.some((selector) => selector.side !== side)
      ) {
        errors.push(
          `${id} (${side}): each component needs unique, paired, same-side meshes.`,
        );
      }
      try {
        for (const { mesh, metadata } of selectTarget(model, target)) {
          if (
            !['deep muscles', 'superficial muscles'].includes(metadata.layer) ||
            !['BodyParts3D', 'Z-Anatomy'].includes(metadata.source) ||
            excluded.has(metadata.name) ||
            (mesh.geometry.getAttribute('position')?.count ?? 0) < 3
          ) {
            errors.push(
              `${id}: ${metadata.name} is ineligible as a muscle mesh.`,
            );
          }
          if (
            metadata.group &&
            manifest.some(
              (entry) =>
                entry.group === metadata.group &&
                entry.side === side &&
                !names.includes(entry.name),
            )
          ) {
            errors.push(
              `${id} (${side}): source group ${metadata.group} is incomplete.`,
            );
          }
          const owner = meshOwners.get(metadata.name);
          if (owner && owner !== id)
            errors.push(`${metadata.name} is reused by ${owner} and ${id}.`);
          meshOwners.set(metadata.name, id);
        }
      } catch (error) {
        errors.push(`${id} (${side}): ${String(error)}`);
      }
      for (const name of target.focus?.contextBones ?? []) {
        if (model.meshes.get(name)?.metadata.layer !== 'skeleton') {
          errors.push(`${id} (${side}): invalid skeleton landmark ${name}.`);
        }
      }
      for (const hidden of target.hiddenNames ?? []) {
        if (
          names.includes(hidden) ||
          model.meshes.get(hidden)?.metadata.side !== side
        ) {
          errors.push(`${id} (${side}): invalid hidden source mesh ${hidden}.`);
        }
      }
    }
  }
  return errors;
}

export function resolveReview(
  record: AnatomyRecord,
  decision: HumanDecision | undefined,
  capture: Capture | undefined,
  actualScreenshotSha256: string | undefined,
): { state: ReviewState; captureValid: boolean; issue?: string } {
  const fingerprint = mappingFingerprint(record);
  const captureValid = Boolean(
    capture &&
    capture.mappingFingerprint === fingerprint &&
    /^[a-f0-9]{64}$/.test(capture.sha256) &&
    capture.sha256 === actualScreenshotSha256 &&
    sameSet(capture.sides, sides),
  );

  if (record.mapping.status !== 'mapped') {
    return {
      state: 'blocked',
      captureValid: false,
      ...(decision && {
        issue: 'Unresolved geometry cannot carry a human decision.',
      }),
    };
  }
  if (!decision) return { state: 'pending', captureValid };
  const { reviewer, date, note, state } = decision;
  const isoDay =
    typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? new Date(date)
      : null;
  if (
    typeof reviewer !== 'string' ||
    !reviewer.trim() ||
    typeof note !== 'string' ||
    !note.trim() ||
    !isoDay ||
    Number.isNaN(isoDay.valueOf()) ||
    isoDay.toISOString().slice(0, 10) !== date ||
    decision.mappingFingerprint !== fingerprint
  ) {
    return {
      state: 'pending',
      captureValid,
      issue: 'Human decision is incomplete or stale.',
    };
  }
  if (state === 'rejected') return { state, captureValid };
  if (
    state === 'approved' &&
    Array.isArray(decision.checks) &&
    sameSet(decision.checks, reviewChecks) &&
    captureValid &&
    decision.screenshotSha256 === capture?.sha256
  ) {
    return { state, captureValid };
  }
  return {
    state: 'pending',
    captureValid,
    issue:
      'Approval requires all checks and current two-side screenshot evidence.',
  };
}

export function releaseProblems(
  rows: readonly {
    id: string;
    mappingStatus: string;
    reviewState: ReviewState;
    captureValid: boolean;
  }[],
  errors: readonly string[],
  builtAssetMatches: boolean,
) {
  const problems = [...errors];
  if (
    !sameSet(
      rows.map(({ id }) => id),
      scope.targets.map(({ id }) => id),
    ) ||
    rows.length !== releaseTargetCount
  )
    problems.push('Release requires the 46 canonical targets.');
  if (!builtAssetMatches)
    problems.push(
      'Build dist/ with the pinned model, inventory, license and attribution.',
    );
  for (const { id, mappingStatus, reviewState, captureValid } of rows) {
    if (
      mappingStatus !== 'mapped' ||
      reviewState !== 'approved' ||
      !captureValid
    ) {
      problems.push(
        `${id}: ${mappingStatus}, review ${reviewState}${captureValid ? '' : ', evidence missing or stale'}.`,
      );
    }
  }
  return problems;
}
