import { ObjectMetadata } from "./objectMetadata";
import Vec3 from "../../math/types/vec3";

// A type whose objects push whatever physics moves in the stream in front of their face (see PhysicsForceUtil),
// each as its own metadata sets it.
export type ObjectForceConfig = {
    // How hard the stream pushes at the face, blowing the given way (the face's outward normal, along one of the
    // world's axes): the speed it adds in a second, in world units per second.
    getAcceleration: (metadata: ObjectMetadata, direction: Vec3) => number,
    // How far the stream reaches from the face, in world units. The push thins out to nothing along it.
    getRange: (metadata: ObjectMetadata) => number,
};
