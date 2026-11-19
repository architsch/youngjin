import * as THREE from "three";
import GameObject from "../../../object/types/gameObject/gameObject";

// A potential occluder being weighed by how much of the target it covers. Represents a whole game
// object, since multi-part objects are hidden as a whole.
export default interface OccluderCandidate
{
    // One piece the candidate was struck on, if a sample's ray struck it. For an instanced mesh, its name is the
    // instancedMeshId.
    mesh: THREE.Mesh | undefined;
    instanceId: number; // -1 if the mesh is not instanced.
    // Only objects can be occluders (see OrbitOccluder).
    gameObject: GameObject;

    // How much of the target this candidate covers, counted in samples of the target's silhouette.
    numSamplesBlocked: number;
    lastSampleIndexBlocked: number; // So one sample passing through two parts still counts once.

    // Reaching into the cone of sight puts it in the way however little of the target it covers.
    inSightCone: boolean;
}
