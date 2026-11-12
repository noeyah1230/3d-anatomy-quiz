import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  parseAnatomyModel,
  type AnatomyModel,
  type MeshMetadata,
} from '../../src/features/anatomy/model';
import {
  records,
  reviewChecks,
  toReviewTarget,
  type AnatomyRecord,
  type HumanDecision,
} from '../../src/features/anatomy/review/catalog';
import {
  mappingFingerprint,
  releaseProblems,
  resolveReview,
  validateCatalog,
  type Capture,
} from '../../src/features/anatomy/review/validation';
import { planFocus } from '../../src/features/anatomy/visuals/materials';

function entry(id: string) {
  const record = records.find((record) => record.id === id);
  if (!record) throw new Error(`Missing test fixture for ${id}`);
  return record;
}

function mappedTarget(id: string, side: 'left' | 'right') {
  const target = toReviewTarget(entry(id), side);
  if (!target) throw new Error(`Expected mapped target ${id}`);
  return target;
}

describe('the Phase 2 catalog against the real model', () => {
  let model: AnatomyModel;
  const modelDir = new URL('../../public/models/', import.meta.url);
  const manifest: MeshMetadata[] = JSON.parse(
    readFileSync(new URL('ecorche.structures.json', modelDir), 'utf8'),
  );

  beforeAll(async () => {
    model = await parseAnatomyModel(
      Uint8Array.from(readFileSync(new URL('ecorche.meshopt.glb', modelDir)))
        .buffer,
    );
  });
  afterAll(() => model?.dispose());

  it('validates all 46 records against the decoded model and keeps four unresolved targets out of review rendering', () => {
    expect(validateCatalog(records, model, manifest)).toEqual([]);
    expect(
      records.filter(({ mapping }) => mapping.status === 'mapped'),
    ).toHaveLength(42);
    for (const id of [
      'occipitalis',
      'platysma',
      'intercostals',
      'zygomaticus',
    ]) {
      expect(toReviewTarget(entry(id), 'left')).toBeNull();
      expect(
        resolveReview(entry(id), undefined, undefined, undefined).state,
      ).toBe('blocked');
    }
  });

  it('rejects missing or duplicate IDs, wrong sides, missing parts, and manifest metadata drift', () => {
    const masseter = entry('masseter');
    if (masseter.mapping.status !== 'mapped')
      throw new Error('Masseter fixture is unmapped');
    const superficial = masseter.mapping.components[0];
    if (!superficial)
      throw new Error('Masseter fixture is missing its superficial part');
    const incomplete: AnatomyRecord = {
      ...masseter,
      mapping: { ...masseter.mapping, components: [superficial] },
    };
    const wrongSide: AnatomyRecord = {
      ...masseter,
      mapping: {
        ...masseter.mapping,
        components: [
          {
            ...superficial,
            meshes: { ...superficial.meshes, left: superficial.meshes.right },
          },
        ],
      },
    };
    const mutated = (record: AnatomyRecord) =>
      records.map((item) => (item.id === record.id ? record : item));
    expect(
      validateCatalog([masseter, ...records.slice(1)], model, manifest),
    ).toContain(
      'The catalog must contain exactly the 46 stable scope IDs, once each.',
    );
    expect(
      validateCatalog(mutated(incomplete), model, manifest).join(' '),
    ).toMatch(/source group Left masseter is incomplete/);
    expect(
      validateCatalog(mutated(wrongSide), model, manifest).join(' '),
    ).toMatch(/same-side meshes/);
    const manifestDrift = manifest.map((mesh) =>
      mesh.name === 'Left temporalis' ? { ...mesh, source: 'Unknown' } : mesh,
    );
    expect(validateCatalog(records, model, manifestDrift)).toContain(
      'Manifest metadata differs from decoded GLB: Left temporalis.',
    );
  });

  it('preserves the reviewed-in-reference group definitions and keeps similar names separate', () => {
    const names = (id: string) =>
      mappedTarget(id, 'left').selectors.map(({ name }) => name);
    expect(names('iliopsoas')).toEqual(['Left iliacus', 'Left psoas major']);
    expect(names('adductor_muscles')).toEqual([
      'Left adductor longus',
      'Left adductor brevis',
      'Left adductor magnus',
      'Left adductor minimus',
      'Left gracilis',
      'Left pectineus',
    ]);
    expect(names('extensor_carpi_ulnaris')).toEqual([
      'Left extensor carpi ulnaris',
      'Left extensor carpi ulnaris (2)',
    ]);
    expect(names('extensor_digitorum')).toEqual(['Left extensor digitorum']);
    expect(names('extensor_digitorum_longus')).toEqual([
      'Left extensor digitorum longus',
    ]);
    expect(entry('intercostals').mapping).toMatchObject({
      status: 'partial',
      requiredComponents: [
        'External intercostals',
        'Internal intercostals',
        'Innermost intercostals',
      ],
      candidates: [{ name: 'External intercostal muscle', side: 'midline' }],
    });
  });

  it('isolates the deep part without changing the Masseter record and hides the deep thigh occluder', () => {
    const masseter = entry('masseter');
    const isolated = toReviewTarget(masseter, 'right', 1);
    if (!isolated) throw new Error('Deep Masseter view is missing');
    const highlighted = [...planFocus(model, isolated).roles]
      .filter(([, role]) => role === 'target')
      .map(([name]) => name);
    expect(highlighted).toEqual(['Right deep part of masseter']);
    expect(
      planFocus(model, isolated).roles.get(
        'Right superficial part of masseter',
      ),
    ).toBe('hidden');
    expect(mappedTarget('masseter', 'right').selectors).toHaveLength(2);

    const deepThigh = planFocus(
      model,
      mappedTarget('vastus_intermedius', 'left'),
    );
    expect(deepThigh.roles.get('Left vastus intermedius')).toBe('target');
    expect(deepThigh.roles.get('Left rectus femoris')).toBe('hidden');
  });
});

