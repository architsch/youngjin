import MeshDataUtil from "../util/meshDataUtil";

// Interned mesh ids, keyed by geometry then material. Parts name their geometry and material
// separately, but instances are pooled per mesh, so the refresh loop of every moving object would
// otherwise rebuild the same handful of strings each frame.
const idsByGeometryId: {[geometryId: string]: {[materialId: string]: string}} = {};

const InstancedMeshIdMap =
{
    getInstancedMeshId: (geometryId: string, materialId: string): string =>
    {
        const idsByMaterialId = idsByGeometryId[geometryId] ??= {};
        return idsByMaterialId[materialId] ??= MeshDataUtil.getInstancedMeshId(geometryId, materialId);
    },
}

export default InstancedMeshIdMap;
