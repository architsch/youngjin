# Voxel Grid Update Flows

Reference: @src/shared/voxel/util/voxelUpdateUtil.ts , @src/server/voxel/serverVoxelManager.ts , @src/client/voxel/clientVoxelManager.ts

Voxel edits are **optimistic**: the client validates and applies an edit through the shared `VoxelUpdateUtil`, then emits a signal. The server re-validates with the same utility. On success it relays the signal to everyone else. On failure it answers the sender with what the room really holds, which puts their copy back in step whatever it had made of the edit.

| Signal | Edit | Answer on failure |
|---|---|---|
| `AddVoxelBlockSignal` | a block of a given shape and textures | the truth of the cell layer |
| `RemoveVoxelBlockSignal` | the block gone | the truth of the cell layer |
| `SetVoxelBlockShapeSignal` | the block given another shape where it stands | the truth of the cell layer |
| `MoveVoxelBlockSignal` | the block in another cell layer, in the shape it has | the truth of both cell layers |
| `SetVoxelQuadTextureSignal` | one face repainted | the same signal carrying the old texture |
| `SetRestrictedZonesSignal` | the zone list | the room's current zone list |

- **The truth of a cell layer** is an `AddVoxelBlockSignal` carrying the block there, or a `RemoveVoxelBlockSignal` if it holds none. So on the receiving side an add replaces whatever block is there, and a removal of nothing is no event.
- One gesture is one signal: batches are sent grouped by signal type, so two signals of different types can arrive in either order. A drag is previewed locally (`ClientVoxelManager`) and sent as the single edit it comes to. Any other voxel edit arriving meanwhile ends the preview first.
- A block's shape must be one a block can have (`VoxelBlockShapeUtil`), and a reshape is refused while it would leave an attached object without its footing (see [object_attachment.md](../geometry/object_attachment.md)).

- Restricted zones are always sent as the full list (see [restricted_zone.md](../gameplay/restricted_zone.md)). They are stored with the voxels, so joining clients receive them with the room.
- Edits mark the room dirty for the periodic save.
- **Permissions**: anyone may edit voxels in Hub and Regular rooms, except inside restricted zones, where only the superuser may. Every entry point receives the requesting user.
