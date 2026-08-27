import InstancedColorMaterialParams from "../types/instancedColorMaterialParams";
import InstancedEyeMaterialParams from "../types/instancedEyeMaterialParams";
import InstancedTinMaterialParams from "../types/instancedTinMaterialParams";
import InstancedWoodMaterialParams from "../types/instancedWoodMaterialParams";
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
    "InstancedTin": (...options: string[]) => {
        return new InstancedTinMaterialParams();
    },
    "InstancedWood": (...options: string[]) => {
        return new InstancedWoodMaterialParams();
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