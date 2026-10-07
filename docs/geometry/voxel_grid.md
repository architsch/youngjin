# Voxel Grid Structure

Reference: @src/shared/voxel/types/voxel.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/voxel/versionMigration/voxelGridVersionMigration.ts , @src/shared/voxel/util/voxelQueryUtil.ts , @src/shared/voxel/util/voxelBlockShapeUtil.ts , @src/client/voxel/util/clientVoxelQueryUtil.ts , @src/client/voxel/util/voxelQuadInstanceUtil.ts

## Layout
- A room is a fixed-size square grid of cells on XZ, one world unit per cell. Its height is split into equal **collision layers**.
- One layer of one cell is a **cell layer**, which holds one **voxel block** or none.
- A block is as tall as its layer and fills the whole cell across XZ, or a half or a quarter of it: its **shape** (`VoxelBlockShapeUtil`). Shapes are kept beside the quads, one per cell layer.
- Cell layers also have a flat index in which the layer varies fastest, so each cell's column is contiguous. **Sub-blocks**, the half cells a shape is made of, have one in the same order: volume-based systems that follow shapes, such as lighting flood fills, work on those.
- The room is tall enough for two storeys. A storey is not built into the grid. It is just a slab of blocks placed one layer below mid-height, so both storeys get equal headroom. Leaving the slab out opens a tall space. Tops of caps are not drawn, so a camera above the room sees inside it.

## Quads
- A cell layer has six textured **quads**, one per face of its block, and each cell has two more for the room's own floor and ceiling. In memory a quad is only a texture index, which names a cell of the room's texture pack atlas (see [texture.md](texture.md#voxel-texture-packs)).
- Whether a quad is drawn is never stored. The blocks' shapes decide it (`VoxelQueryUtil`), so it cannot fall out of step with them:
  - a face that stops short of its cell's side is always drawn;
  - a face at the side is hidden only where the block it looks at covers all of it;
  - everything outside the grid counts as whole blocks, which leaves the room without an outer shell.
- A covered quad keeps its texture for when it is uncovered again.
- A quad is as large as its block's face. The room's own floor and ceiling quads span a whole cell and are hidden only by a whole block.

## Stored format
- Room contents (voxels and restricted zones) are one versioned binary blob, not database rows. A cell encodes which of its layers hold a block, and then only those layers.
- A block's shape is spelt in the bit that each of its side quads' bytes has to spare. A whole block costs nothing extra, and a room stored before blocks had shapes reads as whole blocks.
- Loading reads the blob with the reader for its own version, then converts it forward one version at a time. The room is re-saved in the current version the next time it is written.
- Every past version keeps a **reader** (how the bytes are laid out) and a **converter** to the next version (how to keep the room's meaning). Both live in `VoxelGridVersionMigration`, so `VoxelGrid` itself describes only the current format.

## Rendering
- The whole room is one instanced mesh with an instance for every quad the grid can address, since shrunk blocks can show nearly all of them. Draw cost follows the instances in use: they are lent to visible quads and returned when those quads are hidden (`VoxelQuadInstanceUtil`).
- As a result, a raycast hit reports an instance, which must be mapped back to a quad and may map to none. A quad that is not shown holds no instance. That is a different state from a quad that the orbit camera has hidden on purpose.
- An edit redraws only the quads it announces on `voxelQuadChangeObservable`: the ones it repaints, the ones it covers or uncovers, and the ones its block's new shape draws elsewhere. A shape changed any other way leaves the mesh stale.

## Queries
- `VoxelQueryUtil` (shared): grid conventions such as cell positions, quad indices, a face's place and size, and which quads are drawn. A block is asked about in one of three ways: whether one is there, whether it is whole, or whether a point lies inside it.
- `ClientVoxelQueryUtil` (client): questions about the room as it is currently drawn, which can differ from the stored room while the orbit camera hides blocks. It answers:
  - whether the room blocks the line between two points, found by walking the cell layers along the segment and testing a shrunk block against its own box (a block an end of the segment lies in is excluded);
  - how far the room ahead drops below the viewpoint, as a view-weighted average that drives the first-person camera pitch (see [camera_control.md](../graphics/camera_control.md)).

## Editing
- Adding a block on a face at its cell's side fills the cell layer beyond with a block as wide as the face. On a face that stops short of the side, the face's own block grows out to it instead, since a cell layer holds one block. Removing a block removes the block that owns the face.
- Handles on the selected face's outline reshape its block (see [game_mode.md](../gameplay/game_mode.md#editing-a-block-by-its-outline)). A drag previews locally and reaches the server as one edit on release (`ClientVoxelManager`).
- Removing a block that holds up attached objects requires confirmation, and is only possible when the user may remove every one of those objects (see [object_attachment.md](object_attachment.md)). Such a block can be reshaped only while each object keeps its footing.
- Edits are limited by the grid bounds and by restricted zones (see [restricted_zone.md](../gameplay/restricted_zone.md)).
