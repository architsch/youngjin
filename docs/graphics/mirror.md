# Mirror

Reference: @src/shared/object/types/objectTypeConfig/mirrorObjectTypeConfig.ts , @src/client/object/types/gameObject/mirrorGameObject.ts , @src/client/graphics/util/mirrorReflectionUtil.ts , @src/client/graphics/util/mirrorProjectionUtil.ts , @src/client/graphics/util/mirrorMaterialUtil.ts , @src/client/graphics/shaders/mirrorShader.ts

A mirror is an attached object (see [object_attachment.md](../geometry/object_attachment.md)) whose glass shows the room reflected. It is framed like a canvas, from its own copies of the canvas's looks (see [instanced_mesh_composition.md](instanced_mesh_composition.md)), and sized like one, up to twice as large each way. Its surface (`MirrorProperties`) is a color from a palette of its own, laid over the reflection as opaquely as it is set to: not at all for a plain mirror, wholly for a colored panel. Only an admin lays, moves, resizes, reframes or recolors one (see [admin.md](../gameplay/admin.md)), and a room holds one at most, so one reflection is drawn a frame.

## The reflection
- Each frame the glass is on screen, the room is drawn once more before it is drawn for the screen: through the camera reflected in the glass's plane, its view turned left for right, into one render target that the glass reads by a projective lookup (`MirrorReflectionUtil`, `mirrorShader`).
- Only what the glass covers is drawn: the reflected camera's view is narrowed to the glass's extent on screen, and the part of the target drawn is sized to it, a texel to a pixel up to the target's size. So the target is small and fixed, and the cost follows the screen's adaptive resolution.
- Its near plane lies on the glass (an oblique near plane), so nothing behind the glass, the wall it hangs on included, is drawn.
- The head light lights the reflection from nearer the glass, so the side of the viewer the glass shows isn't left dark by a light above their head. It is back on its mount for the screen, so nothing seen directly changes.
- The reflected camera is as far from what it sees as the light's whole path, so the reflection is fogged as the room is. The surface over it is lit (lamps, head light) and fogged as any surface is, and mixed over the reflection only after its own fog, so the reflection is never fogged twice. A wholly opaque surface hides the reflection, which is then not drawn.
- What a mirror shows is a three.js layer (`MIRRORED_LAYER`): the room's meshes (`MeshFactory`), the sky and the lights. Gizmos and outlines are the camera's alone, and the glass is left out of its own reflection.
- What is hidden from the camera alone, the body it is inside in first person or someone too close to it, shows in the reflection (`InstancedMeshComposer`, `reflectionDrawingObservable`). A ghost is hidden from everyone, mirrors included.
- The body the camera is inside shows where the view has it: as far off its place as the camera trails what physics does to it (a step, a drop, a fan's wind; see [camera_control.md](camera_control.md)), so that it moves with the view rather than ahead of it.
- Particles spawn where the reflection last looked, as well as where the camera looks (see [particles.md](particles.md)).

## Traps
- Drawing into a render target takes other shader programs (linear output), so every material compiles twice: behind the loading screen for a room that has a mirror (see [materials_and_shaders.md](materials_and_shaders.md#precompiling)), or in the background for a mirror added later, its glass a plain color until then.
- Anything a mirror should show must be on the mirrored layer, lights too: a light left off it also changes the programs.
- The sky reads its camera's projection from a uniform rather than from three.js, so the reflection points it at the reflected camera and back (`AtmosphereMaterialUtil`).
