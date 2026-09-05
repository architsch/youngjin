# Room Generation Defines What a Room Is

The rule in one line, as [`../../CLAUDE.md`](../../CLAUDE.md) states it: **a new room-level parameter
must be chosen by room generation in the same change that introduces it.** This page is why, and how
far the obligation reaches.

Every room in the game is born from `RoomGenerationUtil` — multiplayer rooms laid out procedurally by
`HubRoomBuilder` and `RegularRoomBuilder` on top of `ProceduralRoomBuilder`, single-player rooms built
from their `SinglePlayerModeConfig` — and nothing else ever produces one. That makes room generation
the *definition* of a complete room: not only the voxels and objects inside it, but every room-level
parameter those contents were chosen to suit.

## Why this is not polish to defer

1. **A parameter no generator sets does not exist in practice.** Since every room is created by
   generation, a parameter left out of it is one that every room in the game silently holds the
   default value of. However complete its editing UI is, the feature ships looking like it was never
   built — visible only to the few owners who go and change it by hand.
2. **Room parameters are not independent of each other, or of the room's contents.** A palette's
   texture indices only mean anything within one specific texture pack; fog has to agree with the
   skybox; a prop's materials have to come from the room's own pack. Generation is the single place
   where those agreements are expressed. Adding a parameter anywhere else and leaving generation
   alone produces rooms whose settings contradict their own contents.
3. **Generated rooms are what almost everyone sees.** Hubs and newly created rooms are the game's
   first impression, and most of them are never hand-edited at all. A parameter generation does not
   decide is one whose effect most players never encounter.

## Contents are a narrower obligation than parameters

Reading the rule as "generation must place everything" is the usual overcorrection. Procedural
generation lays out a multiplayer room's voxel grid — its areas, the walls and passages between them,
the ways up to the storey above, and the voxel block work standing in them — and places exactly one
object: the door that is the room's way in. A Hub or Regular room is otherwise meant to be furnished
by the people who use it, so what generation owes them is somewhere to build rather than a full
house.

- A new kind of **placeable object** needs nothing from generation.
- A new kind of **voxel content** does.
- The **door** is the exception because it is not furniture: a room with no door is a room nobody can
  leave, and it is also what an arriving player is put down behind. Anything else that becomes
  structurally necessary in that sense belongs in generation for the same reason.

## What introducing a parameter concretely means

- Store it wherever the room is stored, so it reaches clients along with the room: on `Room` for most
  parameters, or in the room's own content blob where it belongs beside the contents. Which of the
  two it lives in decides nothing about this rule — a parameter kept with the voxels is a room-level
  parameter and is reached by every line of this page.
- Make `RoomGenerationUtil` and the procedural `RoomBuilder`s decide it. **The obligation is to
  decide, and the decision is sometimes the default.** A parameter that is a judgement about one
  particular room — which nothing a generator knows could stand in for — is rightly generated empty.
  What is never allowed is leaving it undecided, and the two are told apart only in writing: say in
  the parameter's `/docs` page what generated rooms come with and why, so the next reader meets a
  considered answer rather than an oversight to correct.
- Declare it on every `SinglePlayerModeConfig`, which carries its parameters as `RoomBuilderParams`.
- Where the parameter has curated data behind it — as texture packs have palettes in `RoomPaletteMap`
  — extend that curation to cover **every** option a room can be generated with.

Conceptual details live in [`../../docs/geometry/room_generation.md`](../../docs/geometry/room_generation.md).
