import * as THREE from "three";
import GameObject from "../../../object/types/gameObject";

// Something a sweep has found standing in front of what a camera is meant to look at, while it is
// still being weighed up: how much of that target it actually covers is what decides whether it is
// hidden or left where it is. A candidate stands for a whole game object rather than for the one
// piece of geometry a sample happened to strike, since an object drawn out of many parts (a player)
// covers the target with all of them together, and goes out of sight as a whole if it goes at all.
export default interface OccluderCandidate
{
    mesh: THREE.Mesh; // One piece the candidate was struck on. For an instanced mesh, its name is the instancedMeshId.
    instanceId: number; // -1 if the mesh is not instanced.
    gameObject: GameObject | undefined; // Undefined for geometry belonging to no object (a gizmo).

    // How much of the target this candidate covers, counted in samples of the target's silhouette.
    numSamplesBlocked: number;
    lastSampleIndexBlocked: number; // So one sample passing through two parts still counts once.
}
