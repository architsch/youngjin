import * as THREE from "three";
import TextureFactory from "./textureFactory";

const loadedMaterials: { [textureURL: string]: THREE.Material } = {};

const MaterialFactory =
{
    load: async (textureURL: string): Promise<THREE.Material> =>
    {
        const loadedMaterial = loadedMaterials[textureURL];
        if (loadedMaterial != undefined)
            return loadedMaterial;

        const texture = await TextureFactory.load(textureURL);
        const newMaterial = new THREE.MeshPhongMaterial();
        newMaterial.map = texture;

        loadedMaterials[textureURL] = newMaterial;
        return newMaterial;
    },
    unloadAll: (): void =>
    {
        const urlsTemp: string[] = [];
        for (const url of Object.keys(loadedMaterials))
            urlsTemp.push(url);
        for (const url of urlsTemp)
            MaterialFactory.unload(url);
    },
    unload: (textureURL: string): void =>
    {
        const material = loadedMaterials[textureURL];
        if (material == undefined)
        {
            console.error(`Material is already unloaded (textureURL = ${textureURL})`);
            return;
        }
        material.dispose();
        delete loadedMaterials[textureURL];
    },
}

export default MaterialFactory;