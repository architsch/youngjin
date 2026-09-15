# Voxel Grid Structure

Reference: @src/shared/voxel/types/voxel.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/voxel/versionMigration/voxelGridVersionMigration.ts , @src/shared/voxel/util/voxelQueryUtil.ts , @src/client/voxel/util/clientVoxelQueryUtil.ts , @src/client/voxel/util/voxelQuadInstanceUtil.ts

## Layout
- A room is a fixed-size square grid of cells on XZ, one world unit per cell. Its height is split into equal **collision layers**.
- One layer of one cell is a **voxel block**. Each cell stores a **collision layer mask** (a bitmask of solid layers), which allows partial-height structures and fast vertical checks.
- Blocks also have a flat index in which the layer varies fastest, so each cell's column is contiguous. Volume-based systems such as lighting flood fills use this index.
- The room is tall enough for two storeys. A storey is not built into the grid. It is just a slab of blocks placed one layer below mid-height, so both storeys get equal headroom. Leaving the slab out opens a tall space. Tops of caps are not drawn, so a camera above the room sees inside it.

## Quads
- Each cell has textured **quads**: wall quads (±x, ±z) for every layer, and floor/ceiling quads (±y). A quad stores a visibility flag and a texture index.
- A face is drawn only where a solid block meets an open one.
- Wall quads span one layer's height. Floor and ceiling quads span a whole cell.

## Stored format
- Room contents (voxels and restricted zones) are one versioned binary blob, not database rows. A cell encodes its layer mask and then only its occupied layers.
- Loading reads the blob with the reader for its own version, then converts it forward one version at a time. The room is re-saved in the current version the next time it is written.
- Every past version keeps a **reader** (how the bytes are laid out) and a **converter** to the next version (how to keep the room's meaning). Both live in `VoxelGridVersionMigration`, so `VoxelGrid` itself describes only the current format.

## Rendering
- The whole room is one instanced mesh. The mesh is sized for the most quads a room can show at once, not for every quad the grid can address. Instances are lent to visible quads and returned when those quads are hidden (`VoxelQuadInstanceUtil`).
- As a result, a raycast hit reports an instance, which must be mapped back to a quad and may map to none. A quad that is not shown holds no instance. That is a different state from a quad that the orbit camera has hidden on purpose.

## Queries
- `VoxelQueryUtil` (shared): grid conventions such as cell positions, quad indices and layer solidity.
- `ClientVoxelQueryUtil` (client): questions about the room as it is currently drawn, which can differ from the stored room while the orbit camera hides blocks. It answers:
  - whether the room blocks the line between two points, found by walking the blocks along the segment (the end blocks are excluded);
  - how far the room ahead drops below the viewpoint, as a view-weighted average that drives the first-person camera pitch (see [camera_control.md](../graphics/camera_control.md)).

## Editing
- Adding a block fills the cell next to the selected face. Removing a block removes the block that owns the face.
- Removing a block that holds up wall-attached objects requires confirmation, and is only possible when the user may remove every one of those objects (see [wall_attached_object.md](wall_attached_object.md)).
- Edits are limited by the grid bounds and by restricted zones (see [restricted_zone.md](../gameplay/restricted_zone.md)).
