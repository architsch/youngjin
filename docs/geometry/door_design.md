# Door Design

Reference: @src/shared/graphics/mesh/composition/types/compositionCodec/doorCompositionCodec.ts , @src/shared/graphics/mesh/composition/types/compositionConstants/doorCompositionConstants.ts , @src/shared/graphics/mesh/composition/types/compositionBuilder/doorCompositionBuilder.ts , @src/client/graphics/maps/materialConstructorMap.ts

A door is a wall-attached `GameObject` that is drawn with no textures. It is assembled from flat quads through the [instanced mesh composition system](../graphics/instanced_mesh_composition.md), and each quad is shaded by a procedural moulded-timber material. What a door *does* (label, destination, spawning) is covered in [room_entrance.md](room_entrance.md).

![A generated door in a room's wall](figures/door_design_1.jpg)

## Shape
- Every door follows one design, a panelled wooden door: frame, panels on either side of a central upright, a name plate and a knob. Only the finish varies, so a row of doors still reads as doors.
- The **footprint** (the wall space the door claims) is one storey tall. The drawn **panel** is centered in it and flush with its bottom, and the leftover space is margin. All face proportions derive from a few rail and upright measurements in `DoorCompositionConstants`.
- Regions are layered back to front with real depth offsets rather than tiny nudges, which avoids z-fighting on low-precision mobile depth buffers.

## Label
The name is drawn in the scene as a quad slightly in front of the plate, so walls occlude it (unlike an HTML overlay). All labels in a room share one mesh and one texture atlas, which is one draw call and the reason a room's label count is capped. The label component is generic: it draws any object's text onto the patch that object reserves. The label color comes from its own full-spectrum palette.

## Appearance metadata
- `DoorCompositionCodec` encodes three colors: timber, plate and knob. Decoding clamps its input, so any string yields a drawable door.
- Colors come from a joinery palette (separate from the player palette) and are drawn as coordinated presets. The timber stays mid-brightness, and the plate stays close to the timber's brightness.
- A door without stored appearance derives one from its room and object id, not from the viewer, so everyone sees the same door.

## Moulded timber material
A reusable procedural wood shader for any moulded rectangular surface. Per quad, it takes a surface color, a moulding color, a band width and raised/sunk.
- Band width and wood figure are measured in **world units** along the quad's axes, so bands match across parts of every size and the grain continues across neighboring parts. Taking the nearer axis mitres the corners.
- Growth rings are made by warping the ring coordinate until it folds, which gives flatsawn arches. Sparse knots deflect the grain.
- Relief is shaded with a fixed, world-space raking light, because the camera-mounted head light cannot reveal relief. Bands are made wider than on a real door so the relief reads.
- Input colors are aged (warmed and desaturated) before lighting.
