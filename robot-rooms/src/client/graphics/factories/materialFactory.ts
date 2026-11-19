import * as THREE from "three";
import { MaterialConstructorMap } from "../maps/materialConstructorMap";
import MaterialParams from "../../../shared/graphics/material/types/materialParams";

// A new material type needs: a MaterialParams subclass, a MaterialConstructorMap entry, a
// MaterialParamsMap entry (only if looked up by materialId), and sharedConstants entries (only if
// referenced by an encoded materialCode).

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

        // three.js keys its program cache on material parameters, which onBeforeCompile splices don't
        // affect, so different surfaces would otherwise share whichever shader compiled first.
        newMaterial.customProgramCacheKey = () => materialId;

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