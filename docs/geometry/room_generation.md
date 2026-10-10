# Room Generation System

Reference: @src/shared/room/util/roomGenerationUtil.ts , @src/shared/room/util/roomVolumeUtil.ts , @src/shared/room/types/roomVolume.ts , @src/shared/room/maps/roomPaletteMap.ts

Every room the server creates, Hub or Regular, comes from `RoomGenerationUtil`, and comes out **empty**: somewhere to build, left to the people who use it. Generation produces the room's contents (`VoxelGrid`, `ObjectGroup`) **and** its room-level parameters (texture pack, lighting, etc.), which it writes onto `Room`. Any new room-level parameter must be decided by generation in the same change; see [.claude/rules/room-generation.md](../../.claude/rules/room-generation.md).

Single-player rooms are not generated. Each is authored by hand and shipped as a room file (see [single_player_mode.md](../networking/single_player_mode.md#rooms)).

## Carving
- A room starts as solid matter, and its spaces are carved out of it as `RoomVolume`s: boxes of voxels over a range of layers (see [voxel_grid.md](voxel_grid.md)).
- Walls, the floor slab and ceilings are never built. They are whatever matter was left uncarved.
- `RoomVolumeUtil` removes a volume's blocks first and finishes the surfaces afterwards, based on what is still solid, in the textures of a `RoomPalette`.

## What a generated room comes with
- **Two open storeys** inside the boundary wall, with the slab between them left solid (see [voxel_grid.md](voxel_grid.md)). The top layer is never carved.
- A boundary wall several voxels thick (`GENERATED_WALL_THICKNESS`): as deep as a door needs behind it, and as wide as a texture tile.
- **One texture of the default pack** on every surface, since how a room looks is its builders' to choose.
- Exactly one object, the **entrance door**: on a boundary wall, pointing at the hubs, and hung after carving (see [room_entrance.md](room_entrance.md)). A room without one could not be left.
- Default atmosphere, no lamps and no restricted zones, each being a judgement about one room (see [lighting.md](../graphics/lighting.md#what-generated-rooms-come-with), [restricted_zone.md](../gameplay/restricted_zone.md)).
- Nothing is drawn at random, so every generated room is the same room.

## Curated palettes
`RoomPaletteMap` lists, for each texture pack, sets of the pack's own textures that go together. Generation uses none of them; the playtest tools dress a sandbox room with them (see [sandbox.md](../testing/playtest/sandbox.md)).
