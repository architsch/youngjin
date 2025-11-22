import GameObject from "../../object/types/gameObject";
import MaterialParams from "./materialParams";
import MeshInstanceParams from "./meshInstanceParams";

export default interface InstancedMeshConfig
{
    getMaterialParams: (gameObject: GameObject) => MaterialParams;
    geometryId: string;
    totalNumInstances: number;
    getNumInstancesToRent: (gameObject: GameObject) => number;
    getMeshInstanceParams: (gameObject: GameObject, indexInInstanceIdsArray: number) => MeshInstanceParams;
}