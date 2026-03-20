# Voxel Grid Update Flows

Reference: @src/shared/voxel/util/voxelBlockUpdateUtil.ts , @src/server/voxel/serverVoxelManager.ts

## Add Voxel Block
1. The client sends an `AddVoxelBlockSignal` (with a `quadIndex` and `quadTextureIndicesWithinLayer`) to the server via `VoxelQuadTransformOptions`. Immediately after this, the client also optimistically applies the add via `VoxelBlockUpdateUtil.addVoxelBlock`.
2. The server receives the `AddVoxelBlockSignal` and passes it over to `ServerVoxelManager.onAddVoxelBlockSignalReceived`.
3. `ServerVoxelManager` attempts to add the voxel block via `VoxelBlockUpdateUtil.addVoxelBlock`.
    - If the add succeeds:
        1. `ServerVoxelManager` broadcasts the `AddVoxelBlockSignal` to everyone (except the client who sent it).
        2. Other clients receive the `AddVoxelBlockSignal` from the server and pass it over to `ClientVoxelManager`.
        3. `ClientVoxelManager` (of the other clients) proceeds to add the voxel block described in `AddVoxelBlockSignal` via `VoxelBlockUpdateUtil.addVoxelBlock`.
    - If the add fails (e.g., the target slot is already occupied, or the position is out of bounds):
        1. `ServerVoxelManager` unicasts a `RemoveVoxelBlockSignal` back to the sender to let it know that the client-side addition must be reverted.
        2. The client receives the `RemoveVoxelBlockSignal` from the server and passes it over to `ClientVoxelManager`.
        3. `ClientVoxelManager` removes the voxel block that was added on the client side, reverting the optimistic add.

## Remove Voxel Block
1. The client sends a `RemoveVoxelBlockSignal` (with the `quadIndex`) to the server via `VoxelQuadTransformOptions`. Immediately after this, the client also optimistically removes the voxel block via `VoxelBlockUpdateUtil.removeVoxelBlock`.
2. The server receives the `RemoveVoxelBlockSignal` and passes it over to `ServerVoxelManager.onRemoveVoxelBlockSignalReceived`.
3. `ServerVoxelManager` captures the block's texture state before any modification attempt, for potential recovery. Then it attempts to remove the voxel block via `VoxelBlockUpdateUtil.removeVoxelBlock`.
    - If the removal succeeds:
        1. `ServerVoxelManager` broadcasts the `RemoveVoxelBlockSignal` to everyone (except the client who sent it).
        2. Other clients receive the `RemoveVoxelBlockSignal` from the server and pass it over to `ClientVoxelManager`.
        3. `ClientVoxelManager` (of the other clients) proceeds to remove the voxel block via `VoxelBlockUpdateUtil.removeVoxelBlock`.
    - If the removal fails (e.g., the block is already absent, or a persistent object depends on this wall):
        1. `ServerVoxelManager` unicasts an `AddVoxelBlockSignal` back to the sender (using the captured pre-removal texture state) to let it know that the client-side removal must be reverted.
        2. The client receives the `AddVoxelBlockSignal` from the server and passes it over to `ClientVoxelManager`.
        3. `ClientVoxelManager` re-adds the voxel block with the original textures, reverting the optimistic removal.

## Move Voxel Block
1. The client sends a `MoveVoxelBlockSignal` (with the `quadIndex`, `rowOffset`, `colOffset`, and `collisionLayerOffset`) to the server via `VoxelQuadTransformOptions`. Immediately after this, the client also optimistically applies the move via `VoxelBlockUpdateUtil.moveVoxelBlock` and updates the voxel quad selection.
2. The server receives the `MoveVoxelBlockSignal` and passes it over to `ServerVoxelManager.onMoveVoxelBlockSignalReceived`.
3. `ServerVoxelManager` captures the source block's texture state before any modification attempt, for potential recovery. Then it checks if any persistent object depends on the source wall, and attempts the move via `VoxelBlockUpdateUtil.moveVoxelBlock`.
    - If the move succeeds:
        1. `ServerVoxelManager` broadcasts the `MoveVoxelBlockSignal` to everyone (except the client who sent it).
        2. Other clients receive the `MoveVoxelBlockSignal` from the server and pass it over to `ClientVoxelManager`.
        3. `ClientVoxelManager` (of the other clients) applies the move via `VoxelBlockUpdateUtil.moveVoxelBlock`.
    - If the move fails (e.g., the target slot is already occupied, out of bounds, or a persistent object depends on the source wall):
        1. `ServerVoxelManager` unicasts a `RemoveVoxelBlockSignal` (targeting the optimistically-moved block at the target position) followed by an `AddVoxelBlockSignal` (targeting the source position, using the captured pre-move textures) back to the sender to revert the client-side optimistic move.
        2. The client receives these signals from the server and passes them over to `ClientVoxelManager`.
        3. `ClientVoxelManager` removes the voxel block at the target position and re-adds the block at the source position with the original textures, reverting the optimistic move.

## Set Voxel Quad Texture
1. The client sends a `SetVoxelQuadTextureSignal` (with the `quadIndex` and `textureIndex`) to the server via `VoxelQuadTextureOptions`. Immediately after this, the client also optimistically applies the texture change via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.
2. The server receives the `SetVoxelQuadTextureSignal` and passes it over to `ServerVoxelManager.onSetVoxelQuadTextureSignalReceived`.
3. `ServerVoxelManager` captures the old texture index before any modification attempt, for potential recovery. Then it attempts to apply the texture via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.
    - If the update succeeds:
        1. `ServerVoxelManager` broadcasts the `SetVoxelQuadTextureSignal` to everyone (except the client who sent it).
        2. Other clients receive the `SetVoxelQuadTextureSignal` from the server and pass it over to `ClientVoxelManager`.
        3. `ClientVoxelManager` (of the other clients) applies the texture change via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.
    - If the update fails (e.g., the quad is not visible, or the voxel is not found):
        1. `ServerVoxelManager` unicasts a `SetVoxelQuadTextureSignal` back to the sender with the old texture index to revert the client-side change.
        2. The client receives the `SetVoxelQuadTextureSignal` from the server and passes it over to `ClientVoxelManager`.
        3. `ClientVoxelManager` reverts the texture back to the old value via `VoxelQuadUpdateUtil.setVoxelQuadVisible`.
