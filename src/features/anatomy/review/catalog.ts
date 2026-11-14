import scope from '../../../data/scope/muscle_scope_v1.json' with { type: 'json' };
import sourceMappings from '../../../data/anatomy/mappings-v1.json' with { type: 'json' };
import humanReviews from '../../../data/anatomy/human-reviews-v1.json' with { type: 'json' };
import type { MeshSelector, PreviewTarget } from '../targets.ts';

export const releaseTargetCount = 46;

export const asset = {
  revision: '320805e06aee51e2e6f6b22533eb2a59d43f2d4d',
  url: 'https://github.com/Charleeh/ecorche/tree/320805e06aee51e2e6f6b22533eb2a59d43f2d4d',
  license: 'CC BY-SA 4.0',
  model: 'ecorche.meshopt.glb',
  manifest: 'ecorche.structures.json',
  notices: {
    'CC-BY-SA-4.0.txt':
      '258ed63e18dedbb7183b2098bdc04e363301ba58bc6aaaf90dd00f4faf198680',
    'ECORCHE_ATTRIBUTION.md':
      'a8ab15675197a2423728b50ef641f1a5be0be736bfe6737318bacd0c34efb431',
  },
  sha256: 'cc43a8b4f218bee5da78d6c1746bd21470d1d93c6878e33b4ccdbcfc7a72b98e',
  manifestSha256:
    'c0705d69007acad8620541998329b904daca4995cb5790eeac63344544f56a29',
} as const;

export const references = {
  head: [
    'OpenStax §11.3: Head, neck and back',
    'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-3-axial-muscles-of-the-head-neck-and-back',
  ],
  shoulder: [
    'OpenStax §11.5: Pectoral girdle and upper limbs',
    'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs',
  ],
  thorax: [
    'OpenStax §11.4: Abdominal wall and thorax',
    'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax',
  ],
  upper: [
    'OpenStax §11.5: Pectoral girdle and upper limbs',
    'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs',
  ],
  lower: [
    'OpenStax §11.6: Pelvic girdle and lower limbs',
    'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs',
  ],
  keyTerms: [
    'OpenStax: Iliopsoas definition',
    'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-key-terms',
  ],
  minimus: [
    'Choi et al.: Adductor minimus morphology',
    'https://pubmed.ncbi.nlm.nih.gov/32896868/',
  ],
  terminology: [
    'IFAA: Facial muscle partonomy',
    'https://ifaa.unifr.ch/Public/TNAEntryPage/auto/part/LAEN/TAH29056%20P3F%20EN.htm',
  ],
  bodyparts3d: [
    'DBCLS: BodyParts3D 4.0 catalog and element mesh index',
    'https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/README_e.html',
  ],
  bodyexplorer: [
    'BodyExplorer: Upstream mesh metadata',
    'https://github.com/JohanBellander/BodyExplorer/blob/7d04bf3c4de2bd9cb234dd51d7e6857c099afafd/public/mesh_mapping.json',
  ],
  zanatomy: [
    'Z-Anatomy: Original atlas release',
    'https://zenodo.org/records/4953712',
  ],
} as const;

export const figures = {
  '6.22': { view: 'anterior', page: 232, pdfPage: 1, targetCount: 35 },
  '6.23': { view: 'posterior', page: 233, pdfPage: 2, targetCount: 21 },
} as const;

export const regionLabels = {
  head_face: 'Head & face',
  neck: 'Neck',
  shoulder_back: 'Shoulder & back',
  thorax: 'Thorax',
  upper_arm: 'Upper arm',
  forearm: 'Forearm',
  abdomen: 'Abdomen',
  hip_thigh: 'Hip & thigh',
  lower_leg: 'Lower leg',
} as const;

const directions = {
  anterior: [0, 0.06, 1],
  posterior: [0, 0.04, -1],
  anterolateral: [0.95, 0.06, 0.75],
  posterolateral: [0.75, 0.06, -1],
  lateral: [1, 0.04, 0.15],
  'medial-anterior': [-0.55, 0.06, 1],
  posteromedial: [-0.55, 0.06, -1],
} as const;

export const reviewDirections = Object.keys(directions);
export const sides = ['left', 'right'] as const;
export type Side = (typeof sides)[number];
export type ReviewSide = Side | 'both';

type Component = {
  label: string;
  meshes: Record<Side, readonly MeshSelector[]>;
};

type MappingBase = {
  initialView: keyof typeof directions;
  references: readonly (keyof typeof references)[];
  note?: string;
};

export type Mapped = MappingBase & {
  status: 'mapped';
  components: readonly Component[];
  hide?: Record<Side, readonly string[]>;
};

type Unresolved = MappingBase & {
  status: 'missing' | 'partial' | 'ambiguous';
  note: string;
  candidates: readonly MeshSelector[];
  requiredComponents?: readonly string[];
};

