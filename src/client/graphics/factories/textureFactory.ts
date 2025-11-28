import * as THREE from "three";

const textureLoader = new THREE.TextureLoader();
const loadedTextures: { [textureId: string]: THREE.Texture } = {};
const loadedRenderTargets: { [renderTargetId: string]: THREE.WebGLRenderTarget } = {};

const TextureFactory =
{
    loadStaticImageTexture: async (url: string): Promise<THREE.Texture> =>
    {
        const loadedTexture = loadedTextures[url];
        if (loadedTexture != undefined)
            return loadedTexture;
        
        const newTexture = await textureLoader.loadAsync(url);
        loadedTextures[url] = newTexture;
        return newTexture;
    },
    loadDynamicEmptyTexture: (textureId: string, width: number, height: number): THREE.Texture =>
    {
        const loadedTexture = loadedTextures[textureId];
        if (loadedTexture != undefined)
        {
            if (loadedTexture.width != width || loadedTexture.height != height)
                throw new Error(`You are trying to load two different textures with the same ID but different sizes (textureId: ${textureId}, original size: (${width}, ${height}), new size: (${loadedTexture.width}, ${loadedTexture.height}))`);
            return loadedTexture;
        }

        if (loadedRenderTargets[textureId] != undefined)
            throw new Error(`RenderTarget with the same textureId already exists (textureId: ${textureId})`);

        const rt = new THREE.WebGLRenderTarget(width, height, {
            format: THREE.RGBFormat,
            magFilter: THREE.NearestFilter,
            minFilter: THREE.NearestFilter,
        });
        loadedRenderTargets[textureId] = rt;

        const newTexture = rt.texture;
        loadedTextures[textureId] = newTexture;
        return newTexture;
    },
    unloadAll: (): void =>
    {
        const idsTemp: string[] = [];
        for (const id of Object.keys(loadedTextures))
            idsTemp.push(id);
        for (const id of idsTemp)
            TextureFactory.unload(id);
    },
    unload: (textureId: string): void =>
    {
        const texture = loadedTextures[textureId];
        if (texture == undefined)
        {
            console.error(`Texture is already unloaded (textureId = ${textureId})`);
            return;
        }
        texture.dispose();
        delete loadedTextures[textureId];

        const rt = loadedRenderTargets[textureId];
        if (rt != undefined)
        {
            rt.dispose();
            delete loadedRenderTargets[textureId];
        }
    },
}

export default TextureFactory;