import Vec3 from "../../../../../math/types/vec3";
import { InstancedMeshCompositionParams } from "./instancedMeshCompositionParams";

// What a door's appearance amounts to. Every door is built to one design (see
// DoorCompositionConstants), so these three colors are the whole of what distinguishes one from
// another — which is also the whole of what a customization form would ever have to offer.
//
// The mouldings have no color of their own: they are cut out of the timber they run around, and are
// seen by their relief rather than by any contrast against it.
export default interface DoorCompositionParams extends InstancedMeshCompositionParams
{
    ids: {
        instancedMeshId_square: string,
    },
    colors: {
        panel: Vec3, // the timber the door is made of
        label: Vec3, // the plate the destination room's name goes on
        knob: Vec3,
    },
}
