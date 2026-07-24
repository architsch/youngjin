import * as THREE from "three";

// One piece of rendered geometry that is being kept out of sight for as long as it stands between
// a camera and what that camera is meant to look at. It is either a whole regular mesh, or a single
// instance of an instanced mesh — a distinction the hiding side cannot ignore, since an instanced
// mesh is drawn as one and every instance in it shares the mesh's visibility.
export default interface HiddenOccluder
{
    mesh: THREE.Mesh; // For an instanced mesh, its name is the instancedMeshId.
    instanceId: number; // -1 if the mesh is not instanced.
}
