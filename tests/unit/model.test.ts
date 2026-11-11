import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  parseAnatomyModel,
  selectTarget,
  type MeshMetadata,
} from '../../src/features/anatomy/model';
import { previewTargets } from '../../src/features/anatomy/targets';
import {
  createFocusMaterials,
  planFocus,
} from '../../src/features/anatomy/visuals/materials';

const files = new URL('../../public/models/', import.meta.url);
const modelFile = readFileSync(new URL('ecorche.meshopt.glb', files));
const manifestFile = readFileSync(new URL('ecorche.structures.json', files));

describe('pinned Écorché prototype', () => {
  it('keeps the GLB and structure inventory at the reviewed upstream revision', () => {
    expect(createHash('sha256').update(modelFile).digest('hex')).toBe(
      'cc43a8b4f218bee5da78d6c1746bd21470d1d93c6878e33b4ccdbcfc7a72b98e',
    );
    expect(createHash('sha256').update(manifestFile).digest('hex')).toBe(
      'c0705d69007acad8620541998329b904daca4995cb5790eeac63344544f56a29',
    );
  });

  it('decodes the actual meshopt scene and resolves the exact left-side pieces', async () => {
    const model = await parseAnatomyModel(Uint8Array.from(modelFile).buffer);
    try {
      const manifest: MeshMetadata[] = JSON.parse(manifestFile.toString());
      expect(model.meshes.size).toBe(634);
      expect([...model.meshes.keys()].sort()).toEqual(
        manifest.map(({ name }) => name).sort(),
      );
      const [masseter, temporalis] = previewTargets;
      expect(
        selectTarget(model, masseter).map(({ metadata }) => metadata.name),
      ).toEqual([
        'Left superficial part of masseter',
        'Left deep part of masseter',
      ]);
      const [temple] = selectTarget(model, temporalis);
      expect(temple?.metadata.name).toBe('Left temporalis');
      expect(
        temple?.mesh.geometry.getAttribute('position').count,
      ).toBeGreaterThan(0);

      const highlighted = (target: typeof masseter | typeof temporalis) =>
        [...planFocus(model, target).roles]
          .filter(([, role]) => role === 'target')
          .map(([name]) => name)
          .sort();

      expect(highlighted(masseter)).toEqual([
        'Left deep part of masseter',
        'Left superficial part of masseter',
      ]);
      expect(highlighted(temporalis)).toEqual(['Left temporalis']);
    } finally {
      model.dispose();
    }
  });

  it('keeps the target opaque and changes only its hue when switching red to blue', () => {
    const materials = createFocusMaterials();
    try {
      materials.update('dark', 'red');
      const gray = materials.context.color.getHexString();
      expect(materials.target.color.getHexString()).toBe('e35e69');
      expect(materials.target.opacity).toBe(1);
      expect(materials.target.transparent).toBe(false);
      expect(materials.target.vertexColors).toBe(false);
      expect(materials.context.opacity).toBeLessThan(1);
      materials.update('dark', 'blue');
      expect(materials.target.color.getHexString()).toBe('539dde');
      expect(materials.context.color.getHexString()).toBe(gray);
    } finally {
      materials.dispose();
    }
  });
});
