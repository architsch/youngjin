import InstancedColorMaterialParams from "../types/instancedColorMaterialParams";
import InstancedEyeMaterialParams from "../types/instancedEyeMaterialParams";
import MaterialParams from "../types/materialParams";

const materialParamsConstructorByType: {[materialType: string]:
    (...options: string[]) => MaterialParams} =
{
    "InstancedColor": (...options: string[]) => {
        return new InstancedColorMaterialParams();
    },
    "InstancedEye": (...options: string[]) => {
        return new InstancedEyeMaterialParams();
    },
}
const cachedMaterialParamsById: {[materialId: string]: MaterialParams} = {};

const MaterialParamsMap =
{
    getParamsById: (materialId: string): MaterialParams =>
    {
        const cachedMaterialParams = cachedMaterialParamsById[materialId];
        if (cachedMaterialParams != undefined)
            return cachedMaterialParams;

        const factors = materialId.split("*");
        const materialType = factors[0];
        factors.shift();
        const newMaterialParams = materialParamsConstructorByType[materialType](...factors);
        cachedMaterialParamsById[materialId] = newMaterialParams;
        return newMaterialParams;
    },
}

export default MaterialParamsMap;