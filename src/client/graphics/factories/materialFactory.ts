import * as THREE from "three";
import { MaterialConstructorMap } from "../maps/materialConstructorMap";
import MaterialParams from "../../../shared/graphics/material/types/materialParams";

// Whenever you are implementing a new type of material, you must:
//      (1) Create a new subclass of MaterialParams.
//      (2) Add an entry to MaterialConstructorMap.
//      (3) Add an entry to MaterialParamsMap (IF you ever need to look up the material's MaterialParams by materialId).
//      (4) If the material needs to be referenced via an encoded
//          numerical value (aka "materialCode"), add the corresponding constants/entries
//          in "sharedConstants.ts" file.

const loadedMaterials: { [materialId: string]: THREE.Material } = {};

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
        return newMaterial;
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
    },
}

export default MaterialFactory;