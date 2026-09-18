import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "./instancedMeshCompositionParams";

// A door's three colors, the only thing that varies between doors (see DoorCompositionConstants).
export default interface DoorCompositionParams extends InstancedMeshCompositionParams
{
    colors: {
        panel: Vec3, // the timber the door is made of
        label: Vec3, // the plate the destination room's name goes on
        knob: Vec3,
    },
}
