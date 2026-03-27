# Voxel Grid Update Flows

Reference: @src/shared/voxel/util/voxelUpdateUtil.ts , @src/server/voxel/serverVoxelManager.ts , @src/client/voxel/clientVoxelManager.ts

## Add Voxel Block

1. The client calls `ClientVoxelManager.addVoxelBlock`, which delegates to `VoxelUpdateUtil.addVoxelBlock` to validate and optimistically apply the add. If successful, the client emits an `AddVoxelBlockSignal` to the server.
2. The server receives the signal. `ServerVoxelManager` obtains the user role and delegates to `VoxelUpdateUtil.addVoxelBlock` for validation and state mutation.
    - If it succeeds: the server multicasts the signal to everyone except the sender.
    - If it fails: the server unicasts a `RemoveVoxelBlockSignal` back to the sender to revert the optimistic add.

## Remove Voxel Block

1. The client calls `ClientVoxelManager.removeVoxelBlock`, which delegates to `VoxelUpdateUtil.removeVoxelBlock` to validate and optimistically remove the block. If successful, the client emits a `RemoveVoxelBlockSignal` to the server.
2. The server captures the block's texture state (for potential recovery) and calls `VoxelUpdateUtil.removeVoxelBlock`.
    - If it succeeds: the server multicasts the signal to everyone except the sender.
    - If it fails: the server unicasts an `AddVoxelBlockSignal` (with the captured texture state) back to the sender to revert the optimistic removal.

## Move Voxel Block

1. The client calls `ClientVoxelManager.moveVoxelBlock`, which delegates to `VoxelUpdateUtil.moveVoxelBlock` to validate and optimistically apply the move. If successful, the client emits a `MoveVoxelBlockSignal` to the server.
2. The server captures the source block's texture state and calls `VoxelUpdateUtil.moveVoxelBlock`.
    - If it succeeds: the server multicasts the signal to everyone except the sender.
    - If it fails: the server unicasts a `RemoveVoxelBlockSignal` (for the target position) followed by an `AddVoxelBlockSignal` (for the source position with original textures) back to the sender to revert the optimistic move.

## Set Voxel Quad Texture

1. The client calls `ClientVoxelManager.setVoxelQuadTexture`, which delegates to `VoxelUpdateUtil.setVoxelQuadTexture` to validate and optimistically apply the texture change. If successful, the client emits a `SetVoxelQuadTextureSignal` to the server.
2. The server captures the old texture index and calls `VoxelUpdateUtil.setVoxelQuadTexture`.
    - If it succeeds: the server multicasts the signal to everyone except the sender.
    - If it fails: the server unicasts a `SetVoxelQuadTextureSignal` (with the old texture index) back to the sender to revert the optimistic change.
