import InstancedMeshCompositionBuilder from "../types/compositionBuilder/instancedMeshCompositionBuilder";
import { InstancedMeshCompositionParams } from "../types/compositionParams/instancedMeshCompositionParams";
import InstancedMeshCompositionPart from "../types/instancedMeshCompositionPart";

export const InstancedMeshCompositionBuilderMap: {[builderType: string]:
    (params: InstancedMeshCompositionParams, parts: InstancedMeshCompositionPart[])
        => InstancedMeshCompositionBuilder} = {};