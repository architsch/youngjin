# Instanced Mesh Composition System

Reference: @src/client/graphics/types/mesh/instancedMeshBinding.ts , @src/client/object/components/instancedMeshGraphics.ts , @src/client/object/components/instancedMeshComposer.ts , @src/client/object/components/helpers/mesh/instancedMeshComposition.ts , @src/shared/graphics/mesh/composition/types/compositionCodec/instancedMeshCompositionCodec.ts , @src/shared/graphics/mesh/composition/types/compositionBuilder/instancedMeshCompositionBuilder.ts , @src/server/ssg/builder/preEncodedCompositionBuilder.ts , @src/server/ssg/builder/instancedMeshCapacityBuilder.ts , @src/server/ssg/builder/compositionThumbnailBuilder.ts

A `GameObject` can render itself as a set of simple parts borrowed from shared instanced meshes. The parts are described by its `InstancedMeshComposition` metadata string. Players, doors, lamps and canvas frames use this system.

![InstancedMeshComposition System Overview](figures/mesh_composition_1.jpg)

## Pieces
- Each `InstancedMesh` is one geometry + material pair (`GeometryConstructorMap`, `MaterialConstructorMap`).
- `InstancedMeshBinding` tracks the instances an object has rented from one mesh. `InstancedMeshGraphics` routes calls to the right binding.
- A part names its geometry and its material separately; the pair is the mesh that draws it (`InstancedMeshIdMap`).
- `InstancedMeshComposer` decodes the metadata into `InstancedMeshCompositionPart[]` through `InstancedMeshComposition`, then rents, transforms and returns instances to match.
- An `InstancedMeshCompositionCodec` (selected by a prefix on the string) encodes and decodes the metadata. It uses `InstancedMeshCompositionBuilder` helpers to place parts.
- A codec built around **parameters** (a player's slots, a door's or canvas's colors) stores those and rebuilds its parts from them, so it can offer presets, seeded defaults and a bounded set of variants. `DefaultCompositionCodec` instead **spells out arbitrary parts**, and is what authored data is pre-encoded through.
- Meshes are shared across object types (doors and canvas frames are both wood), and whichever type loads a mesh first fixes its size, so each is created at its worst case from `InstancedMeshCapacityMap` (see below).
- An object may draw its own content over a composed part, as a door's label sits on its plate. A canvas is one moulded board: the band is the frame, and the picture covers the surface inside it, inset by the decoded board's band so it follows any edit to it. A canvas without a frame composes no parts, and its picture covers the whole footprint.

## Spelled-out parts
`DefaultCompositionCodec` writes each part as one fixed-width word, with no separator: the leading character carries the geometry and material together, and the material is what says how many characters follow. The rest is the facing (one of the axis directions in `DIR_VEC_BY_CODE`), the offset, the scale, and the colors — stored as positions in the material's palette (`COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID`), so an authored color outside that palette comes back as its nearest neighbour.
- Offsets and scales are quantized **to the step the game authors on**, not spread across their range, so a value already on the grid survives a round trip exactly. A value off the grid is snapped, and one outside the range is a build error.
- Flat squares are not given a stored depth. A square laid over an earlier square it overlaps is lifted one relief step clear of it, along the face it shows, at decode time. Encoding takes that back off, so a stack does not creep outwards each time the composition is rebuilt.
- A string cut short (metadata is length-capped) drops the part it cuts rather than half-reading it, and an unreadable leading character ends the decode, since nothing after it can be located.

## Indexed compositions
Metadata is stored and sent once per object, so a spelled-out composition is expensive. `IndexedCompositionCodec` is a **router**: the object stores only an index into `PreEncodedCompositionStringMap`, and the entry at that index (which carries its own codec prefix) is decoded by its own codec.
- The table is generated at build time by `PreEncodedCompositionBuilder` (during SSG) from authored asset data, so a new variant is a data edit rather than new code.
- Every entry belongs to one object type, and `PreEncodedCompositionIndexMap` lists each type's entries. Entries are append-only, because objects store their index.
- The contents of an entry are not editable. An object whose look users edit gets a codec of its own instead (players, doors, canvases).
- Fields that cannot be known ahead of time are left indeterminate, and the object fills them in after decoding (e.g. a lamp's face color comes from its light).
- Entries are regenerated from their source whenever the format changes, so no stored object needs converting: an object holds only the index.

## Mesh capacities
`InstancedMeshCapacityBuilder` generates `InstancedMeshCapacityMap` during SSG: for each mesh, the sum over types of the type's room cap × the most parts one object of that type can put in it.
- A type's appearances are the structural variants its codec lists (every distinct set of parts it can build), or its pre-encoded entries for indexed types. A new part type or variant must be reachable from that list.
- Objects vary independently, so each mesh's maximum is taken on its own; the result is exact, not padded.
- Only composed meshes are listed. Voxel quads, canvas pictures and labels size their own meshes from their room caps.
- The inputs are code, so an integration test fails when the committed table no longer matches; re-run SSG.

## Thumbnails
`CompositionThumbnailBuilder` runs during SSG and draws every type's entries into one atlas per type (`CompositionThumbnailUtil`), which choosers display cell by cell.
- It renders in headless Chromium with the game's own geometry and materials, through the same part-placement code as the game (`InstancedPartUtil`). Each type may set its camera angle in its composer config (isometric otherwise).
- SwiftShader (CPU) rendering makes the output identical on every machine, so a committed atlas changes only when the look does.
- In dev, a type whose entries are unchanged is skipped; a standalone SSG run always redraws, which is how shader changes reach the atlases.

## Hiding instances
All instances of a mesh share one draw call, so a single instance is hidden by **parking it far outside the room**. Returned instances are parked the same way. Another system, such as the orbit occlusion hider, can temporarily hide an instance: `InstancedMeshBinding` buffers the owner's transforms while it is hidden and applies the latest one when it is shown again. Returning a hidden instance clears its hidden state.
