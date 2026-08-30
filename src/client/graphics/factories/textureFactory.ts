import * as THREE from "three";
import TextureFilterType from "../../../shared/graphics/material/types/textureFilterType";

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");
const loadedTextures: { [textureId: string]: THREE.Texture } = {};
const loadedRenderTargets: { [renderTargetId: string]: THREE.WebGLRenderTarget } = {};

const TextureFactory =
{
    // A fixed texture that is based on an image asset (cannot be modified during runtime).
    loadStaticImageTexture: async (texturePath: string): Promise<THREE.Texture> =>
    {
        const loadedTexture = loadedTextures[texturePath];
        if (loadedTexture != undefined)
            return loadedTexture;
        
        const newTexture = await textureLoader.loadAsync(texturePath);
        loadedTextures[texturePath] = newTexture;
        return newTexture;
    },
    // A texture whose image is drawn onto a 2D canvas at load time (e.g. a procedurally
    // generated sprite). Cached by textureId, and disposed via unload/unloadAll like any other.
    loadCanvasTexture: (textureId: string, width: number, height: number,
        draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void): THREE.Texture =>
    {
        const loadedTexture = loadedTextures[textureId];
        if (loadedTexture != undefined)
            return loadedTexture;

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx == null)
            throw new Error(`Failed to acquire a 2D canvas context (textureId = ${textureId})`);
        draw(ctx, width, height);

        const newTexture = new THREE.CanvasTexture(canvas);
        newTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTextures[textureId] = newTexture;
        return newTexture;
    },
    // An empty texture upon which images can be freely rendered during runtime.
    //
    // "withAlpha" is for a texture whose drawn-on cells are meant to be partly see-through — text
    // written straight onto an object, where everything around the lettering has to show what is
    // behind it. A texture that only ever holds pictures does not need the extra channel.
    //
    // "filterType" is a separate question from that one (see TextureFilterType): what a texture
    // holds decides how it should be sampled, and a see-through texture of pictures would still
    // want its cells kept crisp.
    loadDynamicEmptyTexture: (textureId: string, width: number, height: number,
        withAlpha: boolean = false, filterType: TextureFilterType = "nearest"): THREE.Texture =>
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

        const filter = (filterType == "linear") ? THREE.LinearFilter : THREE.NearestFilter;
        const rt = new THREE.WebGLRenderTarget(width, height, {
            format: withAlpha ? THREE.RGBAFormat : THREE.RGBFormat,
            magFilter: filter,
            minFilter: filter,
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