export type Mapping = Mapped | Unresolved;

export type AnatomyRecord = {
  id: string;
  name: string;
  region: keyof typeof regionLabels;
  kind: string;
  labels: readonly string[];
  figures: readonly (keyof typeof figures)[];
  laterality: 'bilateral' | 'midline ring (two model halves)';
  figureNote?: string;
  mapping: Mapping;
};

export const reviewChecks = [
  'identity',
  'components',
  'laterality',
  'figure alignment',
  'visibility',
] as const;

export type HumanDecision = {
  state: 'approved' | 'rejected';
  reviewer: string;
  date: string;
  mappingFingerprint: string;
  note: string;
  checks?: readonly string[];
  screenshotSha256?: string;
  acceptedAnswers?: readonly string[];
  explanation?: string;
};

export const recordedDecisions: Readonly<Record<string, HumanDecision>> =
  humanReviews as Record<string, HumanDecision>;
export const mappings = sourceMappings as Record<string, Mapping>;

export const records: readonly AnatomyRecord[] = scope.targets.map((target) => {
  const mapping = mappings[target.id];
  if (!mapping) throw new Error(`Missing anatomy mapping for ${target.id}`);
  return {
    id: target.id,
    name: target.pdfLabel,
    labels: target.pdfLabelVariants,
    region: target.region as AnatomyRecord['region'],
    kind: target.targetKind,
    figures: target.sourceFigures as AnatomyRecord['figures'],
    laterality:
      target.id === 'orbicularis_oris'
        ? 'midline ring (two model halves)'
        : 'bilateral',
    figureNote: scope.sourceNotes.find((entry) => entry.targetId === target.id)
      ?.note,
    mapping,
  };
});

const forearmLandmarks = [
  'humerus',
  'radius',
  'ulna',
  'scaphoid',
  'lunate',
  'capitate',
  'hamate',
  'trapezium',
  'trapezoid',
  'pisiform',
  'first metacarpal bone',
  'second metacarpal bone',
  'third metacarpal bone',
  'fourth metacarpal bone',
  'fifth metacarpal bone',
];
const thighLandmarks = ['hip bone', 'femur', 'patella', 'tibia', 'fibula'];
const upperSideName = { left: 'Left', right: 'Right' } as const;

function contextBones(
  region: AnatomyRecord['region'],
  selectedSides: readonly Side[],
) {
  if (region === 'forearm') {
    return selectedSides.flatMap((side) => [
      ...forearmLandmarks.map((bone) => `${upperSideName[side]} ${bone}`),
      ...[
        'index finger',
        'middle finger',
        'ring finger',
        'little finger',
        'thumb',
      ].flatMap((finger) =>
        (finger === 'thumb'
          ? ['Proximal', 'Distal']
          : ['Proximal', 'Middle', 'Distal']
        ).map((part) => `${part} phalanx of ${side} ${finger}`),
      ),
    ]);
  }
  if (region === 'hip_thigh') {
    return [
      'Sacrum',
      ...sides.flatMap((side) =>
        thighLandmarks.map((bone) => `${upperSideName[side]} ${bone}`),
      ),
    ];
  }
}

export function toReviewTarget(
  record: AnatomyRecord,
  side: ReviewSide,
  componentIndex: number | null = null,
  meshIndex: number | null = null,
): PreviewTarget | null {
  if (record.mapping.status !== 'mapped') return null;
  const { components, hide, initialView } = record.mapping;
  const selected =
    componentIndex === null
      ? components
      : components.slice(componentIndex, componentIndex + 1);
  if (!selected.length) return null;
  const selectedSides = side === 'both' ? sides : [side];
  const allSelectors = components.flatMap((component) =>
    selectedSides.flatMap((side) => component.meshes[side]),
  );
  const selectors = selected.flatMap((component) =>
    selectedSides.flatMap((side) =>
      meshIndex === null
        ? component.meshes[side]
        : component.meshes[side].slice(meshIndex, meshIndex + 1),
    ),
  );
  if (!selectors.length) return null;
  const hiddenNames = selectedSides.flatMap((side) => hide?.[side] ?? []);
  if (componentIndex !== null) {
    const selectedNames = new Set(selectors.map(({ name }) => name));
    hiddenNames.push(
      ...allSelectors
        .filter(({ name }) => !selectedNames.has(name))
        .map(({ name }) => name),
    );
  }
  const [x, y, z] = directions[initialView];
  const isHead = record.region === 'head_face';
  return {
    id: record.id,
    label: record.name,
    selectors,
    hiddenNames,
    focus: {
      direction: [side === 'right' ? -x : side === 'both' ? 0 : x, y, z],
      minRadius: isHead ? 0.135 : 0.085,
      centerYOffset: isHead ? 0.02 : 0,
      contextRadius: isHead ? 0.175 : 0.125,
      contextBones: contextBones(record.region, selectedSides),
    },
  };
}
