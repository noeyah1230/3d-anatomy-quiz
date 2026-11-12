export type MeshSelector = {
  name: string;
  layer: 'deep muscles' | 'superficial muscles';
  side: 'left' | 'right' | 'midline';
  source: 'Z-Anatomy' | 'BodyParts3D';
  group?: string;
  fma?: string;
};

export type PreviewTarget = {
  id: string;
  label: string;
  selectors: readonly MeshSelector[];
  hiddenNames?: readonly string[];
  focus?: {
    direction: readonly [number, number, number];
    minRadius: number;
    centerYOffset: number;
    contextRadius: number;
    contextBones?: readonly string[];
  };
};

export const previewTargets = [
  {
    id: 'masseter',
    label: 'Masseter',
    selectors: [
      {
        name: 'Left superficial part of masseter',
        layer: 'superficial muscles',
        side: 'left',
        source: 'Z-Anatomy',
        group: 'Left masseter',
      },
      {
        name: 'Left deep part of masseter',
        layer: 'deep muscles',
        side: 'left',
        source: 'Z-Anatomy',
        group: 'Left masseter',
      },
    ],
  },
  {
    id: 'temporalis',
    label: 'Temporalis',
    selectors: [
      {
        name: 'Left temporalis',
        layer: 'superficial muscles',
        side: 'left',
        source: 'Z-Anatomy',
      },
    ],
  },
] as const satisfies readonly [PreviewTarget, ...PreviewTarget[]];
