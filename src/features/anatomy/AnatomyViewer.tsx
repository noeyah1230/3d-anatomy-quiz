import { OrbitControls } from '@react-three/drei/core/OrbitControls.js';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from 'react';
import { PerspectiveCamera, Sphere, Vector3 } from 'three';
import {
  loadAnatomyModel,
  selectTarget,
  type AnatomyModel,
  type MeshMetadata,
} from './model';
import type { PreviewTarget } from './targets';
import {
  createFocusMaterials,
  planFocus,
  type Highlight,
  type Theme,
} from './visuals/materials';

type CameraView = 'focus' | 'front' | 'left';

export type CameraCommand =
  { action: 'frame'; view: CameraView } | { action: 'zoom'; factor: number };

type Props = {
  target: PreviewTarget;
  theme: Theme;
  highlight: Highlight;
  command: CameraCommand;
  inspect: boolean;
  onReady: (ready: boolean) => void;
  onError: (message: string) => void;
};

const directions = {
  focus: new Vector3(1, 0.06, 0.68).normalize(),
  front: new Vector3(0, 0, 1),
  left: new Vector3(1, 0, 0),
};

function Scene({
  model,
  plan,
  theme,
  highlight,
  command,
  onError,
  onPick,
}: Pick<Props, 'theme' | 'highlight' | 'command' | 'onError'> & {
  model: AnatomyModel;
  plan: ReturnType<typeof planFocus>;
  onPick?: (metadata: MeshMetadata) => void;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const materials = useRef<ReturnType<typeof createFocusMaterials>>(null);
  const { camera, gl, invalidate, size } = useThree();
  const lastCommand = useRef<CameraCommand>(null);
  const lastBounds = useRef<typeof plan.bounds>(null);

  useEffect(() => {
    function lost(event: Event) {
      event.preventDefault();
      onError(
        'The graphics context was interrupted. Restart the viewer to continue.',
      );
    }
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onError]);

  useLayoutEffect(() => {
    const pool = createFocusMaterials();
    materials.current = pool;
    return () => {
      for (const { mesh, originalMaterial } of model.meshes.values()) {
        mesh.material = originalMaterial;
        mesh.visible = true;
      }
      pool.dispose();
      materials.current = null;
    };
  }, [model]);

  useLayoutEffect(() => {
    const pool = materials.current;
    if (!pool) return;
    pool.update(theme, highlight);
    for (const [name, entry] of model.meshes) {
      const role = plan.roles.get(name) ?? 'hidden';
      entry.mesh.visible = role !== 'hidden';
      entry.mesh.material =
        role === 'hidden' ? entry.originalMaterial : pool[role];
    }
    invalidate();
  }, [model, plan, theme, highlight, invalidate]);

  useLayoutEffect(() => {
    const orbit = controls.current;
    if (
      !(camera instanceof PerspectiveCamera) ||
      !orbit ||
      !size.height ||
      !size.width
    )
      return;
    if (command.action === 'zoom' && lastBounds.current === plan.bounds) {
      if (lastCommand.current === command) return;
      const offset = camera.position.clone().sub(orbit.target);
      const distance = Math.min(
        orbit.maxDistance,
        Math.max(orbit.minDistance, offset.length() * command.factor),
      );
      camera.position.copy(orbit.target).add(offset.setLength(distance));
    } else {
      const damping = orbit.enableDamping;
      orbit.enableDamping = false;
      orbit.update();
      orbit.enableDamping = damping;
      const view = command.action === 'frame' ? command.view : 'focus';
      const center = plan.bounds.getCenter(new Vector3());
      // Leave room for the skull above these two head-and-face targets.
      center.y += 0.02;
      const radius = plan.bounds.getBoundingSphere(new Sphere()).radius;
      const vertical = (camera.fov * Math.PI) / 360;
      const horizontal = Math.atan(
        Math.tan(vertical) * (size.width / size.height),
      );
      const paddedRadius = Math.max(0.134, radius * 1.4);
      const distance = paddedRadius / Math.sin(Math.min(vertical, horizontal));
      orbit.target.copy(center);
      camera.position.copy(center).addScaledVector(directions[view], distance);
    }
    lastBounds.current = plan.bounds;
    lastCommand.current = command;
    orbit.update();
    invalidate();
  }, [camera, command, invalidate, plan.bounds, size.height, size.width]);

  function pick(event: ThreeEvent<MouseEvent>) {
    const name: unknown = event.object.userData.name;
    if (typeof name !== 'string') return;
    const entry = model.meshes.get(name);
    if (entry?.mesh.visible) {
      event.stopPropagation();
      onPick?.(entry.metadata);
    }
  }

  return (
    <>
      <ambientLight intensity={1.12} />
      <directionalLight position={[2, 3, 4]} intensity={2.05} />
      <directionalLight position={[-3, 1, -2]} intensity={0.8} />
      <primitive
        object={model.root}
        onClick={onPick ? pick : undefined}
        dispose={null}
      />
      <OrbitControls
        ref={controls}
        enablePan={false}
        minDistance={0.14}
        maxDistance={1.6}
      />
    </>
  );
}

function Inspector({
  model,
  target,
  picked,
  plan,
}: {
  model: AnatomyModel;
  target: PreviewTarget;
  picked: MeshMetadata | null;
  plan: ReturnType<typeof planFocus>;
}) {
  const entries = selectTarget(model, target);
  return (
    <details className="inspector">
      <summary>Developer mesh inspector</summary>
      <p>
        {model.meshes.size} source meshes. Select a visible surface to inspect
        it.
      </p>
      <ul aria-label="Highlighted source meshes">
        {entries.map(({ metadata }) => (
          <li key={metadata.name}>
            {metadata.name} · {metadata.layer} · {metadata.side} ·{' '}
            {metadata.source}
          </li>
        ))}
      </ul>
      {picked && (
        <pre>
          {JSON.stringify(
            { ...picked, role: plan.roles.get(picked.name) },
            null,
            2,
          )}
        </pre>
      )}
    </details>
  );
}

export default function AnatomyViewer({
  target,
  theme,
  highlight,
  command,
  inspect,
  onReady,
  onError,
}: Props) {
  const [model, setModel] = useState<AnatomyModel | null>(null);
  const [progress, setProgress] = useState(0);
  const [picked, setPicked] = useState<MeshMetadata | null>(null);
  const plan = useMemo(
    () => (model ? planFocus(model, target) : null),
    [model, target],
  );

  useEffect(() => {
    const controller = new AbortController();
    let owned: AnatomyModel | undefined;
    loadAnatomyModel(controller.signal, setProgress)
      .then((loaded) => {
        if (controller.signal.aborted) {
          loaded.dispose();
          return;
        }
        owned = loaded;
        setModel(loaded);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (import.meta.env.DEV) console.error(error);
        onError(
          'The anatomy model could not load. Check your connection and retry.',
        );
      });

    return () => {
      controller.abort();
      owned?.dispose();
    };
  }, [onError]);

  if (!model || !plan) {
    return (
      <div className="stage-message" role="status">
        <strong>Loading the anatomy model</strong>
        <progress
          aria-label="Model download"
          max={100}
          value={progress || undefined}
        />
      </div>
    );
  }

  return (
    <>
      <Canvas
        className="anatomy-canvas"
        aria-label="Interactive 3D anatomy model"
        camera={{ fov: 35, near: 0.025, far: 5, position: [0.5, 1.6, 0.5] }}
        dpr={[1, 1.5]}
        frameloop="demand"
        onCreated={() => onReady(true)}
        fallback={<p>3D canvas unavailable</p>}
      >
        <Scene
          model={model}
          plan={plan}
          theme={theme}
          highlight={highlight}
          command={command}
          onError={onError}
          onPick={inspect ? setPicked : undefined}
        />
      </Canvas>
      {inspect && (
        <Inspector model={model} target={target} picked={picked} plan={plan} />
      )}
    </>
  );
}
