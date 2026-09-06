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

        // What tells three.js that two of our materials are not interchangeable.
        //
        // Three.js caches compiled programs globally, keyed by the material's *parameters* — its
        // type, its maps, its lights, its flags. Everything our lit materials do to look different
        // from one another they do in onBeforeCompile, which runs long after that key is worked out
        // and does not enter it. So the tin, the wood and the flat instanced color are all "a
        // MeshPhongMaterial with no map" as far as the key is concerned: whichever of them happened
        // to be drawn first compiled its shader, and the others silently rendered with it — a wooden
        // door coming out as rusted tin.
        //
        // The material id is exactly the right key, being the same thing this factory caches on: one
        // id, one material, one shader.
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