import * as THREE from "three";

// A run of a room's layers that a room preview draws apart from the rest (see RoomPreviewUtil): a storey, or the
// whole room where it has no upper floor.
export default interface RoomPreviewLevel
{
    // The layers whose blocks it holds. The room's own floor is a block of the layer under the lowest, and its
    // ceiling one of the layer over the highest (see VoxelQueryUtil.getVoxelBlockCollisionLayerFromQuadIndex).
    layerMin: number;
    layerMax: number;

    // What draws it, laid out as it lies in the room, and the box that holds; the group is then put in its place.
    group: THREE.Object3D;
    bounds: THREE.Box3;
}
