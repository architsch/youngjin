# Room Generation System

Reference: @src/shared/room/util/roomGenerationUtil.ts , @src/shared/room/util/roomGenerationHelperUtil.ts , @src/shared/room/util/roomGenerationVolumeUtil.ts , @src/shared/room/util/roomGenerationSpaceUtil.ts , @src/shared/room/util/proceduralRoomGenerationUtil.ts , @src/shared/room/util/roomGenerationLayoutUtil.ts , @src/shared/room/util/roomGenerationStairsUtil.ts , @src/shared/room/util/roomGenerationPropsUtil.ts , @src/shared/room/util/roomGenerationCanvasUtil.ts , @src/shared/room/maps/roomGenerationPaletteMap.ts , @src/shared/room/types/roomGeneration/roomGenerationVolume.ts , @src/shared/room/types/roomGeneration/roomGenerationSpace.ts , @src/shared/singlePlayer/maps/singlePlayerModeConfigMap.ts

## Overview

The room generation system lets us procedurally generate a room's content (i.e. `VoxelGrid` and `ObjectGroup`) without having to manually edit the individual voxels/objects by hand. Both multiplayer and singleplayer rooms are initially built by this system, via `RoomGenerationUtil`.

In case of multiplayer rooms, the system is also responsible for the room's boundary: it raises the perimeter walls and carves the doorway opening for the room's single entrance into one of them (see [room_entrance.md](room_entrance.md)).

Generation decides more than a room's contents: it also decides the room-level parameters those contents were picked to suit, and writes them onto the `Room` itself. See [Extending the System](#extending-the-system) for why that responsibility has to keep growing along with the rest of the game.

## Describing a Room

A room is described by the **empty space inside it**, never by what it is built out of. It starts as one solid mass of blocks filling the grid, and everything about it comes from the boxes hollowed out of that mass.

Two types carry the whole description:

- A `RoomGenerationVolume` is a box of the grid: a rectangle of cells over a stretch of the room's height. It is the *only* shape the system works in — rooms, doorways, stairwells, the storeys themselves and the stretches of a room that have to be kept clear are all one of these. A room is therefore laid out in three dimensions from the start, rather than as a flat plan that something else is left to give a height to. `RoomGenerationVolumeUtil` answers everything ever asked of one: whether two of them meet, what a footprint comes to when it is met with one of the room's storeys, and how far a routine may work inside one while keeping clear of its edges.
- A `RoomGenerationSpace` is a volume together with the palette the surfaces enclosing it are finished in.

`RoomGenerationSpaceUtil` turns a list of spaces into a `VoxelGrid`, and this is the only way a room is ever built. The consequences are worth stating plainly, because they are what makes the description short:

- **Nothing ever builds a wall.** A wall is a place no space reached — as is a floor slab between two spaces stacked on top of each other, and the ceiling over the topmost one. None of them is described anywhere; every one of them appears because a space stopped where it did.
- **A doorway is a space.** So is a stairwell, and so is the opening a player arrives through. A passage cut through a wall is not a different kind of thing from the rooms it joins, only a smaller one.
- **A room stands exactly as tall as its spaces reach.** A room described with a ground storey and nothing above it is built no higher than the slab that would have carried the floor above it, and that slab becomes its roof rather than anybody's floor.
- **A face is finished by whichever space looks at it.** Once the mass stands, each space finishes what encloses it — the floor under it, the ceiling over it, the walls around it — in its own palette. So one wall between two differently finished rooms carries each room's own texture on the side that faces it, without anything having to arrange that.

### Storeys

