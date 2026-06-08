# Voxel Grid Update Flows

Reference: @src/shared/voxel/util/voxelUpdateUtil.ts , @src/server/voxel/serverVoxelManager.ts , @src/client/voxel/clientVoxelManager.ts

All voxel edits follow the same optimistic pattern: the client validates and applies the change locally through `VoxelUpdateUtil`, emits a signal, and the server re-validates through the same shared utility before relaying the change. On failure the server sends a compensating signal that reverts the client's optimistic change.

## Add Voxel Block
1. The client validates, applies the add, and emits an `AddVoxelBlockSignal`.
2. The server re-validates and applies it.
    - **On success:** relays the signal to everyone else.
    - **On failure:** sends a `RemoveVoxelBlockSignal` back to the sender to undo the add.

## Remove Voxel Block
1. The client validates, removes the block, and emits a `RemoveVoxelBlockSignal`.
2. The server captures the block's texture state (for possible recovery) and re-validates.
    - **On success:** relays the signal to everyone else.
    - **On failure:** sends an `AddVoxelBlockSignal` (carrying the captured textures) back to the sender to restore the block.

## Move Voxel Block
1. The client validates, applies the move, and emits a `MoveVoxelBlockSignal`.
2. The server captures the source block's texture state and re-validates.
    - **On success:** relays the signal to everyone else.
    - **On failure:** sends signals back to the sender that remove the block at the target and restore it (with its original textures) at the source.

## Set Voxel Quad Texture
1. The client validates, applies the texture change, and emits a `SetVoxelQuadTextureSignal`.
2. The server captures the old texture and re-validates.
    - **On success:** relays the signal to everyone else.
    - **On failure:** sends the signal back to the sender carrying the old texture, reverting the change.

## Permission Enforcement
Every voxel operation is checked against the user's role:
- **Hub rooms:** any user may edit voxels.
- **Regular rooms:** only the Owner and Editors may edit; a Visitor's attempts are rejected and rolled back.
