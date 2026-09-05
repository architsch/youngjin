# Voxel Grid Structure

Reference: @src/shared/voxel/types/voxel.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/voxel/util/voxelQueryUtil.ts , @src/client/voxel/util/clientVoxelQueryUtil.ts , @src/client/voxel/util/voxelQuadInstanceUtil.ts

## Room Dimensions
A room is a fixed-size square grid of voxel cells in the XZ plane, with one world unit per cell. The room's height is divided into a fixed number of equal-height **collision layers** stacked along Y, so structures can be built at partial heights rather than only floor-to-ceiling.

The room stands tall enough to hold two storeys of comfortable headroom, so what a room is need not be a single floor under a single ceiling: a player can build upward as freely as outward, and climb what he has built.

## Storeys

Nothing in the grid divides the room into floors — the layers are simply a stack, and a room is whatever is built in them. A **storey** is therefore a thing rooms are *given* rather than a thing they have: a slab of blocks laid across the room, dividing the height into a space below it and a space above.

The slab does not sit at the room's mid-height. It sits one layer below it, so that the space under it and the space over it come out the same height as each other, and the topmost layer of the room is left over as padding above the upper storey. Both floors therefore give a player the same headroom, which is what lets a room be built either way round without one of its storeys feeling like an attic.

That one slab is all a second floor consists of, which is what makes the arrangement flexible:

- **Two storeys.** The slab covers the room, the walls carry on past it, and the space above is a floor in its own right — reached by stairs, walled and doorwayed exactly as the floor below it is, since a wall drawn through the whole room divides both alike.
- **One tall space.** Leaving the slab out of a stretch of the room opens the two storeys into one, for a space with a ceiling far out of reach. Rooms are commonly built both ways at once, with a gallery on the upper floor looking down into an open hall.
- **A single storey.** A room may lay the slab everywhere and stop there, nothing being opened up higher, in which case that slab is its roof rather than anybody's floor. This is what a room that predates the room's greater height becomes, and what the tutorial room is built as.

Whichever way a room is built, nothing is drawn on the top of what caps it: a face is drawn only where something solid meets something open, and what stands above a room's cap is the matter the room was carved out of (see [room_generation.md](room_generation.md)). So a camera that has risen above a room to look down into it is shown the room rather than a lid over it.

The room's own floor and ceiling are not layers at all (see below), which lets every storey be described the same way whether it is closed off by a slab of blocks or by the room itself.

## Voxel Quad Encoding
Each voxel cell is described by a set of textured **quads**:
- **Wall quads** — one per face (±x, ±z) of every collision layer.
- **Floor/ceiling quads** (±y) — encoded separately from the per-layer wall quads.

Each quad is packed compactly, carrying a **visibility flag** (whether the face is drawn) and a **texture index** (which texture it uses). A cell writes out its collision layer mask and then only the layers that mask says are occupied, so a room costs what stands in it rather than what its grid could address.

What stands in a room is most of it, though: a room is matter with its spaces carved out of it (see [room_generation.md](room_generation.md)), so the solid part is the bulk of the room and the encoding is sized for that. The buffer a room is written into is sized for a room built solid from floor to ceiling, because that is the room the format has to be able to hold.

## Stored Format and Its Versions

A room's contents are stored as one opaque binary blob rather than as database rows, so they are not migrated the way a row is: nothing rewrites them in place, and no migration pass runs over storage. Instead the blob carries the version it was written in, and the decoder does the work on load — reading the blob in *that* version's own format, then carrying it forward one version at a time until it is current. The room is written back in the current version whenever it is next saved, so a given room pays the conversion until then and no longer.

This means every past version of the format has to keep both a reader of its own and a converter to the version after it, for as long as blobs of that vintage might still be out there. The two do different jobs and are worth keeping apart: a reader knows how the bytes were laid out, while a converter knows what the room *meant* and what it must be given to mean the same thing now. Raising the room's height is a converter's kind of change — the bytes of the old room are read exactly as they were, and what is added is the room's new upper half, with the flat tile that used to close the room off overhead rebuilt as a real slab at the height it used to hang at, so the room below is left looking exactly as it did.

## Collision Layer System
The collision layers partition the room height into equal vertical slices. Each voxel tracks a **collision layer mask** — a bitmask marking which layers are solid. This enables:
- Partial-height structures (e.g. a half-wall that fills only the lower layers).
- Efficient vertical collision checks via bitwise operations.
- Wall-attached object placement validation (checking that the required layers are filled).

