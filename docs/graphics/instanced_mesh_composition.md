# Instanced Mesh Composition System

Reference: @src/client/graphics/types/mesh/instancedMeshBinding.ts , @src/client/object/components/instancedMeshGraphics.ts , @src/client/object/components/instancedMeshComposer.ts , @src/client/object/components/helpers/mesh/instancedMeshComposition.ts , @src/shared/graphics/mesh/composition/types/compositionCodec/instancedMeshCompositionCodec.ts , @src/shared/graphics/mesh/composition/types/compositionBuilder/instancedMeshCompositionBuilder.ts , @src/server/ssg/builder/preEncodedCompositionBuilder.ts , @src/shared/graphics/mesh/composition/util/preEncodingSourceUtil.ts , @src/server/ssg/builder/instancedMeshCapacityBuilder.ts , @src/server/ssg/builder/compositionThumbnailBuilder.ts

A `GameObject` can render itself as a set of simple parts borrowed from shared instanced meshes. The parts are described by its `InstancedMeshComposition` metadata string. Players, doors, lamps and the framed panels (canvases, labels) use this system.

![InstancedMeshComposition System Overview](figures/mesh_composition_1.jpg)

## Pieces
- Each `InstancedMesh` is one geometry + material pair (`GeometryConstructorMap`, `MaterialConstructorMap`).
- `InstancedMeshBinding` tracks the instances an object has rented from one mesh. `InstancedMeshGraphics` routes calls to the right binding.
- A part names its geometry and its material separately; the pair is the mesh that draws it (`InstancedMeshIdMap`).
- `InstancedMeshComposer` decodes the metadata into `InstancedMeshCompositionPart[]` through `InstancedMeshComposition`, then rents, transforms and returns instances to match.
- An `InstancedMeshCompositionCodec` (selected by a prefix on the string) encodes and decodes the metadata. It uses `InstancedMeshCompositionBuilder` helpers to place parts.
- A codec built around **parameters** (a player's slots, a door's colors, a framed panel's finish) stores those and rebuilds its parts from them, which bounds the variants it can build. `DefaultCompositionCodec` instead **spells out arbitrary parts**.
- What a part takes from the object rather than the composition (a lamp's glow color, from its light) is filled in by the type's composer config after every decode, so no stored composition can override it.
- Decoding is given the object's current footprint (see [object_update.md](../networking/object_update.md)), so a resizable type's codec lays its parts out against the size rather than an authored constant. The size is not stored, so a resize is a re-decode, from the live parameters rather than the stored string so that an edit not yet saved survives it. Moves and resizes reach the composer through the object's transform notification (`GameObject.notifyTransformChanged`), which tells the two apart, since scale lives outside the three.js transform. A codec for a fixed-size type ignores it, `DefaultCompositionCodec` included — spelled-out parts are already the size they were authored at.
- Meshes are shared across object types (doors and canvas frames are both wood), and whichever type loads a mesh first fixes its size, so each is created at its worst case from `InstancedMeshCapacityMap` (see below).
- An object may draw its own content over a composed part, as a door's label sits on its plate.
- Canvases and labels are **framed panels** (`FramedPanelCompositionConstants`): one moulded board over the whole footprint, whose band is the frame, or no board at all. What it frames (a picture, text) covers the surface inside the band, or the whole footprint when there is no frame. The board follows whatever the object has been resized to while the band keeps its width, because the wood material measures the band in world units.
- The panel types share one codec (`FramedPanelCompositionCodec`) and differ only in the looks they offer.
- A picture and a label's text are drawn by the object inside the band, re-placed whenever its composer rebuilds its parts (`InstancedMeshComposer.partsRebuiltObservable`).

## Spelled-out parts
`DefaultCompositionCodec` writes each part as one fixed-width word, with no separator: the leading character carries the geometry and material together, and the material is what says how many characters follow. The rest is the facing (one of the axis directions in `DIR_VEC_BY_CODE`), the offset, the scale, and the colors — stored as positions in the material's palette (`COMPOSITION_PALETTE_NAME_BY_MATERIAL_ID`), so an authored color outside that palette comes back as its nearest neighbour.
- Offsets and scales are quantized **to the step the game authors on**, not spread across their range, so a value already on the grid survives a round trip exactly. A value off the grid is snapped, and one outside the range is a build error.
- Flat squares are not given a stored depth. A square laid over an earlier square it overlaps is lifted one relief step clear of it, along the face it shows, at decode time. Encoding takes that back off, so a stack does not creep outwards each time the composition is rebuilt.
- A string cut short (metadata is length-capped) drops the part it cuts rather than half-reading it, and an unreadable leading character ends the decode, since nothing after it can be located.

## Indexed compositions
Metadata is stored and sent once per object, so a spelled-out composition is expensive. `IndexedCompositionCodec` is a **router**: the object stores only an index into `PreEncodedCompositionStringMap`, and the entry at that index (which carries its own codec prefix) is decoded by its own codec.
- Lamps use it with one entry per size, and store no composition at all: a lamp's default parts are the entry for its current size, so its look can't disagree with its footprint. A resize re-decodes the live parameters, so the lamp points them at the new size's entry first (`LampGameObject`).
- Doors, canvases and labels use it with one entry per look on offer, which users pick between. A framed panel's first look is the frameless one; an object storing none is given one of the others (any, for a door), seeded by its room and id so everyone sees the same.
- A type accepts only its own entries, on the server and when decoding (`CompositionMetadataUtil.isIndexedLookOf`): another type's entry builds parts and parameters the object can't place.
- The table is generated at build time by `PreEncodedCompositionBuilder` (during SSG) from authored asset data (`pre_encoding_source.json`), so a new look is a data edit rather than new code. An entry gives parts for `DefaultCompositionCodec` or parameters for any other codec, and every value it gives must survive that codec's round trip or the build fails.
- `npm run compositionEditor` (@dev/scripts/compositionEditor) edits that source with every entry's thumbnail redrawn as it changes. It encodes through the build's own `PreEncodingSourceUtil` and draws with the build's thumbnail renderer, so what it shows, errors included, is what SSG will produce; it writes only the source, which SSG then turns into the tables and atlases.
- Every entry belongs to one object type, and `PreEncodedCompositionIndexMap` lists each type's entries. Entries are append-only, because objects store their index.
- The contents of an entry are not editable. An object whose look users edit freely gets a codec of its own instead (players).
- Fields that cannot be known ahead of time are left indeterminate, for the object to fill in after decoding (see above).
- Entries are regenerated from their source whenever the format changes, so no stored object needs converting: an object holds only the index.

## Mesh capacities
`InstancedMeshCapacityBuilder` generates `InstancedMeshCapacityMap` during SSG: for each mesh, the sum over object categories of the category's room cap × the most parts one object of any type in it can put in that mesh.
- A type's appearances are the structural variants its codec lists (every distinct set of parts it can build), or its pre-encoded entries for indexed types. A new part type or variant must be reachable from that list. A resizable type is counted at its largest.
- A cap is shared by its category's types (see `ObjectCategoryConfigMap`), so a category contributes its greediest type once rather than every type it holds.
- Objects vary independently, so each mesh's maximum is taken on its own; the result is exact, not padded.
- Only composed meshes are listed. Voxel quads, canvas pictures and labels size their own meshes from their room caps.
- The inputs are code, so an integration test fails when the committed table no longer matches; re-run SSG.

## Thumbnails
`CompositionThumbnailBuilder` runs during SSG and draws every type's entries into one atlas per type (`CompositionThumbnailUtil`), which choosers display cell by cell.
- It renders in headless Chromium with the game's own geometry and materials, through the same part-placement code as the game (`InstancedPartUtil`). Each type may set its camera angle in its composer config (isometric otherwise).
- A type's entries share one framing, so entries of different sizes keep their proportions (a lamp's sizes read at a glance).
- `CompositionThumbnailPanel` shows a type's atlas as a chooser (a lamp's sizes, a door's finishes, a framed panel's frames); an entry its caller refuses (a lamp size that doesn't fit where it stands) is dimmed and can't be picked.
- SwiftShader (CPU) rendering makes the output identical on every machine, so a committed atlas changes only when the look does.
- In dev, a type whose entries are unchanged is skipped; a standalone SSG run always redraws, which is how shader changes reach the atlases.

## Hiding instances
All instances of a mesh share one draw call, so a single instance is hidden by **parking it far outside the room**. Returned instances are parked the same way. Another system, such as the orbit occlusion hider, can temporarily hide an instance: `InstancedMeshBinding` buffers the owner's transforms while it is hidden and applies the latest one when it is shown again. Returning a hidden instance clears its hidden state.
