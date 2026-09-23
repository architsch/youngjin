# Object Update Flows

Reference: @src/shared/object/util/objectUpdateUtil.ts , @src/server/object/serverObjectManager.ts , @src/client/object/clientObjectManager.ts , @src/shared/physics/physicsManager.ts

Object edits are optimistic: the client validates and applies an edit through the shared `ObjectUpdateUtil`, then emits a signal. The server re-validates, relays the signal to everyone else on success, and corrects the sender on failure.

## Add / remove
![Object Addition Flow](figures/object_addition_flow.jpg)

- **Add**: the client registers the object, creates its physics body, spawns it as spawned-by-me, and sends `AddObjectSignal` with a locally computed id. The server recomputes the id. If the ids differ or validation fails, it sends `RemoveObjectSignal` back to the sender.
- **Remove**: applied optimistically. A server-side failure is only logged.
- **Category caps**: every object type belongs to a category (`ObjectCategoryEnumMap`), and a room may hold only so many of each (`ObjectCategoryConfigMap`). Types in one category spend that budget together, so a second kind of lamp does not double how many lamps a room can hold. `ObjectGroup` counts what it holds per category as objects come and go; both the client and the server refuse an add that would pass the cap.
- **Restricted zones**: adding, moving (into or out of a zone), removing or changing the metadata of a persistent object whose collider touches a zone is refused for anyone but the superuser (see [restricted_zone.md](../gameplay/restricted_zone.md)). Non-persistent objects, including players, are never checked.
- **Local-only objects** (e.g. render objects spawned from the voxel grid) get client-only ids and are never registered, persisted or signaled. They still get physics bodies.

## Transform
![Non-Physical Object Movement Flow](figures/non_physical_object_movement_flow.jpg)

![Physical Object Movement Flow](figures/physical_object_movement_flow.jpg)

`SetObjectTransformSignal` carries the full absolute transform: position, facing and scale.
- **Non-physical** objects (e.g. a canvas dragged by a gizmo) are set directly and emitted.
- **Physical** objects (e.g. players) are driven by a controller. A transform emitter sends updates when the change exceeds a threshold, and receivers interpolate.
- On the server, dynamic colliders are resolved by physics. If the result differs from the request, the authoritative transform goes to **all** clients, sender included. Otherwise the signal is relayed. Static objects are placed as requested.
- Validation is against the transform the signal **asks for**, not the one the object currently holds, since the destination is the part a client chose.
- For high-frequency signals such as transforms, a pending signal of the same type is replaced instead of queued.

### Size
A transform's scale multiplies the type's `baseHitboxSize`; `ObjectScaleUtil` is the only way to read it, and turns it into the footprint everything else uses — collider, attached placement, selection outline, mesh composition. A type opts into resizing with `ObjectScalingConfig` (step, minimum and maximum per axis); one without it is fixed at its base size.

A stored scale is never used as read. `ObjectScaleUtil` snaps it onto the type's step grid and clamps it, which absorbs the encoding's coarser quantization and is also what bounds a scale arriving from a client.

### Stored positions
`ObjectTransform` stores each component as a fraction of a fixed range. **Those ranges are part of the stored format.** Changing one silently moves every stored object, so the ranges are frozen and independent of room dimensions. A room that outgrows them needs a new `ObjectGroup` version with a converter in `ObjectGroupVersionMigration`. Objects share a blob with the `VoxelGrid`, whose version dates both.

Versions before the scale existed hold a shorter transform, so `ObjectGroupVersionMigration` reads the body at the version it was written in rather than only converting values afterwards. Changing a type's `baseHitboxSize` likewise needs a converter that rescales its stored objects, or every one of them changes size.

## Metadata
`SetObjectMetadataSignal`. On failure, the server sends back the current server-side value.