describe('human decisions and release evidence', () => {
  const record = entry('masseter');
  const fingerprint = mappingFingerprint(record);
  const imageSha = '1'.repeat(64);
  const capture: Capture = {
    mappingFingerprint: fingerprint,
    sha256: imageSha,
    sides: ['left', 'right'],
  };
  const decision: HumanDecision = {
    state: 'approved',
    reviewer: 'Test reviewer',
    date: '2026-11-11',
    mappingFingerprint: fingerprint,
    screenshotSha256: imageSha,
    note: 'Synthetic validation fixture',
    checks: reviewChecks,
  };

  it('requires an explicit, current decision tied to a verified two-side screenshot', () => {
    expect(resolveReview(record, undefined, capture, imageSha)).toMatchObject({
      state: 'pending',
      captureValid: true,
    });
    expect(resolveReview(record, decision, capture, imageSha).state).toBe(
      'approved',
    );
    expect(
      resolveReview(
        record,
        { ...decision, state: 'rejected' },
        capture,
        imageSha,
      ).state,
    ).toBe('rejected');
    expect(resolveReview(record, decision, capture, '2'.repeat(64)).state).toBe(
      'pending',
    );
    expect(
      resolveReview(record, decision, { ...capture, sides: ['left'] }, imageSha)
        .state,
    ).toBe('pending');
    expect(
      resolveReview(
        { ...record, name: 'Changed identity' },
        decision,
        capture,
        imageSha,
      ).state,
    ).toBe('pending');
    expect(
      resolveReview(
        record,
        { ...decision, checks: ['identity'] },
        capture,
        imageSha,
      ).state,
    ).toBe('pending');
    expect(
      resolveReview(entry('occipitalis'), decision, capture, imageSha).state,
    ).toBe('blocked');
  });

  it('fails the release gate for any missing ID, review, evidence, or build asset', () => {
    const rows = records.map(({ id }) => ({
      id,
      mappingStatus: 'mapped',
      reviewState: 'approved' as const,
      captureValid: true,
    }));
    expect(releaseProblems(rows, [], true)).toEqual([]);
    expect(releaseProblems(rows.slice(1), [], true)).toContain(
      'Release requires the 46 canonical targets.',
    );
    expect(releaseProblems(rows, [], false)).toHaveLength(1);
    expect(
      releaseProblems(
        rows.map((row) =>
          row.id === 'soleus' ? { ...row, reviewState: 'pending' } : row,
        ),
        [],
        true,
      ),
    ).toHaveLength(1);
    expect(
      releaseProblems(
        rows.map((row) =>
          row.id === 'soleus' ? { ...row, captureValid: false } : row,
        ),
        [],
        true,
      ),
    ).toHaveLength(1);
    expect(
      releaseProblems(
        rows.map((row) =>
          row.id === 'soleus' ? { ...row, mappingStatus: 'partial' } : row,
        ),
        [],
        true,
      ),
    ).toHaveLength(1);
  });
});
