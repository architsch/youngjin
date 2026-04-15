# Physics System

Reference: @src/shared/physics/physicsManager.ts , @src/shared/physics/util/physicsCollisionUtil.ts , @src/shared/physics/util/physicsColliderStateUtil.ts , @src/shared/physics/types/physicsRoom.ts , @src/shared/physics/util/physicsVoxelUtil.ts , @src/shared/physics/util/physicsObjectUtil.ts

## Room Boundaries
- **Floor collider**: Positioned at y = −50, extending 50 units downward (y range: [−50, 0]).
- **Ceiling collider**: Positioned at y = MAX_ROOM_Y + 50 (≈54), extending 50 units upward (y range: [4, 54]).
- **Voxel block hitbox**: 1 × 0.5 × 1 units (VOXEL_BLOCK_HITBOX_HALFSIZE = {0.5, 0.25, 0.5}).

## Collision Systems

### Hard Collision (AABB Raycasting with Sliding)
Used for solid obstacles (voxel blocks, room boundaries):

1. The physics engine computes the object's movement ray from its current to desired position.
2. It uses the **slab method** (Cyrus-Beck clipping) with **Minkowski sum expansion** — the target AABB is expanded by the source's half-size so that a point ray can be cast against the expanded box.
3. On hit, the object slides along the collision surface. Up to **3 slide attempts** are allowed (1 initial hit + 2 cascade slides) to handle corner cases.
4. Returns the hit ray scale and collision normal vector.

### Soft Collision (Push-Based)
Used for dynamic objects that overlap but shouldn't fully penetrate:

1. Computes the **intersection volume** between two overlapping AABBs.
2. Applies push forces proportional to the overlap, using configurable outgoing/incoming force multipliers.
3. Objects are pushed apart along the axis of minimum overlap.

### Climbing / Step-Up
Objects can climb obstacles up to `maxClimbableHeight`:

1. When a horizontal collision is detected, the engine checks if space is available above the obstacle.
2. If the obstacle height is within the climbable limit and there is no ceiling collision above, the object steps up.
3. This enables smooth movement over small ledges without requiring the player to jump.

## Gravity
Gravity is applied as a constant downward velocity: `−GRAVITY_SPEED` (3 units/frame) when the object is not resting on a surface.

## Orientation-Dependent Colliders
Object colliders reorient based on the object's facing direction vector:
- When the object is more aligned with the X-axis, `sizeX` and `sizeZ` of the hitbox are swapped.
- This ensures directional objects (e.g. players facing sideways) have correct collision shapes.

## Spatial Acceleration
The physics engine uses the voxel grid as a spatial hash:
- Queries convert AABB bounds to voxel grid coordinates via `floor()`.
- Only voxels within the AABB's XZ footprint are checked, giving O(1) collision checks for any given movement.
- Object-to-object queries similarly use 2D circular range checks or 3D volume overlap checks, both accelerated by the grid.
