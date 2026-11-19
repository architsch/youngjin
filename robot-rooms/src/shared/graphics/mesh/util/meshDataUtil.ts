const MeshDataUtil =
{
    // "+" separates the ids so they can be split back apart.
    getInstancedMeshId: (geometryId: string, materialId: string): string =>
    {
        return `${geometryId}+${materialId}`;
    },
}

export default MeshDataUtil;
