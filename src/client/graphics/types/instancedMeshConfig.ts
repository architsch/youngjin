import GameObject from "../../object/types/gameObject";
import MaterialParams from "./material/materialParams";
import MeshInstanceParams from "./meshInstanceParams";

export default interface InstancedMeshConfig
{
    getMaterialParams: (gameObject: GameObject) => MaterialParams;
    geometryId: string;
    totalNumInstances: number;
    getNumInstancesToRent: (gameObject: GameObject) => number;
    getMeshInstanceParams: (gameObject: GameObject, instanceId: number, indexInInstanceIdsArray: number) => MeshInstanceParams;
}