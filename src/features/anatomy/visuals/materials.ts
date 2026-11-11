import { Box3, MeshStandardMaterial, Vector3 } from 'three';
import { selectTarget, type AnatomyModel } from '../model';
import type { PreviewTarget } from '../targets';

export type VisualRole = 'target' | 'context' | 'dimmed' | 'hidden';
export type Highlight = 'red' | 'blue';
export type Theme = 'dark' | 'light';

const palette = {
  dark: {
    red: '#e35e69',
    blue: '#539dde',
    context: '#a5adb8',
    dimmed: '#78818f',
  },
  light: {
    red: '#b52e44',
    blue: '#1669ab',
    context: '#535c6a',
    dimmed: '#606778',
  },
} as const;

export function resolveRole(
  target: boolean,
  nearby: boolean,
  layer: string,
): VisualRole {
  if (target) return 'target';
  if (!nearby) return 'hidden';
  if (layer === 'skeleton') return 'context';
  return layer === 'superficial muscles' ? 'dimmed' : 'hidden';
}

export function createFocusMaterials() {
  const surface = { vertexColors: false, roughness: 0.88 };
  const target = new MeshStandardMaterial(surface);
  const context = new MeshStandardMaterial({
    ...surface,
    transparent: true,
    depthWrite: false,
  });
  const dimmed = new MeshStandardMaterial({
    ...surface,
    transparent: true,
    depthWrite: false,
  });

  return {
    target,
    context,
    dimmed,
    update(theme: Theme, highlight: Highlight) {
      target.color.set(palette[theme][highlight]);
      context.color.set(palette[theme].context);
      context.opacity = theme === 'dark' ? 0.28 : 0.25;
      dimmed.color.set(palette[theme].dimmed);
      dimmed.opacity = theme === 'dark' ? 0.09 : 0.12;
    },
    dispose() {
      target.dispose();
      context.dispose();
      dimmed.dispose();
    },
  };
}

export function planFocus(model: AnatomyModel, target: PreviewTarget) {
  const entries = selectTarget(model, target);
  const bounds = new Box3();
  const names = new Set(entries.map((entry) => entry.metadata.name));
  for (const entry of entries) bounds.union(entry.bounds);

  const center = bounds.getCenter(new Vector3());
  const roles = new Map<string, VisualRole>();
  for (const [name, entry] of model.meshes) {
    const distance = entry.bounds.getCenter(new Vector3()).distanceTo(center);
    roles.set(
      name,
      resolveRole(names.has(name), distance < 0.175, entry.metadata.layer),
    );
  }
  return { bounds, roles };
}
