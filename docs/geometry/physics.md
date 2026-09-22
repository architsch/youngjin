# Physics System

Reference: @src/shared/physics/physicsManager.ts , @src/shared/physics/util/physicsCollisionUtil.ts , @src/shared/physics/util/physicsColliderStateUtil.ts , @src/shared/physics/types/physicsRoom.ts

The physics engine is shared, so the client and the server simulate movement the same way. All colliders are axis-aligned boxes.

- **Global colliders**: every `PhysicsRoom` has boxes just outside the floor, ceiling and four walls, and every solid voxel block adds its own box.
- **Hard collision** (voxels and room bounds): a movement ray is cast against target boxes that have been expanded by the mover's half-size (Minkowski sum + slab method). On a hit, the mover slides along the surface, with a few cascaded attempts so it can round corners.
- **Soft collision** (dynamic objects): overlapping boxes push each other apart along the axis of least overlap, in proportion to the overlap.
- **Step-up**: on a horizontal hit, a short enough obstacle with free space above it is climbed automatically.
- **Gravity**: a constant downward velocity applies whenever the object is not resting on something.
- **Orientation**: turning to face another horizontal axis swaps the box's horizontal dimensions.
- **Size**: a collider's box is its type's `baseHitboxSize` at the object's own scale, resolved through `ObjectScaleUtil` before the wall-attachment inset and the orientation swap, so the inset stays an absolute distance at any size.
- **Spatial acceleration**: the voxel grid serves as a spatial hash. Only the global colliders and the voxels under a box's footprint are tested.
