# Physics System

Reference: @src/shared/physics/physicsManager.ts , @src/shared/physics/util/physicsCollisionUtil.ts , @src/shared/physics/util/physicsColliderStateUtil.ts , @src/shared/physics/types/physicsRoom.ts , @src/shared/physics/util/physicsVoxelUtil.ts , @src/shared/physics/util/physicsObjectUtil.ts

## Global Colliders (Room Boundaries)
Every `PhysicsRoom` holds a fixed set of `globalColliders` that bounds the playable volume:
- **Perimeter colliders** — the floor, the ceiling, and the four side walls. Each is a large solid block placed flush just outside one face of the room, so its thickness extends away from the playable volume. They all share one hard-collision configuration (no soft push).
- **Entrance collider** — an invisible plug over the doorway opening in one of the walls. See [room_entrance.md](room_entrance.md#the-entrance-collider).
- **Voxel block hitbox** — every solid voxel block contributes its own box collider.

## Collision Systems

### Hard Collision (AABB Raycasting with Sliding)
Used for solid obstacles (voxel blocks, room boundaries):

1. The physics engine computes the object's movement ray from its current to its desired position.
2. It uses the **slab method** (Cyrus-Beck clipping) with **Minkowski sum expansion** — the target box is expanded by the source's half-size so that a point ray can be cast against the expanded box.
3. On hit, the object slides along the collision surface. A few cascading slide attempts are allowed so the object can round corners instead of sticking.
4. Returns the hit distance and the collision normal.

### Soft Collision (Push-Based)
Used for dynamic objects that overlap but shouldn't fully penetrate:

1. Computes the **intersection volume** between two overlapping boxes.
2. Applies push forces proportional to the overlap, using configurable outgoing/incoming force multipliers.
3. Objects are pushed apart along the axis of minimum overlap.

### Climbing / Step-Up
Objects can climb obstacles up to a maximum climbable height:

1. When a horizontal collision is detected, the engine checks whether there is space above the obstacle.
2. If the obstacle is short enough and nothing blocks the space above it, the object steps up onto it.
3. This enables smooth movement over small ledges without requiring the player to jump.

## Gravity
Gravity is applied as a constant downward velocity whenever the object is not resting on a surface.

## Orientation-Dependent Colliders
An object's collider reorients with its facing direction: when the object turns to face along a different horizontal axis, the box's horizontal dimensions swap. This keeps directional objects (e.g. a player facing sideways) shaped correctly for collision.

## Spatial Acceleration
The physics engine uses the voxel grid as a spatial hash:
- Queries convert a box's bounds to voxel-grid coordinates, clamped to the valid grid range.
- The room's `globalColliders` (boundaries + entrance) are always tested; beyond those, only the voxels within the box's footprint are checked, keeping collision cost roughly constant per movement.
- Object-to-object queries similarly use range or volume-overlap checks accelerated by the grid.
