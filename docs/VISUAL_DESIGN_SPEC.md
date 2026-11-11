# Visual design

Focus uses a charcoal canvas, a solid red target, transparent neutral bones, faint superficial muscles and hidden distant or unrelated deep geometry. A blue highlight and a light theme are available. The highlight represents the current structure. Native controls communicate selection through text and pressed state.

| Role        | Dark                      | Light                     |
| ----------- | ------------------------- | ------------------------- |
| Target red  | `#E35E69`                 | `#B52E44`                 |
| Target blue | `#539DDE`                 | `#1669AB`                 |
| Context     | `#A5ADB8` at 0.28 opacity | `#535C6A` at 0.25 opacity |
| Dimmed      | `#78818F` at 0.09 opacity | `#606778` at 0.12 opacity |

Use soft lighting and a matte surface finish with vertex colors disabled. Keep controls beside the canvas on desktop and below it on small screens. The viewer stays still until the user interacts. The prototype frames the highlighted geometry and preserves local orientation through nearby skeleton landmarks. The framing radius and gray opacity are initial values for visual review.

Later phases add Strict Quiz and Context, layer and opacity controls, verified occluder rules, camera orbit settings, and shared visuals for both quiz modes.