## Quad Positioning
Wall quads are centered vertically within their layer; floor/ceiling quads sit at the layer's lower or upper boundary depending on which way they face. Wall quads are scaled to one layer's height, while floor/ceiling quads span a full cell.

## Drawing the Room

The whole room is drawn from a single instanced mesh, one instance per quad on show. Which instance draws which quad is not fixed: an instance is *lent* to a quad for as long as that quad is visible, and handed back the moment it is not.

That indirection is there because the grid addresses far more quads than any room can ever show at once — every face of every layer of every cell has an index, while a face is only drawn where something solid meets something open. An instance costs the same every frame whether or not it is drawing anything, since an instanced mesh is drawn as one call over a fixed range of instances: a face buried inside a wall would be transformed and have its matrix read off the GPU exactly like a wall the user is looking at. Parking such an instance out of sight keeps it off the screen but not out of the frame's work, and over a grid this size that work is most of what the room costs. So the mesh is sized for the quads a room can have on show at once rather than for the quads the grid addresses, and what it draws follows what the room actually shows.

Two consequences are worth knowing about when working with the room's geometry:

- **A pointer landing on the room reports an instance, not a quad.** Which quad that instance is currently drawing has to be looked up, and it may be drawing none — an instance handed back between the ray being cast and the answer being read stands for nothing.
- **A quad that is not on show holds no instance at all.** Asking whether such a quad is hidden is therefore a different question from asking whether the orbit camera has taken it out of the way (see [camera_control.md](../graphics/camera_control.md)): the first is a face the room never had on view, the second a face the room is deliberately withholding.

## Asking the Grid

Two utilities answer questions about the grid, and the line between them is what the grid *holds* versus what the room is currently *drawing*.

`VoxelQueryUtil` is shared with the server and holds the grid's conventions: where a cell sits in the world, which quad index stands for which face of which layer, and whether a layer is solid. It knows nothing of any particular room being on screen.

`ClientVoxelQueryUtil` answers what only the client can, because the room as drawn differs from the room as stored — a block the orbit camera has taken out of the way is still there to walk into while being no part of what the user sees (see [camera_control.md](../graphics/camera_control.md)). It answers about the one room the client is drawing, so that a caller with a world-space question of its own need know nothing about voxels to ask it:

- **Whether the room stands between two points.** The grid is walked block by block along the segment rather than raycast, since the room draws its every quad from a single instanced mesh and a ray would be tested against all of them — a whole room's worth, for a question asked every frame. The walk instead costs one step per block boundary the segment crosses, whatever the room is built of. Neither end block counts, so a camera pushed into a wall does not blind itself, and the block the target stands in is not mistaken for something in front of it.
- **How far the room ahead falls away below a viewpoint.** Each voxel within reach ahead answers with the lowest empty block of it the viewpoint can see below the level it stands at, and those answers are averaged, weighted by how much of the view each voxel takes up. A voxel with nothing to look down into — filled solid, level with the viewer, or standing behind something that is — answers that rather than going uncounted, so that a wall weighs against the open ground beside it instead of leaving that ground to answer alone. This is what the first-person camera pitches by (see [camera_control.md](../graphics/camera_control.md)), and it is a question about *somewhere to look* rather than about where the ground is — which is what tells a player standing on a platform over an open floor apart from one standing on the upper storey of a building.

  Measured against the level the viewer stands at, and never below zero, because the room above him is no part of the question: every room has open space overhead, and weighing it against the space below would make the answer a reading of the room's height rather than of its ground.

## Block Manipulation
Voxel blocks are added and removed through the menu that comes up for a selected quad: an added block goes into the cell adjacent to the selected face, and a removed one is the block that face belongs to. Selecting a quad also puts the camera into an orbit around its block, so the user can inspect it from any angle before editing it (see [camera_control.md](../graphics/camera_control.md)). A block that a wall-attached object hangs on comes down together with it, once the user has confirmed as much — and only if the object is that user's to take down, which is what keeps a room's door safe from being pulled off the wall behind it (see [wall_attached_object.md](wall_attached_object.md#removing-the-wall-behind-an-attachment) and [room_entrance.md](room_entrance.md#editing-near-a-door)).

Otherwise edits are bounded by the grid and by one thing besides: the room's **restricted zones**, the stretches of it that the person the room answers to has kept for himself. A zone is stored alongside the voxels it covers, since that is what it is about, and it is what a room's grid holds that is not a voxel (see [restricted_zone.md](../gameplay/restricted_zone.md)).
