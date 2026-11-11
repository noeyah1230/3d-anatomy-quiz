# Anatomy validation

The supplied PDF was inspected locally. Page 232 / Figure 6.22 includes Masseter and Temporalis and explicitly lists the unillustrated Vastus intermedius. Page 233 / Figure 6.23 labels Occipitalis. The imported file contains 46 unique targets in nine regions. A target-by-target PDF and model audit is scheduled for Phase 2.

## Phase 1 preview selectors

| Scope ID     | Exact GLB metadata name           | Layer               | Side | Source    | Group         |
| ------------ | --------------------------------- | ------------------- | ---- | --------- | ------------- |
| `masseter`   | Left superficial part of masseter | superficial muscles | left | Z-Anatomy | Left masseter |
| `masseter`   | Left deep part of masseter        | deep muscles        | left | Z-Anatomy | Left masseter |
| `temporalis` | Left temporalis                   | superficial muscles | left | Z-Anatomy |               |

Both masseter entries are rendered as target geometry. The default left-anterior view favors the visible superficial surface. A deeper surface may still be occluded by the opaque target itself. Both structures need independent human shape, location, grouping and visibility review. Approved scope is **0 / 46**.

The pinned manifest and GLB contain `Occipital bone` and suboccipital group references but no direct `Occipitalis` mesh match. Preserve the scope entry and investigate other model sources and names in Phase 2. Keep zygomaticus major and minor, the intercostals and adductors, the iliopsoas components, and the deep vastus intermedius view on the audit list.
