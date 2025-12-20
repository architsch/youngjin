import MaterialParams from "./material/materialParams";

export default interface InstancedMeshConfig
{
    getMaterialParams: () => MaterialParams;
    geometryId: string;
    maxNumInstances: number;
}