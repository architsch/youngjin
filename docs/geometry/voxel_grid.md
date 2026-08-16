# Voxel Grid Structure

Reference: @src/shared/voxel/types/voxel.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/voxel/util/voxelQueryUtil.ts

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

## Block Manipulation
Voxel blocks are added and removed through the menu that comes up for a selected quad: an added block goes into the cell adjacent to the selected face, and a removed one is the block that face belongs to. Selecting a quad also puts the camera into an orbit around its block, so the user can inspect it from any angle before editing it (see [camera_control.md](../graphics/camera_control.md)). Edits are bounded by the grid, and additional constraints protect the cells around the room entrance from being added to or removed — see [room_entrance.md](room_entrance.md#editing-constraints-near-the-entrance). A block that a wall-attached object hangs on comes down together with it, once the user has confirmed as much — see [wall_attached_object.md](wall_attached_object.md#removing-the-wall-behind-an-attachment).
