# Voxel Grid Structure

Reference: @src/shared/voxel/types/voxel.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/voxel/util/voxelQueryUtil.ts , @src/client/voxel/util/clientVoxelQueryUtil.ts

## Room Dimensions
A room is a fixed-size square grid of voxel cells in the XZ plane, with one world unit per cell. The room's height is divided into a fixed number of equal-height **collision layers** stacked along Y, so structures can be built at partial heights rather than only floor-to-ceiling.

## Voxel Quad Encoding
Each voxel cell is described by a set of textured **quads**:
- **Wall quads** — one per face (±x, ±z) of every collision layer.
- **Floor/ceiling quads** (±y) — encoded separately from the per-layer wall quads.

Each quad is packed compactly, carrying a **visibility flag** (whether the face is drawn) and a **texture index** (which texture it uses). This keeps a full room cheap to store and transmit.

## Collision Layer System
The collision layers partition the room height into equal vertical slices. Each voxel tracks a **collision layer mask** — a bitmask marking which layers are solid. This enables:
- Partial-height structures (e.g. a half-wall that fills only the lower layers).
- Efficient vertical collision checks via bitwise operations.
- Wall-attached object placement validation (checking that the required layers are filled).

## Quad Positioning
Wall quads are centered vertically within their layer; floor/ceiling quads sit at the layer's lower or upper boundary depending on which way they face. Wall quads are scaled to one layer's height, while floor/ceiling quads span a full cell.

## Asking the Grid

Two utilities answer questions about the grid, and the line between them is what the grid *holds* versus what the room is currently *drawing*.

`VoxelQueryUtil` is shared with the server and holds the grid's conventions: where a cell sits in the world, which quad index stands for which face of which layer, and whether a layer is solid. It knows nothing of any particular room being on screen.

`ClientVoxelQueryUtil` answers what only the client can, because the room as drawn differs from the room as stored — a block the orbit camera has taken out of the way is still there to walk into while being no part of what the user sees (see [camera_control.md](../graphics/camera_control.md)). It answers about the one room the client is drawing, so that a caller with a world-space question of its own need know nothing about voxels to ask it:

- **Whether the room stands between two points.** The grid is walked block by block along the segment rather than raycast, since the room draws its every quad from a single instanced mesh and a ray would be tested against all of them — a whole room's worth, for a question asked every frame. The walk instead costs one step per block boundary the segment crosses, whatever the room is built of. Neither end block counts, so a camera pushed into a wall does not blind itself, and the block the target stands in is not mistaken for something in front of it.
- **Where the open space around a viewpoint lies.** The empty blocks of the room a viewpoint can see into, gathered over the voxels within reach ahead and weighted by how much of the view each takes up, answer how far above or below that space the viewpoint sits. A voxel showing none of it — filled solid, or standing behind something that is — counts as level rather than going uncounted, so that a wall weighs against the open ground beside it instead of leaving that ground to answer alone. This is what the first-person camera pitches by, and it is a question about *somewhere to look* rather than about where the ground is — which is what tells a player standing on a platform over an open floor apart from one standing on the upper storey of a building.

## Block Manipulation
Voxel blocks are added and removed through the menu that comes up for a selected quad: an added block goes into the cell adjacent to the selected face, and a removed one is the block that face belongs to. Selecting a quad also puts the camera into an orbit around its block, so the user can inspect it from any angle before editing it (see [camera_control.md](../graphics/camera_control.md)). Edits are bounded by the grid, and additional constraints protect the cells around the room entrance from being added to or removed — see [room_entrance.md](room_entrance.md#editing-constraints-near-the-entrance). A block that a wall-attached object hangs on comes down together with it, once the user has confirmed as much — see [wall_attached_object.md](wall_attached_object.md#removing-the-wall-behind-an-attachment).
