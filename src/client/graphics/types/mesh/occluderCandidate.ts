import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";

// A potential occluder being weighed by how much of the target it covers. Represents a whole game
// object, since multi-part objects are hidden as a whole.
export default interface OccluderCandidate
{
    mesh: THREE.Mesh; // One piece the candidate was struck on. For an instanced mesh, its name is the instancedMeshId.
    instanceId: number; // -1 if the mesh is not instanced.
    // Only objects can be occluders (see OrbitOccluder).
    gameObject: GameObject;

    // How much of the target this candidate covers, counted in samples of the target's silhouette.
    numSamplesBlocked: number;
    lastSampleIndexBlocked: number; // So one sample passing through two parts still counts once.
}
