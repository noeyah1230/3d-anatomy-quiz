# Development log

## 2026-11-11 · Phases 0–1

### Shipped and demonstrated

- Set up a Vite, React and strict TypeScript app, locked dependencies, and added a read-only GitHub Actions workflow.
- Imported the supplied curriculum verbatim. It contains 46 unique IDs in nine regions. The scanned PDF was inspected locally.
- Vendored the optimized Écorché GLB, manifest and credits from commit `320805e06aee51e2e6f6b22533eb2a59d43f2d4d`.
- Built a left-side head-and-face viewer with two preview selections, red and blue highlights, dark and light themes, gray context, camera presets, drag, zoom and reset. The development inspector exposes clicked mesh metadata.
- Added download progress, cancellation, resource cleanup, and fallback states for a failed model request and an unavailable WebGL context.

### Tests actually run

| Check                                                    | Result                                                                                                                                                               |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm install` and `npm ci` using the populated npm cache | Passed on Node 26.7.0                                                                                                                                                |
| `npm run dev`                                            | Passed, local HTTP 200                                                                                                                                               |
| `npm run lint`                                           | Passed, including formatting                                                                                                                                         |
| `npm run typecheck`                                      | Passed                                                                                                                                                               |
| `npm test`                                               | 5 passed, including real meshopt decode, exact selectors, target roles and fixed scope                                                                               |
| `npm run build`                                          | Passed, with Vite's large-chunk advisory for the lazy 3D bundle                                                                                                      |
| `ANATOMY_USE_CHROME=1 npm run test:e2e`                  | 4 passed, covering actual red/blue rendering, orbit, reset, zoom, target switching, retry after HTTP 503, unavailable WebGL, and mobile-sized preference persistence |
| `npm run preview`                                        | Production build returned HTTP 200 and rendered in Chrome. Development inspector was hidden in production.                                                           |

Browser verification used installed Chrome and mobile viewport emulation. GitHub Actions, physical phones, and other browsers remain untested.

### Anatomy verification

The decoded model contained 634 named meshes, matching the pinned manifest. The two left masseter parts and left temporalis resolved against source metadata. A click in the developer inspector identified `Left superficial part of masseter` from Z-Anatomy as a target. All 46 targets are pending human approval. [Selectors and observations](ANATOMY_VALIDATION.md)

### Git status

Local branch `main` has no commits or remote. Publication and the original app code license are pending the owner's approval and selection.

### Visual checkpoint

The [production screenshot](screenshots/phase-1-focus.png) shows the default Focus and Red settings in desktop Chrome. Blue and the mobile-sized light layout were also checked. Strict Quiz and Context are future work.

### Engineering decisions and obstacles

- Registry timeouts left a partial install. A clean dependency tree and a fresh lockfile fixed it. Clean install verification passed.
- Model geometry stays unchanged. The app renders with its own neutral and target materials, on demand, capped at 1.5 device pixel ratio.
- The GLB is about 5.7 MiB. The lazy 3D JavaScript chunk is about 990 kB minified and 266 kB gzipped. Chrome reports a dependency deprecation for Three.js Clock. Device performance measurements remain pending.
- The deep masseter is part of the target group and can be hidden behind the opaque superficial part in the default view. A direct Occipitalis mesh match is missing from the pinned source.

### Next phase

1. Cross-check all 46 scope rows against the PDF and audit the pinned scene.
2. Resolve compound groups, deep visibility, and the Occipitalis asset gap.
3. Add the typed mapping records, visual approval evidence, coverage report and release gate.
4. Review the two prototype structures before approving them for scored questions.
