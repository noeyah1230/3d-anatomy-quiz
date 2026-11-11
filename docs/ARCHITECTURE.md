# Architecture

```mermaid
flowchart LR
  App[React app and viewer controls] -->|lazy import| Viewer[React Three Fiber viewer]
  GLB[Pinned Écorché GLB] --> Loader[Abortable fetch and GLTFLoader]
  Loader -->|validated mesh metadata and bounds| Viewer
  Selectors[Phase 1 selectors] --> Loader
  Selectors --> Focus[Focus role resolver]
  Viewer --> Focus
  Focus --> Canvas[WebGL canvas]
  App --> Storage[Local theme and highlight preferences]
  Scope[46-target scope inventory] --> Audit[Phase 2 coverage audit]
```

The loader validates exact metadata and computes world-space bounds after applying source transforms. The viewer reassigns one of three shared, vertex-color-free materials per mesh and restores the source material references on cleanup. Target changes re-evaluate all roles. Canvas rendering is demand-driven and capped at 1.5 device pixel ratio. The loader aborts a request on unmount and discards decoded results if cancellation happened during decoding.

The viewport resets and frames from the active bounding box. Controls use the same world coordinate space as the source model. The optional development inspector surfaces selected metadata without requiring that a mesh be individually visible through other target surfaces.
