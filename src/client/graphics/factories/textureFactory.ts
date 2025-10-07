import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();
const loadedTextures: { [url: string]: THREE.Texture } = {};

const TextureFactory =
{
    load: async (url: string): Promise<THREE.Texture> =>
    {
        const loadedTexture = loadedTextures[url];
        if (loadedTexture != undefined)
            return loadedTexture;
        
        const newTexture = await textureLoader.loadAsync(url);
        newTexture.wrapS = THREE.RepeatWrapping;
        newTexture.wrapT = THREE.RepeatWrapping;
        loadedTextures[url] = newTexture;
        return newTexture;
    },
    unloadAll: (): void =>
    {
        const urlsTemp: string[] = [];
        for (const url of Object.keys(loadedTextures))
            urlsTemp.push(url);
        for (const url of urlsTemp)
            TextureFactory.unload(url);
    },
    unload: (url: string): void =>
    {
        const texture = loadedTextures[url];
        if (texture == undefined)
        {
            console.error(`Texture is already unloaded (url = ${url})`);
            return;
        }
        texture.dispose();
        delete loadedTextures[url];
    },
}

export default TextureFactory;