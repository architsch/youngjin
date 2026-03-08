# Voxel Grid Update Flows

Reference: @src/shared/voxel/types/update/updateVoxelGridParams.ts , @src/shared/voxel/util/voxelBlockUpdateUtil.ts

## Add Voxel Block
1. The client sends an `AddVoxelBlockParams` (with a `quadIndex` and `quadTextureIndicesWithinLayer`) to the server via `VoxelQuadTransformOptions`. Immediately after this, the client also optimistically applies the add via `VoxelBlockUpdateUtil.addVoxelBlock`.
2. The server receives the `UpdateVoxelGridParams` containing the `AddVoxelBlockParams` and passes it over to `RoomVoxelUtil`.
3. `RoomVoxelUtil` attempts to add the voxel block via `VoxelBlockUpdateUtil.addVoxelBlock`.
    - If the add succeeds:
        1. `RoomVoxelUtil` broadcasts the `AddVoxelBlockParams` to everyone (except the client who sent it).
        2. Other clients receive the `UpdateVoxelGridParams` containing the `AddVoxelBlockParams` from the server and pass it over to `VoxelManager`.
        3. `VoxelManager` (of the other clients) proceeds to add the voxel block described in `AddVoxelBlockParams` via `VoxelBlockUpdateUtil.addVoxelBlock`.
    - If the add fails (e.g., the target slot is already occupied, or the position is out of bounds):
        1. `RoomVoxelUtil` unicasts a `RemoveVoxelBlockParams` back to the sender to let it know that the client-side addition must be reverted.
        2. The client receives the `UpdateVoxelGridParams` containing the `RemoveVoxelBlockParams` from the server and passes it over to `VoxelManager`.
        3. `VoxelManager` removes the voxel block that was added on the client side, reverting the optimistic add.

## Remove Voxel Block
1. The client sends a `RemoveVoxelBlockParams` (with the `quadIndex`) to the server via `VoxelQuadTransformOptions`. Immediately after this, the client also optimistically removes the voxel block via `VoxelBlockUpdateUtil.removeVoxelBlock`.
2. The server receives the `UpdateVoxelGridParams` containing the `RemoveVoxelBlockParams` and passes it over to `RoomVoxelUtil`.
3. `RoomVoxelUtil` captures the block's texture state before any modification attempt, for potential recovery. Then it attempts to remove the voxel block via `VoxelBlockUpdateUtil.removeVoxelBlock`.
    - If the removal succeeds:
        1. `RoomVoxelUtil` broadcasts the `RemoveVoxelBlockParams` to everyone (except the client who sent it).
        2. Other clients receive the `UpdateVoxelGridParams` containing the `RemoveVoxelBlockParams` from the server and pass it over to `VoxelManager`.
        3. `VoxelManager` (of the other clients) proceeds to remove the voxel block via `VoxelBlockUpdateUtil.removeVoxelBlock`.
    - If the removal fails (e.g., the block is already absent, or a persistent object depends on this wall):
        1. `RoomVoxelUtil` unicasts an `AddVoxelBlockParams` back to the sender (using the captured pre-removal texture state) to let it know that the client-side removal must be reverted.
        2. The client receives the `UpdateVoxelGridParams` containing the `AddVoxelBlockParams` from the server and passes it over to `VoxelManager`.
        3. `VoxelManager` re-adds the voxel block with the original textures, reverting the optimistic removal.

## Move Voxel Block
1. The client sends a `MoveVoxelBlockParams` (with the `quadIndex`, `rowOffset`, `colOffset`, and `collisionLayerOffset`) to the server via `VoxelQuadTransformOptions`. Immediately after this, the client also optimistically applies the move via `VoxelBlockUpdateUtil.moveVoxelBlock` and updates the voxel quad selection.
2. The server receives the `UpdateVoxelGridParams` containing the `MoveVoxelBlockParams` and passes it over to `RoomVoxelUtil`.
3. `RoomVoxelUtil` captures the source block's texture state before any modification attempt, for potential recovery. Then it checks if any persistent object depends on the source wall, and attempts the move via `VoxelBlockUpdateUtil.moveVoxelBlock`.
    - If the move succeeds:
        1. `RoomVoxelUtil` broadcasts the `MoveVoxelBlockParams` to everyone (except the client who sent it).
        2. Other clients receive the `UpdateVoxelGridParams` containing the `MoveVoxelBlockParams` from the server and pass it over to `VoxelManager`.
        3. `VoxelManager` (of the other clients) applies the move via `VoxelBlockUpdateUtil.moveVoxelBlock`.
    - If the move fails (e.g., the target slot is already occupied, out of bounds, or a persistent object depends on the source wall):
        1. `RoomVoxelUtil` unicasts a `RemoveVoxelBlockParams` (targeting the optimistically-moved block at the target position) followed by an `AddVoxelBlockParams` (targeting the source position, using the captured pre-move textures) back to the sender to revert the client-side optimistic move.
        2. The client receives the `UpdateVoxelGridParams` containing these params from the server and passes them over to `VoxelManager`.
        3. `VoxelManager` removes the voxel block at the target position and re-adds the block at the source position with the original textures, reverting the optimistic move.

## Set Voxel Quad Texture
1. The client sends a `SetVoxelQuadTextureParams` (with the `quadIndex` and `textureIndex`) to the server via `VoxelQuadTextureOptions`. Immediately after this, the client also optimistically applies the texture change via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.
2. The server receives the `UpdateVoxelGridParams` containing the `SetVoxelQuadTextureParams` and passes it over to `RoomVoxelUtil`.
3. `RoomVoxelUtil` captures the old texture index before any modification attempt, for potential recovery. Then it attempts to apply the texture via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.
    - If the update succeeds:
        1. `RoomVoxelUtil` broadcasts the `SetVoxelQuadTextureParams` to everyone (except the client who sent it).
        2. Other clients receive the `UpdateVoxelGridParams` containing the `SetVoxelQuadTextureParams` from the server and pass it over to `VoxelManager`.
        3. `VoxelManager` (of the other clients) applies the texture change via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.
    - If the update fails (e.g., the quad is not visible, or the voxel is not found):
        1. `RoomVoxelUtil` unicasts a `SetVoxelQuadTextureParams` back to the sender with the old texture index to revert the client-side change.
        2. The client receives the `UpdateVoxelGridParams` containing the `SetVoxelQuadTextureParams` from the server and passes it over to `VoxelManager`.
        3. `VoxelManager` reverts the texture back to the old value via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.