# Voxel Grid Structure

Reference: @src/shared/voxel/types/voxel.ts , @src/shared/voxel/types/voxelGrid.ts , @src/shared/voxel/versionMigration/voxelGridVersionMigration.ts , @src/shared/voxel/util/voxelQueryUtil.ts , @src/client/voxel/util/clientVoxelQueryUtil.ts , @src/client/voxel/util/voxelQuadInstanceUtil.ts

## Layout
- A room is a fixed-size square grid of **voxels** on XZ: square columns standing side by side, each as tall as the room. A voxel is addressed by its row (along Z) and its column (along X).
- The room's height is split into equal **collision layers**, each as high as a voxel is wide. One layer of one voxel, a **cell layer**, is therefore a cube.
- A cell layer holds one **voxel block** or none, and a block fills it exactly. Anything larger is built of several blocks.
- Rows and columns mean voxels everywhere: edits, volumes and room generation all count them, and nothing counts a coarser grid. Only what stands in the room (objects, the camera) is placed in world units. A voxel is narrower than a world unit, and code goes between the two through `VoxelQueryUtil` rather than assuming the ratio.
- Cell layers also have a flat index in which the layer varies fastest, so each voxel's column is contiguous. Volume-based systems such as lighting flood fills work on it.
- The room is tall enough for two storeys. A storey is not built into the grid. It is just a slab of blocks placed one layer below mid-height, so both storeys get equal headroom. Leaving the slab out opens a tall space. Tops of caps are not drawn, so a camera above the room sees inside it.

## Quads
- A cell layer has six textured **quads**, one per face of its block, and each voxel has two more for the room's own floor and ceiling. In memory a quad is only a texture index, which names a cell of the room's texture pack atlas (see [texture.md](texture.md#voxel-texture-packs)).
- Whether a quad is drawn is never stored. The blocks decide it (`VoxelQueryUtil`), so it cannot fall out of step with them: a block's face is drawn unless it looks at another block, and everything outside the grid counts as blocks, which leaves the room without an outer shell.
- A covered quad keeps its texture for when it is uncovered again.
- A texture tile spans a world unit, not a quad. A quad shows the part of the tile it lies over, so neighbouring faces in one texture read as one surface.

## Stored format
- Room contents (the voxels, then the room's objects) are one versioned binary blob, not database rows. A voxel encodes which of its layers hold a block, and then only those layers. The blob is long but repetitive, and is compressed wherever it is stored or sent (see [user_state_management.md](../networking/user_state_management.md)).
- Loading reads the blob with the reader for its own version, then converts it forward one version at a time. The room is re-saved in the current version the next time it is written.
- Every past version keeps a **reader** (how the bytes are laid out) and a **converter** to the next version (how to keep the room's meaning). Both live in `VoxelGridVersionMigration`, so `VoxelGrid` itself describes only the current format.
- The versions whose cells were a world unit wide, with blocks that could fill a half or a quarter of one, are read and converted in a grid of their own (`LegacyVoxelGrid`). Only the last step writes voxels: a block for each part of a cell that was filled, so the room keeps its form.
- A grid no longer holds restricted zones. The ones an older version held are handed to the objects read from the same blob, which take them over as volumes (`ObjectGroupVersionMigration`; see [restricted_zone.md](../gameplay/restricted_zone.md)).

## Rendering
- The whole room is one instanced mesh, sized for the most quads any layout can show: one per boundary between a block and open space. Instances are lent to visible quads and returned when those quads are hidden (`VoxelQuadInstanceUtil`).
- As a result, a raycast hit reports an instance, which must be mapped back to a quad and may map to none. A quad that is not shown holds no instance. That is a different state from a quad that the orbit camera has hidden on purpose.
- The quads are drawn by `VoxelGameObject`s, each owning the voxels of one square patch of the floor plan, since every game object is a node of the scene that is walked each frame. The objects outlive rooms: on arrival each takes the same patch of the new grid.
- An edit redraws only the quads it announces on `voxelQuadChangeObservable`: the ones it repaints and the ones it covers or uncovers. A block changed any other way leaves the mesh stale.

## Queries
- `VoxelQueryUtil` (shared): grid conventions such as voxel positions, quad indices, a face's place and size, whether a cell layer holds a block, which quads are drawn, and which face a face runs on into along the room's surface.
- `ClientVoxelQueryUtil` (client): questions about the room as it is currently drawn, which can differ from the stored room while the orbit camera hides blocks. It answers:
  - whether the room blocks the line between two points, found by walking the cell layers along the segment (a block an end of the segment lies in, or right against, is excluded);
  - how far the room ahead drops below the viewpoint, as a view-weighted average that drives the first-person camera pitch (see [camera_control.md](../graphics/camera_control.md)).

## Editing
- Blocks are added and removed one at a time. Adding on a face fills the cell layer the face looks into; removing takes the block that owns the face.
- Removing a block that holds up attached objects requires confirmation, and is only possible when the user may remove every one of those objects (see [object_attachment.md](object_attachment.md)).
- Edits are limited by the grid bounds and by restricted zones (see [restricted_zone.md](../gameplay/restricted_zone.md)).
