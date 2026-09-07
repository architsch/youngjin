import Vec3 from "../../../../shared/math/types/vec3";

// One thing in the room that gives off light, reduced to what propagation actually needs. This is
// not a THREE.PointLight and never becomes one: the scene keeps exactly one real light (the lamp the
// camera carries), because three.js compiles the number of lights into every shader, so installing a
// second one would recompile every material in the room. See LightBlockMap.
export default interface LightSource
{
    worldPos: Vec3;

    // Linear-space RGB, already multiplied by the light's intensity. Kept as three named numbers
    // rather than a color object so that the propagation loop never allocates.
    colorR: number;
    colorG: number;
    colorB: number;

    // How far the light carries, in world units, and how sharply it falls off on the way. The same
    // meaning THREE.PointLight gives its own "distance" and "decay", so that a light in the block map
    // and the camera's real one are tuned in the same units.
    range: number;
    decay: number;
}
