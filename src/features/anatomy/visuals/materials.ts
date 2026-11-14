import { Box3, MeshStandardMaterial, Vector3 } from 'three';
import { selectTarget, type AnatomyModel } from '../model.ts';
import type { PreviewTarget } from '../targets.ts';
import { defaultAppearance, type Appearance } from './appearance.ts';

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
    update(theme: Theme, highlight: Highlight, appearance = defaultAppearance) {
      const scale = Math.min(100, Math.max(0, appearance.opacity)) / 50;
      const contextBoost =
        appearance.mode === 'Context'
          ? 1.2
          : appearance.mode === 'Strict Quiz'
            ? 0.7
            : 1;
      const muscleBoost = appearance.mode === 'Context' ? 1.5 : 1;
      target.color.set(palette[theme][highlight]);
      context.color.set(palette[theme].context);
      context.opacity = (theme === 'dark' ? 0.28 : 0.25) * scale * contextBoost;
      dimmed.color.set(palette[theme].dimmed);
      dimmed.opacity = (theme === 'dark' ? 0.09 : 0.12) * scale * muscleBoost;
    },
    dispose() {
      target.dispose();
      context.dispose();
      dimmed.dispose();
    },
  };
}

export function targetFrame(model: AnatomyModel, target: PreviewTarget) {
  const entries = selectTarget(model, target);
  const bounds = new Box3();
  const names = new Set(entries.map((entry) => entry.metadata.name));
  for (const entry of entries) bounds.union(entry.bounds);

  return { bounds, names };
}

export function planFocus(
  model: AnatomyModel,
  target: PreviewTarget,
  appearance: Appearance = defaultAppearance,
  { bounds, names } = targetFrame(model, target),
) {
  const center = bounds.getCenter(new Vector3());
  const contextRadius = target.focus
    ? Math.max(
        target.focus.contextRadius,
        bounds.getSize(new Vector3()).length() * 0.55,
      )
    : 0.175;
  const radiusFactor =
    appearance.mode === 'Context'
      ? 1.35
      : appearance.mode === 'Strict Quiz'
        ? 0.65
        : 1;
  const hidden = new Set(target.hiddenNames);
  const contextBones =
    target.focus?.contextBones && new Set(target.focus.contextBones);
  const roles = new Map<string, VisualRole>();
  for (const [name, entry] of model.meshes) {
    const distance = entry.bounds.getCenter(new Vector3()).distanceTo(center);
    const layer = entry.metadata.layer;
    const nearby = distance < contextRadius * radiusFactor;
    const visible =
      layer === 'skeleton'
        ? appearance.bones && (!contextBones || contextBones.has(name))
        : appearance.muscles && appearance.mode !== 'Strict Quiz';

    if (names.has(name)) roles.set(name, 'target');
    else if (hidden.has(name) || !visible || !nearby) roles.set(name, 'hidden');
    else if (appearance.mode === 'Context' && layer === 'deep muscles')
      roles.set(name, 'dimmed');
    else roles.set(name, resolveRole(false, true, layer));
  }
  return { bounds, roles };
}