A **storey** is nothing more than a volume covering the whole room over one stretch of its height (see [voxel_grid.md](voxel_grid.md#storeys)). Meeting a footprint with one of them is what puts a space on one floor of the room, and it is the only mechanism there is for deciding how many storeys a room has:

- Meeting a footprint with the ground storey and again with the upper one gives two rooms stacked on top of each other, with the mass between them left as the floor of the upper one.
- Meeting it with the room's whole height instead gives one tall space open from the room's own floor to its own ceiling.
- Meeting it with the ground storey alone gives a single-storey room, capped by mass with nothing above it.

### The room's roof

Where a room is capped by mass rather than by the room's own ceiling, the upward faces of that cap are left undrawn. Nothing stands above the cap for anyone to be looking at it from, and a camera drawn back far enough to look down at the room would otherwise be shown a lid instead of the room — so this is what lets such a room be watched from outside as well as walked around inside.

## Procedural Multiplayer Rooms

Every multiplayer room — Hub or Regular — is laid out procedurally when the server creates it, from a seed drawn at that moment, so that no two rooms open on the same interior. The seed itself is not kept: what it produced is saved as the room's ordinary content, and is edited from then on like any other room's.

`ProceduralRoomGenerationUtil` is the recipe. It decides what a multiplayer room is made of, and leaves the how to the parts below. It runs in three passes, and the order is not incidental:

1. **The plan.** The room is settled as a floor plan and the flights that climb out of it, entirely as geometry — nothing is written anywhere. Only then is it turned into the spaces the room is actually made of, since how many storeys a room has at all turns on whether anything in it can be climbed.
2. **The building.** The spaces are hollowed out of the mass, and the steps are built into what results.
3. **The furnishing.** Block work and paintings are added, working off the built room rather than off the plan — because furnishing has to ask the finished room questions the plan cannot answer, above all whether there is anything at a given place to stand something on.

### Texture packs and palettes

A voxel texture index is a cell position within the room's texture pack atlas rather than a material, and each pack puts something entirely different at any given position. A set of textures is therefore only meaningful alongside the pack it was chosen against — which is why the room's texture pack is drawn as part of generating it, rather than being fixed beforehand.

`RoomGenerationPaletteMap` holds, per texture pack, a set of hand-picked `RoomGenerationPalette` combinations — a floor, a ceiling, a wall and an accent texture that read well together in that pack. Generation draws a pack together with its palettes, and from then on only ever assigns whole palettes, never individual textures. Drawing whole palettes is what makes each region look like a deliberately decorated space rather than a patchwork; drawing the pack is what stops every room in the game from opening on the same handful of materials.

A pack with no palettes picked for it is one that no room is ever generated in — the room's owner can still re-skin their room with it afterwards. So shipping a new texture pack means curating palettes for it as well, or it stays invisible to everyone but the owners who go looking for it.

### Laying a room out

`RoomGenerationLayoutUtil` turns a bare part of the room into a set of connected areas. It writes nothing anywhere: a floor plan is worked out purely as geometry, and the walls in it are never drawn at all.

1. The band of floor in front of the entrance is always kept as one undivided hall, so that what an arriving player sees is a room rather than the back of a wall.
2. Everything deeper into the room is cut recursively into rectangular areas — none narrower than a minimum, each separated from its sibling by a wall line one cell thick. Only the footprint is cut: every piece comes out standing the room's full height, since a wall divides a room at every height alike. A cut runs across the longer axis so that the areas stay roughly square; where the two axes are comparable, the seed picks.
3. Every wall line is then opened up with one or more archways. Because the cuts form a tree of areas, a single opening per wall line is already enough to join all of them, so the whole room ends up walkable.

Each area and each archway then becomes one space per storey the room has, and it is that last step — and nothing else — that decides whether the room comes out as one floor or two.

### Storeys and stairs

Three things are settled while the room is still a plan, since all three change which spaces the room is described as:

1. **Where the room is climbed.** A staircase doubles back on itself — a run out and a run back, side by side — rather than climbing in one straight line, since a straight run tall enough to reach the storey above would be longer than most of the rooms it would have to stand in. Each step stands one layer taller than the step before it, which is a stride the player can climb, and the last of them stands level with the floor above. Each run is several cells wide rather than one: a flight one cell across is a ledge the player has to line himself up on before every stride and slips off the side of whenever he does not, where a wider one is simply stairs he walks up.

   The flight's own stairwell is a space standing open from the room's floor to its ceiling, so that a player climbing has the room's full height above him instead of meeting the underside of the floor he is climbing towards. The one tread of the flight no step stands on is left out of that space, and so keeps the floor above as the landing he arrives on. Because a staircase stands well inside the area it is placed in, where everything is open floor by construction, placing one is a purely geometric question — nothing needs asking of the room itself.
2. **Which spaces are left open through both storeys.** Some of the room's areas are floored over and some are not, so that a room is not uniformly two storeys of the same height. An area left open stands from its own floor to the room's ceiling, and the upper storey looks down into it over a gallery running around its edge — the ring of cells that keeps its floor. That ring is not decoration: the upper storey's archways open onto it, and an area opened up to its very edge would leave a player stepping out through one into thin air.
3. **Whether the room gets an upper storey at all.** A room whose areas are all too small to hold a staircase is built as one tall single-storey space throughout, rather than being given a floor nobody can reach.

### Decoration

Two utils furnish the finished voxel grid, both working off the built room rather than off the plan:

- **Block work** (`RoomGenerationPropsUtil`). Each space gets one arrangement of decorative blocks picked by the seed — a colonnade flanking its central aisle, a low plinth at its centre, blocks in its corners — or is deliberately left bare, so that a room has open space in it as well as furnished space. An arrangement is worked out as pure geometry — the volume its stacks fill, which of that volume's cells they stand on, what their faces carry — and every arrangement is then placed by the same two rules, so that neither of them can be forgotten by a new one:
  - **Nothing may hang in mid-air.** A prop is furniture in the space a player walks around it in, so it rises from that space's own floor and stops below its own ceiling rather than running through the room. But a space above the ground stands on a slab the room may have been *left without* — over a stairwell, or across somewhere the storey above looks down into — so a stack with nothing under it is simply not built. That is what keeps a room open through both storeys furnished on the ground alone, without the recipe having to know which rooms those are.
  - **Nothing may crowd what the room has promised to keep clear**: the floor the entrance opens onto, the stairs, and the ring of floor around the stairs — a flight is walked onto from beside it and stepped off beyond it, and stairs are exactly where a player has least room to squeeze past something.
- **Paintings** (`RoomGenerationCanvasUtil`). `Canvas` objects are hung on the wall faces that are solid behind and open in front, at a standing player's eyeline and spaced out along each wall. Every storey is hung, each at its own eyeline, and the spacing is kept within a storey rather than across them — two paintings one above the other on the same stretch of wall are on two different walls as far as anyone looking at them is concerned. A painting also needs somebody to be able to walk up to it, so a wall face above a space open through both storeys is passed over: the painting would hang over the drop, where the only way to see it is to fall past it. They carry no source user: they belong to the room itself, the way a single-player room's fixtures do.

### The entrance

A room's boundary is mass like any other wall, so the way in is a space of its own: a cavity for passage, the height of a doorway, cut through that boundary and finished in the hall's palette. A multiplayer room that failed to describe it would come out with no way in at all.

The stretch of floor it opens onto is never built on and never hung with anything. That keeps an arriving player from being boxed in whichever way the rest of the room came out, and keeps generated content clear of the cells that room editing protects (see [room_entrance.md](room_entrance.md)).

## Tutorial Room

Every first-time user automatically enters the "tutorial room" in order to participate in the tutorial. It is described the same way a procedural room is — as the spaces standing open in it — and its dimensions are parameterized for easy adjustment. Because the tutorial room is a single-player room, this construction happens on the client (the server stores no copy of it — see [single_player_mode.md](../networking/single_player_mode.md)). The overall structure of the tutorial room is shown below.

![Tutorial Room](figures/tutorial_room.jpg)

A single-player room is a fixed, hand-authored template rather than a procedural one, so its `SinglePlayerModeConfig` *declares* the room-level parameters it is built with instead of drawing them. It still has to account for every one of them, for the same reason a procedural generator does.

The tutorial is a run of small rooms the player is walked through in turn, each finished in a palette of its own so that moving from one to the next is visible as such. Two of the walls between them are opened up by scripted steps as the tutorial sends the player on — and because each of those walls is named as a volume, a step opening one takes the wall's own height from it rather than being told separately how tall the room is.

Every one of those spaces is on the ground storey and none on the storey above, which is what makes the tutorial a single-storey room: it is built no higher than the slab that caps it, so nothing stands in the empty height over that. The tutorial is watched from outside as much as from inside — much of it is played with the camera drawn back and looking down — and that cap is the room's roof, drawn only from below (see [The room's roof](#the-rooms-roof)). So a camera pulled far enough back looks into the room rather than down onto a lid, and it does so over the whole grid at once: the mass the room is set into caps off at the same height, and a lid over *that* would read from above exactly like a lid over the room.

## Extending the System

Room generation is the only thing that ever produces a room, which makes it the definition of what a complete room is. Whenever a new room-level parameter is introduced — the colour of a room's light, its skybox, its fog — or a new kind of object becomes placeable as a prop, generation has to be taught to decide or place it as part of the same change. Three things go wrong otherwise:

- **A parameter no generator sets is one that no room has.** Since every room comes out of generation, a parameter left out of it is one that every room in the game silently holds the default value of. However complete the editing UI for it is, the feature ends up visible only to the handful of owners who go and change it by hand.
- **A room's parameters are not independent of each other, or of its contents.** A palette only means anything alongside the texture pack it was picked against; fog has to agree with the skybox; a prop's materials have to come from the room's own pack. Generation is the single place those agreements are expressed, so a parameter introduced anywhere else produces rooms whose settings contradict their own contents.
- **Curated data has to cover everything that can be drawn.** Where a parameter has hand-picked content behind it — as texture packs have palettes — every option a room can be generated with needs that content, or generation has to leave the option out and the option effectively does not ship.

In practice this means the parameter is added to `Room` (so that it is stored and sent to clients), `RoomGenerationUtil` and `ProceduralRoomGenerationUtil` start deciding it, every `SinglePlayerModeConfig` declares its value, and any curated data behind it is extended to match.