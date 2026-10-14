# Physics System

Reference: @src/shared/physics/physicsManager.ts , @src/shared/physics/util/physicsCollisionUtil.ts , @src/shared/physics/util/physicsForceUtil.ts , @src/shared/physics/util/physicsColliderStateUtil.ts , @src/shared/physics/types/physicsRoom.ts , @src/shared/object/types/objectForceConfig.ts

The physics engine is shared, so the client and the server simulate movement the same way. All colliders are axis-aligned boxes.

- **Global colliders**: every `PhysicsRoom` has boxes just outside the floor, ceiling and four walls, and every voxel block adds one box (see [voxel_grid.md](voxel_grid.md)).
- **Hard collision** (voxels and room bounds): a movement ray is cast against target boxes that have been expanded by the mover's half-size (Minkowski sum + slab method). On a hit, the mover slides along the surface, with a few cascaded attempts so it can round corners.
- **Soft collision** (dynamic objects): overlapping boxes push each other apart along the axis of least overlap, in proportion to the overlap.
- **Step-up**: on a horizontal hit, a short enough obstacle with free space above it is climbed automatically. Only an obstacle that blocks is climbed; a pass-through box, such as a lamp lying on the floor, is walked over.
- **Gravity**: a constant downward velocity applies whenever the object is not resting on something. Nothing switches it off.
- **Forces** (`PhysicsForceUtil`): a type with an `ObjectForceConfig` (a fan) speeds up whatever a `Rigidbody` moves through the stream in front of its face.
  - The stream is as wide as the emitter's footprint, runs along its facing, and ends at its range or at the first block in its middle's way, as its particles do (see [particles.md](../graphics/particles.md)). It takes hold of a body at least half in it.
  - The force is an acceleration: full at the face, thinning out evenly to nothing at the end of the range, and easing off where the body has little room left before something solid ahead of it, so nothing is pinned against a ceiling or a wall.
  - A body keeps the velocity it is given (on its `PhysicsObject`), which is added after soft collisions, so their limit doesn't hold it back. Gravity takes the upward part away at a steady rate and no further, so nothing falls faster than the constant fall; drag takes the rest.
  - A stream blowing upward makes up for gravity by the same measure as it pushes, and a body standing in it weighs nothing, so any strength lifts. A body over it rises to where the force no longer outdoes gravity, falls back, and goes on bouncing: off the floor over a weak fan, in mid-air over a strong one.
  - Strength and range are each object's own (from a fan's two settings), read from the room each time along with where it stands, so a new setting, a move or a block in the way takes effect at once.
  - A fan pushes by the square of its strength, so how high it lifts a body grows about as its strength does, and the weakest barely stirs one. Across the room it pushes harder than up or down, where it would otherwise throw a body hardly faster than it walks.
- **Orientation**: turning to face another horizontal axis swaps the box's horizontal dimensions. An attached object's box instead lies flat on its face (see [object_attachment.md](object_attachment.md)).
- **Size**: a collider's box is its type's `baseHitboxSize` at the object's own scale, resolved through `ObjectScaleUtil` before an attached object's inset and the orientation, so the inset stays an absolute distance at any size.
- **Kinds**: whether an object is driven by physics is its type's `Rigidbody` component, and whether it is fixed to a face is its type's attachment. The collider itself says only how it collides.
- **Spatial acceleration**: a box is tested against the global colliders, the blocks of the grid cells under its footprint (read from the room's grid as it stands), and the objects kept in the physics voxels it reaches into. A `PhysicsVoxel` is a box of the room's space far coarser than a grid cell and a storey high, so each storey's objects are kept apart (`PhysicsVoxelUtil`). An object beyond the room counts as in the nearest ones.
