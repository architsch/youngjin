# Lighting

Reference: @src/client/graphics/light/maps/lightBlockMap.ts , @src/client/graphics/light/util/ , @src/client/graphics/shaders/lightBlockMapGLSL.ts , @src/client/object/components/lightSource.ts , @src/shared/room/types/roomPrefs.ts , @src/shared/room/util/roomPrefsUtil.ts , @src/shared/graphics/light/util/headLightUtil.ts , @src/shared/graphics/light/util/lampLightUtil.ts , @src/client/graphics/util/atmosphereMaterialUtil.ts , @src/client/graphics/shaders/atmosphereGLSL.ts , @src/client/graphics/shaders/skyShader.ts , @src/client/graphics/graphicsManager.ts

A room is lit by three sources:
- **Head lamp**: the only real `THREE.PointLight` in the scene. It is parented to the camera.
- **Lamps**: installed on walls, stored as data, and delivered to shaders as a voxel light field.
- **Ambient light**.

Everything else (light colors and strengths, fog, smoke, sky, clouds, ground) is the room's **atmosphere**, stored in `RoomPrefs`.

## Why lamps are not three.js lights
- three.js compiles the light count into every shader, so adding or removing a light would recompile every material.
- Point lights shine through walls, and nothing casts shadows.

So lamps are a **field sampled over the voxel block grid**. Each fragment pays one texture fetch no matter how many lamps there are, and walls occlude for free.

## The light block map (`LightBlockMap`)
Rebuild requests (a lamp changed, block work edited) are batched and handled once per frame.

- **Propagation** (`LightBlockPropagationUtil`): each lamp flood-fills through open blocks, and solid blocks stop it (outside the room counts as solid). Brightness uses the **straight-line** distance with point-light falloff, reduced by how much longer the open route is than the straight line. The fill is also bounded by straight-line distance rather than route length, which avoids diamond-shaped light. A lamp has a finite size, so its own block does not get an infinite spike.
- **Direction**: every block stores a light direction weighted by each lamp's contribution, plus the **share of its light that is directional**. Only that share is subject to the facing (cosine) test, so a second lamp can never darken anything. Surfaces facing away still receive a floor share, which stands in for the missing bounce light.
- **Smoothing** (`LightBlockSmoothingUtil`): the field is smoothed before upload. Solid blocks are excluded from the average instead of counting as dark.
- **Sampling** (`lightBlockMapGLSL`): the sample point is pushed half a block out along the surface normal, so light does not bleed through one-block walls. The result is renormalized by the filtered openness, so objects between block centers are not darkened. The light direction meets the relief-perturbed normal.

## Head lamp
- It supplies only the light the room is not already providing. Each frame, the room light **near** the camera is read (`LightBlockDilationUtil`: nearby brightness discounted by distance, spread only through open blocks). The head lamp then dims along a saturating curve and tints toward the room light's color. Reading nearby light rather than light at the camera keeps the head lamp from flattening a lamp's pool when the player views it from outside.
- It cannot be removed: generated rooms have no lamps, and a player who cannot see cannot place the first one.
- It and the fog both scale with the camera's view distance (`GraphicsManager`). Range grows with distance and intensity compensates for falloff. Fog is pushed out, never pulled in.

## Atmosphere settings (`RoomPrefs`)
- Every setting is a small integer step, encoded by `RoomPrefsUtil` into a short string on `Room`, so the atmosphere travels with the room. Colors are palette indices, and each step maps through a curve suited to its quantity.
- **Light**: ambient color and strength; head-lamp color, power and range. A lamp has intensity and range. Range covers both reach and falloff, since they cannot sensibly vary independently. Ambient and head-lamp strengths run past normal lighting into deliberate overexposure.
- **Light palette**: every entry is full brightness (hue and tint only), because strength is a separate setting.
- **Fog**: color plus start and end distances. **Smoke**: strength, scale, speed, drift and rise. **Sky**: color. **Clouds**: color, opacity, scale, softness, speed. **Ground**: low and peak colors, scale, solidity, softness.
- Fog and sky colors come from the "Fog" palette. Clouds and ground use the full-range "Scenery" palette, so they can contrast with the air.
- Unconfigured (missing) values decode to defaults.
- **Concurrent edits**: saves are deferred briefly. While a local edit is pending, lighting updates from the server are ignored, so the last writer wins without flicker.

## Air, sky and ground (`atmosphereGLSL`, `skyShader`)
- **Fog and smoke** are read by **world position**, so smoke is a 3D volume inside the room. Smoke changes fog *coverage*, not color, and has no hard edge. Its shearing field moves more slowly than the smoke itself, so the smoke deforms rather than scrolls.
- The **sky** is read by **view direction**. It is a full-screen quad drawn **last** among opaque objects, depth-tested at the far plane, so pixels already covered by walls are skipped. It writes no depth.
- **No seam at the room's edge**: the sky is fogged by the room's air along the view ray, measured as view depth up to the room's walls and clamped to the far plane, and thinned by the smoke where the ray exits the room.
- **Clouds**: a domain-warped noise field cut at a threshold. The cut width (softness) never drops below one pixel's change. Clouds fade out below the horizon.
- **Ground**: drawn only by the sky, as ridged noise on a plane under the eye. It fades into the air toward the horizon and is fully air at the horizon itself, which avoids a seam. Solidity slows that fade without stopping it. The visible distance is fixed.
- **Speeds** accumulate into running offsets wrapped at the noise period. Computing offsets from time × speed would make the field jump whenever the speed changes.
- All atmosphere values are **uniforms**. Shader defines would recompile materials on every slider change. For the same reason, fog is never removed: "no fog" means distances beyond the far plane.
- A single shared value-noise texture feeds these effects (see [materials_and_shaders.md](materials_and_shaders.md)).

## Lamps
- A lamp is a wall-attached object (see [wall_attached_object.md](../geometry/wall_attached_object.md)). Anyone may edit lamps, subject to restricted zones, and the count per room is capped.
- The current look is a placeholder: a lit rectangle drawn with the **unlit** material, which is shared with the player's face. It is not lit by the field.
- Its face color is derived from its light, and it uses an indexed composition (see [instanced_mesh_composition.md](instanced_mesh_composition.md)).
- Its light originates in the **block in front of the wall**, because the fill stops immediately in a solid block.
- Lamp intensity and range steps are the quantities themselves (multiplier, block count), so the UI can display and accept them directly.

## What generated rooms come with
Generation writes every setting explicitly (see [room_generation.md](../geometry/room_generation.md)). It places no lamps, and it chooses neutral values because lighting is a per-room judgement:
- white ambient, head lamp at its default, and fog beyond the far plane;
- clouds at zero opacity, with their other values set to tuned defaults;
- smoke on (invisible until the owner pulls the fog in);
- a black sky;
- ground as two near-blacks, because a room with no ground would float in a void.

Since generated rooms store the default speed steps, those steps are fixed points on their curves. Each speed's maximum is therefore derived from its default rather than chosen.
