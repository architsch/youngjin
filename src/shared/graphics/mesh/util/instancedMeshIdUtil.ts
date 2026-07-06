const InstancedMeshIdUtil =
{
    // Combines a geometryId and a materialId into a single instancedMeshId.
    // NOTE: The "+" symbol is necessary here in order to let us easily split the instancedMeshId
    // back into its corresponding geometryId and materialId.
    getInstancedMeshId: (geometryId: string, materialId: string): string =>
    {
        return `${geometryId}+${materialId}`;
    },
}

export default InstancedMeshIdUtil;
