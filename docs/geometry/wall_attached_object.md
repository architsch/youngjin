# Geometry of Wall-Attached Objects

Reference: @src/shared/object/util/wallAttachedObjectUtil.ts , @src/shared/physics/util/physicsColliderStateUtil.ts

A wall-attached object (e.g. a painting or a [door](door_design.md)) is mounted on a voxel wall. It can go anywhere that the wall and the existing attachments allow.

## Quantization
- Positions snap to a sub-cell grid, and facing directions round to the nearest axis. The footprint spans whole cells.
- The **bottom edge** is snapped vertically, not the center. Otherwise objects of odd height would float half a layer up.
- The collider is centered on the position, so a door's origin sits half its height above the floor.
- The collision test box is shrunk slightly along the two in-wall axes (in `PhysicsColliderStateUtil`), so that neighbors sharing an edge never register as overlapping.
- **Trap**: a stored position decodes slightly below the value that was written (see `ObjectTransform`), so an attachment's origin can land on either side of the wall boundary. Always find the wall an attachment belongs to from its facing direction, never from the cell its origin falls in.

## Movement
Attachments step up and down or sideways along a wall. At a corner they wrap onto the adjacent face: a concave wrap is tried first, then a convex one. The facing rotates a quarter turn, and the position is offset by half the object's width along both the facing axis and the sideways axis.

![Corner Wrapped Move](figures/corner_wrapped_move.jpg)

## Placement validity
![Front and Back Voxel Query](figures/front_and_back_voxel_query.jpg)

A placement is valid when, across the object's width and height:
- every cell **behind** it is solid (the object is supported);
- at least one cell **in front** of it is open (the object is not buried);
- it does not overlap another attachment.

## Removing the supporting wall
A block that holds up attachments cannot be removed on its own. The user can instead remove the block together with its attachments after confirming, but only when the user may remove every one of those attachments. A door, for example, keeps its wall for any non-admin.
