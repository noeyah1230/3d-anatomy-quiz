import { Box3, Mesh, type Material, type Object3D } from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  previewTargets,
  type MeshSelector,
  type PreviewTarget,
} from './targets.ts';

export type MeshMetadata = {
  name: string;
  layer: string;
  side: string;
  source: string;
  group?: string;
  fma?: string;
  tissue?: string;
};

type AnatomyMesh = {
  mesh: Mesh;
  metadata: MeshMetadata;
  bounds: Box3;
  originalMaterial: Material | Material[];
};

export type AnatomyModel = {
  root: Object3D;
  meshes: ReadonlyMap<string, AnatomyMesh>;
  dispose: () => void;
};

function readMetadata(data: Record<string, unknown>): MeshMetadata {
  const { name, layer, side, source, group, fma, tissue } = data;
  if (
    typeof name !== 'string' ||
    typeof layer !== 'string' ||
    typeof side !== 'string' ||
    typeof source !== 'string'
  ) {
    throw new Error(
      'The anatomy asset contains a mesh without structure metadata.',
    );
  }
  return {
    name,
    layer,
    side,
    source,
    group: typeof group === 'string' ? group : undefined,
    fma: typeof fma === 'string' ? fma : undefined,
    tissue: typeof tissue === 'string' ? tissue : undefined,
  };
}

function matches(metadata: MeshMetadata, selector: MeshSelector) {
  return (
    metadata.name === selector.name &&
    metadata.side === selector.side &&
    metadata.source === selector.source &&
    metadata.layer === selector.layer &&
    metadata.group === selector.group &&
    (selector.fma === undefined || metadata.fma === selector.fma)
  );
}

export function selectTarget(model: AnatomyModel, target: PreviewTarget) {
  return target.selectors.map((selector) => {
    const entry = model.meshes.get(selector.name);
    if (
      !entry ||
      !matches(entry.metadata, selector) ||
      entry.bounds.isEmpty()
    ) {
      throw new Error(
        `Expected source mesh missing or mismatched: ${selector.name}`,
      );
    }
    return entry;
  });
}

export async function parseAnatomyModel(
  bytes: ArrayBuffer,
): Promise<AnatomyModel> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const { scene: root } = await loader.parseAsync(bytes, '');
  root.updateMatrixWorld(true);
  const meshes = new Map<string, AnatomyMesh>();
  const allMeshes: Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof Mesh) allMeshes.push(object);
  });
  const geometries = new Set(allMeshes.map((mesh) => mesh.geometry));
  const materials = new Set(
    allMeshes.flatMap((mesh) => mesh.material as Material | Material[]),
  );

  const model = {
    root,
    meshes,
    dispose() {
      for (const { mesh, originalMaterial } of meshes.values()) {
        mesh.material = originalMaterial;
      }
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };

  try {
    for (const mesh of allMeshes) {
      const metadata = readMetadata(mesh.userData);
      if (meshes.has(metadata.name)) {
        throw new Error(`Duplicate source mesh name: ${metadata.name}`);
      }
      const bounds = new Box3().setFromObject(mesh);
      meshes.set(metadata.name, {
        mesh,
        metadata,
        bounds,
        originalMaterial: mesh.material,
      });
    }
    for (const target of previewTargets) selectTarget(model, target);
    return model;
  } catch (error) {
    model.dispose();
    throw error;
  }
}

export async function loadAnatomyModel(
  signal: AbortSignal,
  onProgress: (percent: number) => void,
  expectedSha256?: string,
) {
  async function decode(bytes: ArrayBuffer) {
    signal.throwIfAborted();
    if (expectedSha256) {
      const digest = new Uint8Array(
        await crypto.subtle.digest('SHA-256', bytes),
      );
      const actual = Array.from(digest, (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');
      if (actual !== expectedSha256)
        throw new Error('The quiz model does not match its approved revision.');
    }
    signal.throwIfAborted();
    return parseAnatomyModel(bytes);
  }

  const modelUrl = `${import.meta.env.BASE_URL}models/ecorche.meshopt.glb`;
  const response = await fetch(modelUrl, { signal });
  if (!response.ok)
    throw new Error(`Model request failed (HTTP ${response.status}).`);
  const size = Number(response.headers.get('content-length'));
  const body = response.body;
  if (size > 0 && body) {
    const reader = body.getReader();
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.byteLength;
        onProgress(Math.min(100, Math.round((received / size) * 100)));
      }
    } finally {
      reader.releaseLock();
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return decode(bytes.buffer);
  }

  return decode(await response.arrayBuffer());
}
