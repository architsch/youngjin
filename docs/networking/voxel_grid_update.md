# Voxel Grid Update Flows

Reference: @src/shared/voxel/util/voxelUpdateUtil.ts , @src/server/voxel/serverVoxelManager.ts , @src/client/voxel/clientVoxelManager.ts

Voxel edits are **optimistic**: the client validates and applies an edit through the shared `VoxelUpdateUtil`, then emits a signal. The server re-validates with the same utility. On success it relays the signal to everyone else. On failure it sends the sender a compensating signal.

| Signal | Compensation on failure |
|---|---|
| `AddVoxelBlockSignal` | `RemoveVoxelBlockSignal` |
| `RemoveVoxelBlockSignal` | `AddVoxelBlockSignal` carrying the block's captured textures |
| `MoveVoxelBlockSignal` | remove at the target, then restore at the source with its original textures |
| `SetVoxelQuadTextureSignal` | the same signal carrying the old texture |
| `SetRestrictedZonesSignal` | the room's current zone list |

- Restricted zones are always sent as the full list (see [restricted_zone.md](../gameplay/restricted_zone.md)). They are stored with the voxels, so joining clients receive them with the room.
- Edits mark the room dirty for the periodic save.
- **Permissions**: anyone may edit voxels in Hub and Regular rooms, except inside restricted zones, where only the superuser may. Every entry point receives the requesting user.
