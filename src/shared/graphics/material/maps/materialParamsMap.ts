import InstancedColorMaterialParams from "../types/instancedColorMaterialParams";
import InstancedEmissiveMaterialParams from "../types/instancedEmissiveMaterialParams";
import InstancedTinMaterialParams from "../types/instancedTinMaterialParams";
import InstancedWoodMaterialParams from "../types/instancedWoodMaterialParams";
import MaterialParams from "../types/materialParams";

const materialParamsConstructorByType: {[materialType: string]:
    (...options: string[]) => MaterialParams} =
{
    "InstancedColor": (...options: string[]) => {
        return new InstancedColorMaterialParams();
    },
    "InstancedTin": (...options: string[]) => {
        return new InstancedTinMaterialParams();
    },
    "InstancedWood": (...options: string[]) => {
        return new InstancedWoodMaterialParams();
    },
    "InstancedEmissive": (...options: string[]) => {
        return new InstancedEmissiveMaterialParams();
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