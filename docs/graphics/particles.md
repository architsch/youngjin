# Particles and Animated Sprites

Reference: @src/client/graphics/particle/particleSystem.ts , @src/client/graphics/particle/types/particleBatch.ts , @src/client/graphics/shaders/particleShader.ts , @src/client/graphics/shaders/waveformGLSL.ts , @src/shared/math/util/waveformUtil.ts , @src/client/graphics/particle/maps/particleEffects.json , @src/client/graphics/particle/util/particleEffectConfigUtil.ts , @src/client/graphics/particle/maps/spriteConfigMap.ts , @src/client/graphics/particle/util/particleTriggerUtil.ts , @src/client/object/components/animatedSprite.ts , @src/client/object/components/particleEmitter.ts , @dev/scripts/particleEffectEditor/server.js

`ParticleSystem` draws transient particles (puffs, sparks, wind) and persistent animated sprites (a fan's blades, a flame). They are only visuals: nothing in gameplay reads them.

## Stateless on the GPU
- The CPU writes a particle's starting state once. The vertex shader computes everything after its birth from the clock: closed-form motion under gravity and drag, curves over its life, turbulence from the shared noise. CPU cost follows what spawns, not what is alive.
- A sprite's animation (spin, flipbook) runs at a rate given as a `Waveform`, a level that repeats over time. The shader evaluates the level and its closed-form integral, so a speed that swells or pulses costs nothing per frame. `WaveformUtil` and `waveformGLSL` hold the same formulas and must stay in step.
- A new rate rebases the sprite's phase where it stands, so it never jumps. Never compute a phase as time × rate.
- The clock is rebased now and then (every stored time and waveform phase shifted together), so float precision holds through a long session. It restarts with each room.

## Batches
- There are two batches, one per render state (`ParticleRenderState`). Each is one draw call however much is alive, and none when nothing is.
  - **Blended**: translucent air (smoke, dust, sparks, wind, glows). Premultiplied with a per-layer additiveness, not depth-writing, drawn after labels. Unlit, or tinted by the lamp field per vertex when a layer is lit.
  - **Solid**: cut-out surfaces (a fan's blades) that write depth and are lit like any surface, with smooth alpha-to-coverage edges.
- A batch's instance buffer holds persistent sprite slots, then a ring of transient particles.
  - The ring's head wraps, so a full ring overwrites its oldest particles rather than growing. DebugStats counts the overwrites.
  - A frame's spawns upload as at most two ranges.
- **Meshes**: both come from `MeshFactory` and stay in the persistent scene, so the load-time shader precompile covers them. They are never frustum-culled and never raycast.
- **Atlas**: the sprites are drawn procedurally at load, so nothing is downloaded. The atlas is uploaded premultiplied, so mipmaps don't darken edges.
- **Definitions**: effects and sprites are baked once into a parameter texture. A new effect or sprite is data, needing no shader change and no extra draw call.
  - Effects live in `particleEffects.json`, written by the particle effect editor (`npm run particleEffectEditor`). The editor plays each effect as it changes, through the game's own particle system and shader.
  - JSON is never type-checked, so `ParticleEffectConfigUtil` checks every effect, both in the particle test and in the editor. Code plays an effect by its name, so renaming one breaks whatever still names it.

## Triggers
- **Gameplay events**: gameplay never calls the particle system. It publishes what happened (`voxelBlockEditObservable`, `objectEditObservable`).
  - These fire only for edits: local, remote or rolled back, never for a room loading or unloading.
  - `ParticleTriggerUtil` is the one table of which event plays which effect. Sound can listen to the same events.
- **Object components**: effects that belong to an object are the `AnimatedSprite` and `ParticleEmitter` components.
  - A type config gives each a baseline descriptor, plus an optional override derived from the object's own metadata (`getOverride`). The components read no metadata key themselves.
  - An emitter may end its stream at the first block in front of it. The distance is re-measured whenever the room's shape changes (`roomShapeChangedObservable`).
- **Scripted steps** play effects through the `play_vfx` single-player action.
- **Debug commands** (`vfx`, `sprite`) show any effect or sprite on the selected face.

## Traps
- Emitters spawn only while in view. One that comes back into view refills its stream at once. While adaptive resolution sits at its floor, emitters spawn fewer particles.
- The ring is not depth-sorted, so keep blended particles soft, faint or additive.
- Additive light fades to nothing in fog, not to the fog's color.
- A spin too fast for the frame rate seems to stall or run backwards, so keep displayed spin modest.
