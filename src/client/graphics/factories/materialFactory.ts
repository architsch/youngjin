import * as THREE from "three";
import { MaterialConstructorMap } from "../maps/materialConstructorMap";
import MaterialParams from "../types/material/materialParams";

const loadedMaterials: { [materialId: string]: THREE.Material } = {};
const loadedMaterialParams: { [materialId: string]: MaterialParams } = {};

const MaterialFactory =
{
    load: async (materialParams: MaterialParams): Promise<THREE.Material> =>
    {
        const materialId = materialParams.getMaterialId();
        const loadedMaterial = loadedMaterials[materialId];
        if (loadedMaterial != undefined)
            return loadedMaterial;

        const newMaterial = await MaterialConstructorMap[materialParams.type](materialParams);
        loadedMaterials[materialId] = newMaterial;
        loadedMaterialParams[materialId] = materialParams;
        return newMaterial;
    },
    getLoadedMaterialParams: (materialId: string): MaterialParams =>
    {
        const params = loadedMaterialParams[materialId];
        if (params != undefined)
            return params;
        throw new Error(`Loaded material parameters not found (materialId = ${materialId})`);
    },
    unloadAll: (): void =>
    {
        const idsTemp: string[] = [];
        for (const id of Object.keys(loadedMaterials))
            idsTemp.push(id);
        for (const id of idsTemp)
            MaterialFactory.unload(id);
    },
    unload: (materialId: string): void =>
    {
        const material = loadedMaterials[materialId];
        if (material == undefined)
        {
            console.error(`Material is already unloaded (materialId = ${materialId})`);
            return;
        }
        material.dispose();
        delete loadedMaterials[materialId];
        delete loadedMaterialParams[materialId];
    },
}

export default MaterialFactory;