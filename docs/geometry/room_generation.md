# Room Generation System

Reference: @src/shared/room/generation/util/roomGenerationUtil.ts , @src/shared/room/generation/util/roomVolumeUtil.ts , @src/shared/room/generation/types/roomVolumeType.ts , @src/shared/room/generation/maps/roomVolumeConstructorMap.ts , @src/shared/room/generation/maps/roomPaletteMap.ts , @src/shared/room/generation/types/builder/ , @src/shared/singlePlayer/maps/singlePlayerModeConfigMap.ts

Every room, multiplayer or single-player, is created by `RoomGenerationUtil`. Generation produces the room's contents (`VoxelGrid`, `ObjectGroup`) **and** its room-level parameters (texture pack, lighting, etc.), which it writes onto `Room`. Any new room-level parameter must be decided by generation in the same change; see [.claude/rules/room-generation.md](../../.claude/rules/room-generation.md).

## Carving
- A room starts as solid matter, and spaces are carved out of it. A `RoomVolume` (a box of cells over a height range) is the only shape the system uses. Areas, passages, stairwells, storeys and keep-clear zones are all volumes.
- Walls, floor slabs and ceilings are never built. They are whatever matter was left uncarved.
- Carving order does not matter. Blocks are removed first, and surfaces are finished afterwards based on what is still solid, so a face takes the `RoomPalette` of the volume it faces.
- `RoomVolumeUtil` handles volume math and applies volumes to the grid. `RoomVolumeConstructorMap` names the shared shapes (storeys, the entrance area, a block) so every part of generation agrees on them.
- A storey is a volume over part of the room's height (see [voxel_grid.md](voxel_grid.md)). Carving on one storey, on both, or across both gives an area on one floor, stacked areas, or a tall space. The top layer is never carved.

## Room builders
`RoomBuilder` → `ProceduralRoomBuilder` → `MultiplayerRoomBuilder` → `HubRoomBuilder` / `RegularRoomBuilder`, plus `TutorialRoomBuilder`. New kinds of room should be new builders. Each part of the procedural work lives in its own helper under `builder/helpers/`.

A multiplayer room is laid out from a random seed when the server creates it. The seed is not stored, since the result is saved as ordinary room content. **Hubs currently skip the procedural pipeline** and are generated as two open storeys plus the entrance door (the procedural hub recipe remains commented out in `HubRoomBuilder`). Regular rooms are procedural and single-storey, with the mass above left solid to be mined out.

`ProceduralRoomBuilder` runs three passes:
1. **Plan**: the whole room is described as volumes grouped by `RoomVolumeType` (space, opening, stairwell, entrance, step, keep-clear). The storey count is decided here.
2. **Carve**: volumes are removed from the matter, and steps are raised back into stairwells.
3. **Furnish**: block work is added based on the built room, because furnishing needs to know where there is floor to stand on.

### Layout
- Small seed volumes grow until they would touch, so neighboring areas always end up **one block of wall apart**. That wall is where passages get cut.
- Passages are added until every area is reachable (checked before carving). Distant areas get longer passages, and diagonal areas get L-shaped corridors. Areas are only joined on the same floor.
- An upper storey reuses an area's footprint and exists only if a stairwell fits: a flight several cells wide, one layer taller per step, with the landing cell left uncarved and a ring of floor around it. A recipe can require at least one area large enough for stairs.

### Texture packs and palettes
- A texture index only has meaning within its texture pack, so generation picks the pack together with its palettes from `RoomPaletteMap`, and only ever assigns whole palettes.
- A pack with no curated palettes is never generated. A new pack needs palettes.
- `RoomPaletteSelectionParams` declares which packs and palettes a room may draw from. A room offered many is decorated area by area. Regular rooms are offered one palette and come out plain. Hubs draw a random pack.

### Contents
- Decorative blocks are placed on area floors: never floating, never on keep-clear stretches, and away from area edges.
- The only object placed is the **entrance door**. It sits on a boundary wall, points at the hubs, and is placed after carving. Its entrance area is planned first, and the floor in front of it is kept clear.
- Generated rooms have no restricted zones.

## Tutorial room
![Tutorial Room](figures/tutorial_room.jpg)

A single-player room is a hand-authored template that is built on the client. Its `SinglePlayerModeConfig` declares its parameters instead of drawing them, and scripted steps refer to the room through those same parameters. The tutorial is a single storey: a row of small rooms with distinct palettes, separated by named wall volumes that steps open. Its two fixtures, the receptionist and the exit door, are the only objects generation dresses explicitly. The exit door points at the hubs.
