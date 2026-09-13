import * as THREE from "three";
import TextureFilterType from "../../../shared/graphics/material/types/textureFilterType";

const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");
const loadedTextures: { [textureId: string]: THREE.Texture } = {};
const loadedRenderTargets: { [renderTargetId: string]: THREE.WebGLRenderTarget } = {};

// What the images drawn onto dynamic textures are fetched through (see loadSourceImageTexture).
//
// An ImageBitmap wherever the browser's createImageBitmap can be relied on, because the browser decodes
// one on a background thread before handing it over. An <img> is decoded on the main thread instead,
// at the moment it is first uploaded — which, for a room's pictures, is a moment the room is already
// being played in, so the decoding stalls frames the player sees.
//
// "Relied on" is the line three.js's own GLTFLoader draws: not Safari before 17, and not Firefox
// before 98. Those decode through an <img> as before, and so does every iOS browser other than Safari,
// since none of them reports a Safari version to be judged by.
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
    // An image asset that is fetched in order to be drawn onto a dynamic texture (see TextureUtil)
    // rather than to be rendered with directly. Cached by its path, and disposed via unload/unloadAll,
    // like a static image texture — but it is set up differently from one (see createSourceTexture),
    // so the same path is never to be loaded as both.
    loadSourceImageTexture: async (imagePath: string): Promise<THREE.Texture> =>
    {
        const loadedTexture = loadedTextures[imagePath];
        if (loadedTexture != undefined)
            return loadedTexture;

        const newTexture = createSourceTexture(await sourceImageLoader.loadAsync(imagePath));
        loadedTextures[imagePath] = newTexture;
        return newTexture;
    },
    // A 2D canvas the caller has drawn into, set up to be drawn onto a dynamic texture exactly the way
    // an image asset is (see loadSourceImageTexture). Not cached, since a canvas is drawn once and then
    // thrown away: the caller disposes of the texture as soon as it has been drawn.
    //
    // Unlike an image asset's, the canvas's colors are marked as sRGB, as are those of every canvas
    // texture (see loadCanvasTexture): the canvas was painted in CSS colors.
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
        // An ImageBitmap keeps its decoded pixels until it is closed, however long it then waits to
        // be collected. Closing it is safe only because nothing else holds on to it: three.js's own
        // loader cache (THREE.Cache) is left off, and would hand a closed bitmap to the next load.
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

// How every texture that is drawn onto a dynamic texture is set up, whatever its image came from.
//
// **Uploaded the right way up**, where three.js otherwise flips an image as it uploads it. For an <img>
// or a canvas that flip can be a pass over every pixel on the main thread, and an ImageBitmap cannot be
// flipped at upload at all. So the flip is left to the moment the texture is drawn, where the quad
// drawing it makes it by mirroring its texture coordinates, which costs nothing (see TextureUtil).
//
// **Without mipmaps.** A picture drawn onto a dynamic texture is already about the size it is drawn at
// — a label's canvas is made at the size of its cell, a picture frame is one cell of an atlas drawn onto
// a cell of the same size, and a canvas's image is fetched as a thumbnail no larger than its cell (see
// ImageMap) — so there is never enough shrinking to be done to be worth computing them.
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