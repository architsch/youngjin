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
- It supplies only the light the room is not already providing. Each frame, the room light **near** where it stands is read (`LightBlockDilationUtil`: nearby brightness discounted by distance, spread only through open blocks). The head lamp then dims along a saturating curve and tints toward the room light's color. Reading nearby light rather than the light at that one point keeps the head lamp from flattening a lamp's pool when the player views it from outside.
- It cannot be removed: generated rooms have no lamps, and a player who cannot see cannot place the first one.
- Its reach never changes with the camera. It and the fog are instead measured from a point at most a fixed distance in front of the camera (`GraphicsManager`), so a pulled-back orbit shows the room lit as it is around its subject (see [camera_control.md](camera_control.md)).

## Atmosphere settings (`RoomPrefs`)
- Every setting is a small integer step, encoded by `RoomPrefsUtil` into a short string on `Room`, so the atmosphere travels with the room. Colors are palette indices, and each step maps through a curve suited to its quantity.
- **Light**: ambient color and strength; head-lamp color, power and range. A lamp has intensity and range. Range covers both reach and falloff, since they cannot sensibly vary independently. Ambient and head-lamp strengths run past normal lighting into deliberate overexposure.
- **Light palette**: every entry is full brightness (hue and tint only), because strength is a separate setting.
- **Fog**: color plus start and end distances. **Smoke**: strength, scale, speed, drift and rise. **Sky**: color. **Clouds**: color, opacity, scale, softness, speed. **Ground**: low and peak colors, scale, solidity, softness.
- Fog and sky colors come from the "Fog" palette. Clouds and ground use the full-range "Scenery" palette, so they can contrast with the air.
- Unconfigured (missing) values decode to defaults.
- **Concurrent edits**: saves are deferred briefly. While a local edit is pending, lighting updates from the server are ignored, so the last writer wins without flicker.
- One setting in `RoomPrefs` is not atmosphere: a hub's join priority rides along in the same string, since it is a small integer stored on the room like the rest ([room_population.md](../networking/room_population.md)).

## Air, sky and ground (`atmosphereGLSL`, `skyShader`)
- **Fog and smoke** are read by **world position**, so smoke is a 3D volume inside the room. Smoke changes fog *coverage*; lamps change its *color*. Smoke has no hard edge, and its shearing field moves more slowly than the smoke itself, so the smoke deforms rather than scrolls.
- **Lamps tint the air around them**, from one block map sample at the **far end** of the fogged stretch — the air in front of whatever is being looked at. Sampling the middle of the stretch instead lands in dark air short of the lamp (a fragment is only fogged at all once it is distant), so no glow appears around it, and it makes the fog over a point depend on where the player stands rather than on the air there.
- The tint saturates through **one shared denominator**, so only its magnitude is compressed and the lamp's hue passes through. Two traps here: a per-channel curve compresses the brightest channel first and washes a strong lamp white, and normalizing by the brightest channel pins every sample to full saturation however faint it is — which makes lamps of different colors meet at a hard border instead of blending.
- The lamp's color **rides on top of** the fog's, so neither takes the other over: the fog color stays the floor of every channel, and a lamp only ever adds, as it only ever adds to a surface. The two failures either side of this are worth knowing: adding lamp light in *linear* space buries the fog color, whose linear value is far smaller than a lamp's, while *scaling* the fog color leaves its hue permanently in charge, so a green lamp in slate air can only come out slate-green.
- A room with no lamps keeps exactly the color its owner picked, and one with no lamps at all skips the sample on a whole-frame branch.
- The **sky** is read by **view direction**. It is a full-screen quad drawn **last** among opaque objects, depth-tested at the far plane, so pixels already covered by walls are skipped. It writes no depth.
- **No seam at the room's edge**: the sky is fogged by the room's air along the view ray, measured as view depth up to the room's walls and clamped to the far plane, thinned by the smoke where the ray exits the room, and tinted by the lamp light at that exit point — the far end of its stretch, as a surface's fog is tinted at its own. So a doorway shows the same fog as the wall beside it.
- **Clouds**: a domain-warped noise field cut at a threshold. The cut width (softness) never drops below one pixel's change. Clouds fade out below the horizon.
- **Ground**: drawn only by the sky, as ridged noise on a plane under the eye. It fades into the air toward the horizon and is fully air at the horizon itself, which avoids a seam. Solidity slows that fade without stopping it. The visible distance is fixed.
- **Speeds** accumulate into running offsets wrapped at the noise period. Computing offsets from time × speed would make the field jump whenever the speed changes.
- All atmosphere values are **uniforms**. Shader defines would recompile materials on every slider change. For the same reason, fog is never removed: "no fog" means distances beyond the far plane.
- A single shared value-noise texture feeds these effects (see [materials_and_shaders.md](materials_and_shaders.md)).

## Lamps
- A lamp is a wall-attached object (see [wall_attached_object.md](../geometry/wall_attached_object.md)). Anyone may edit lamps, subject to restricted zones, and every kind of lamp shares one capped count per room (see [object_update.md](../networking/object_update.md)).
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
