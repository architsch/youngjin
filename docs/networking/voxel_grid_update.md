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

## Set Restricted Zones
The room's restricted zones travel on this same path, but as the whole list rather than as the one zone that changed — drawing one, moving one, resizing one and taking one away are all the same message (see [restricted_zone.md](../gameplay/restricted_zone.md)).

1. The client validates, replaces its own copy of the list, and emits a `SetRestrictedZonesSignal`.
2. The server re-validates and applies it.
    - **On success:** relays the signal to everyone else.
    - **On failure:** sends the room's own list back to the sender, which puts his copy right again.

The zones are stored with the room's voxels rather than beside them, so a client joining a room receives them as part of the room and only this incremental change travels on its own. A zone edit marks the room to be saved by the ordinary periodic save rather than writing it out immediately.

## Permission Enforcement
Every voxel operation is checked against who is asking and which room it is:
- **Hub rooms:** any user may edit voxels, since a hub is the game's own thoroughfare.
- **Regular rooms:** only the room's owner may edit; anybody else's attempts are rejected and rolled back.

On top of that, an edit landing inside one of the room's restricted zones is refused unless the user is the one the room answers to. Both questions are about the person rather than about a standing handed out inside the room, which is why every entry point here is told who is asking.
