import * as THREE from "three";
import TextureFilterType from "../../../shared/graphics/material/types/textureFilterType";

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");
const loadedTextures: { [textureId: string]: THREE.Texture } = {};
const loadedRenderTargets: { [renderTargetId: string]: THREE.WebGLRenderTarget } = {};

// ImageBitmaps decode off the main thread; <img> decoding would stall frames during play. Reliability
// cutoffs follow three.js's GLTFLoader (Safari >= 17, Firefox >= 98).
const sourceImageLoader: THREE.ImageBitmapLoader | THREE.ImageLoader = imageBitmapsAreReliable()
    ? new THREE.ImageBitmapLoader().setCrossOrigin("anonymous")
    : new THREE.ImageLoader().setCrossOrigin("anonymous");

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
    // An image to be drawn onto a dynamic texture (see TextureUtil). Set up differently from a static
    // texture, so never load the same path as both.
    loadSourceImageTexture: async (imagePath: string): Promise<THREE.Texture> =>
    {
        const loadedTexture = loadedTextures[imagePath];
        if (loadedTexture != undefined)
            return loadedTexture;

        const newTexture = createSourceTexture(await sourceImageLoader.loadAsync(imagePath));
        loadedTextures[imagePath] = newTexture;
        return newTexture;
    },
    // Like loadSourceImageTexture but for a caller-drawn canvas (sRGB). Not cached; the caller
    // disposes it after drawing.
    createSourceCanvasTexture: (canvas: HTMLCanvasElement): THREE.Texture =>
    {
        const newTexture = createSourceTexture(canvas);
        newTexture.colorSpace = THREE.SRGBColorSpace;
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
    // withAlpha: for partly see-through cells (e.g. text on an object).
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
        // Frees decoded pixels immediately. Safe only because THREE.Cache is off.
        if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap)
            texture.image.close();
        delete loadedTextures[textureId];

        const rt = loadedRenderTargets[textureId];
        if (rt != undefined)
        {
            rt.dispose();
            delete loadedRenderTargets[textureId];
        }
    },
}

// No flipY (costly for <img>/canvas, impossible for ImageBitmap; the drawing quad mirrors its UVs
// instead, see TextureUtil) and no mipmaps (source images are already about the drawn size).
function createSourceTexture(image: ImageBitmap | HTMLImageElement | HTMLCanvasElement): THREE.Texture
{
    const texture = new THREE.Texture(image);
    texture.flipY = false;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
}

function imageBitmapsAreReliable(): boolean
{
    if (typeof createImageBitmap === "undefined" || typeof navigator === "undefined")
        return false;

    const userAgent = navigator.userAgent;
    const isSafari = /^((?!chrome|android).)*safari/i.test(userAgent);
    const safariVersion = parseInt(userAgent.match(/Version\/(\d+)/)?.[1] ?? "-1");
    const isFirefox = userAgent.includes("Firefox");
    const firefoxVersion = parseInt(userAgent.match(/Firefox\/(\d+)\./)?.[1] ?? "-1");
    return !(isSafari && safariVersion < 17) && !(isFirefox && firefoxVersion < 98);
}

export default TextureFactory;