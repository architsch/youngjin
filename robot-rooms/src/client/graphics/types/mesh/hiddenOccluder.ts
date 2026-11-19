import * as THREE from "three";

// Geometry hidden while it blocks the orbit camera's target: a whole mesh, or one instance of an
// instanced mesh (instances share their mesh's visibility, so they are hidden differently).
export default interface HiddenOccluder
{
    mesh: THREE.Mesh; // For an instanced mesh, its name is the instancedMeshId.
    instanceId: number; // -1 if the mesh is not instanced.
}
