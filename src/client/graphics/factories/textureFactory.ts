import * as THREE from "three";
import App from "../../app";

const textureLoader = new THREE.TextureLoader();
const loadedTextures: { [textureId: string]: THREE.Texture } = {};

const TextureFactory =
{
    load: async (textureId: string): Promise<THREE.Texture> =>
    {
        const loadedTexture = loadedTextures[textureId];
        if (loadedTexture != undefined)
            return loadedTexture;
        
        const newTexture = await textureLoader.loadAsync(getTextureURL(textureId));
        newTexture.wrapS = THREE.RepeatWrapping;
        newTexture.wrapT = THREE.RepeatWrapping;
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
    },
}

function getTextureURL(textureId: string): string
{
    const textureRelativeURL = textureRelativeURLMap[textureId];
    if (textureRelativeURL == undefined)
        throw new Error(`Texture's relative URL not found (textureId = ${textureId})`);
    return `${App.getEnv().assets_url}/${textureRelativeURL}`;
}

const textureRelativeURLMap: { [textureId: string]: string } =
{
    // Floor
    "a": "TexturePack1/128x128/Tile/Tile_02-128x128.png",
    "b": "TexturePack1/128x128/Tile/Tile_03-128x128.png",
    "c": "TexturePack1/128x128/Tile/Tile_07-128x128.png",
    "d": "TexturePack1/128x128/Tile/Tile_12-128x128.png",
    "e": "TexturePack1/128x128/Tile/Tile_19-128x128.png",
    "f": "TexturePack1/128x128/Tile/Tile_21-128x128.png",
    "g": "TexturePack1/128x128/Wood/Wood_06-128x128.png",
    "h": "TexturePack1/128x128/Wood/Wood_10-128x128.png",
    "i": "TexturePack1/128x128/Wood/Wood_17-128x128.png",
    "j": "TexturePack1/128x128/Wood/Wood_24-128x128.png",
    "k": "TexturePack2/128x128/Dirt/Dirt_02-128x128.png",
    "l": "TexturePack2/128x128/Dirt/Dirt_06-128x128.png",
    "m": "TexturePack2/128x128/Dirt/Dirt_18-128x128.png",
    "n": "TexturePack2/128x128/Metal/Metal_08-128x128.png",
    "o": "TexturePack2/128x128/Tile/Tile_03-128x128.png",
    "p": "TexturePack2/128x128/Tile/Tile_17-128x128.png",
    "q": "TexturePack3/128x128/Animal/Animal_13-128x128.png",
    "r": "TexturePack3/128x128/Cloth/Cloth_17-128x128.png",
    "s": "TexturePack3/128x128/Grating/Grating_09-128x128.png",
    "t": "TexturePack3/128x128/Weave/Weave_06-128x128.png",
    "u": "TexturePack3/128x128/Weave/Weave_09-128x128.png",
    "v": "TexturePack3/128x128/Weave/Weave_13-128x128.png",
    "w": "TexturePack3/128x128/Weave/Weave_16-128x128.png",
    "x": "TexturePack3/128x128/Stone/Stone_01-128x128.png",
    "y": "TexturePack3/128x128/Stone/Stone_14-128x128.png",
    "z": "TexturePack1/128x128/Tile/Tile_20-128x128.png",
    // Wall
    "A": "TexturePack1/128x128/Bricks/Bricks_01-128x128.png",
    "B": "TexturePack1/128x128/Bricks/Bricks_02-128x128.png",
    "C": "TexturePack1/128x128/Bricks/Bricks_05-128x128.png",
    "D": "TexturePack1/128x128/Bricks/Bricks_11-128x128.png",
    "E": "TexturePack1/128x128/Bricks/Bricks_16-128x128.png",
    "F": "TexturePack1/128x128/Bricks/Bricks_17-128x128.png",
    "G": "TexturePack1/128x128/Bricks/Bricks_22-128x128.png",
    "H": "TexturePack1/128x128/Bricks/Bricks_23-128x128.png",
    "I": "TexturePack1/128x128/Wood/Wood_09-128x128.png",
    "J": "TexturePack1/128x128/Wood/Wood_11-128x128.png",
    "K": "TexturePack1/128x128/Wood/Wood_15-128x128.png",
    "L": "TexturePack1/128x128/Wood/Wood_16-128x128.png",
    "M": "TexturePack1/128x128/Wood/Wood_18-128x128.png",
    "N": "TexturePack1/128x128/Wood/Wood_25-128x128.png",
    "O": "TexturePack2/128x128/Brick/Brick_01-128x128.png",
    "P": "TexturePack2/128x128/Brick/Brick_03-128x128.png",
    "Q": "TexturePack2/128x128/Dirt/Dirt_05-128x128.png",
    "R": "TexturePack2/128x128/Dirt/Dirt_07-128x128.png",
    "S": "TexturePack2/128x128/Dirt/Dirt_13-128x128.png",
    "T": "TexturePack2/128x128/Elements/Elements_11-128x128.png",
    "U": "TexturePack2/128x128/Stone/Stone_17-128x128.png",
    "V": "TexturePack3/128x128/Stone/Stone_15-128x128.png",
    "W": "TexturePack2/128x128/Wood/Wood_13-128x128.png",
    "X": "TexturePack2/128x128/Wood/Wood_19-128x128.png",
    "Y": "TexturePack2/128x128/Wood/Wood_11-128x128.png",
    "Z": "TexturePack2/128x128/Tile/Tile_14-128x128.png",
}

export default TextureFactory;