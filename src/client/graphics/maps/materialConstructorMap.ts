import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import MaterialParams from "../types/material/materialParams";
import WireframeMaterialParams from "../types/material/wireframeMaterialParams";
import TexturePackMaterialParams from "../types/material/texturePackMaterialParams";
import LineBasicMaterialParams from "../types/material/lineBasicMaterialParams";
import TextureMaterialParams from "../types/material/textureMaterialParams";
import SpriteMaterialParams from "../types/material/spriteMaterialParams";

export const MaterialConstructorMap: { [materialType: string]:
    (params: MaterialParams) => Promise<THREE.Material> } =
{
    "TexturePack": async (params: MaterialParams) =>
    {
        return await createTexturePackMaterial(params as TexturePackMaterialParams);
    },
    "Texture": async (params: MaterialParams) =>
    {
        return await createTextureMaterial(params as TextureMaterialParams);
    },
    "Sprite": async (params: MaterialParams) =>
    {
        const p = params as SpriteMaterialParams;
        const texture = TextureFactory.loadCanvasTexture(p.textureId, p.textureWidth, p.textureHeight, p.draw);
        return new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: p.opacity,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
    },
    "Wireframe": async (params: MaterialParams) =>
    {
        const p = params as WireframeMaterialParams;
        const newMaterial = new THREE.MeshBasicMaterial({ color: p.colorHex, wireframe: true, depthTest: false });
        return newMaterial;
    },
    "LineBasic": async (params: MaterialParams) =>
    {
        const p = params as LineBasicMaterialParams;
        const newMaterial = new THREE.LineBasicMaterial({ color: p.colorHex, depthTest: false });
        return newMaterial;
    },
}

async function createTexturePackMaterial(p: TexturePackMaterialParams): Promise<THREE.Material>
{
    let texture: THREE.Texture;
    switch (p.textureLoadType)
    {
        case "staticImageFromPath":
            texture = await TextureFactory.loadStaticImageTexture(p.texturePath);
            break;
        case "dynamicEmpty":
            texture = TextureFactory.loadDynamicEmptyTexture(p.texturePath, p.textureWidth, p.textureHeight);
            break;
        default:
            throw new Error(`Unknown texture load type :: "${p.textureLoadType}"`);
    }

    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;
    newMaterial.transparent = false;
    if (p.polygonOffsetFactor && p.polygonOffsetUnits)
    {
        newMaterial.polygonOffset = true;
        newMaterial.polygonOffsetFactor = p.polygonOffsetFactor;
        newMaterial.polygonOffsetUnits = p.polygonOffsetUnits;
    }

    const pixelBleedingPreventionScales = [
        (p.textureGridCellWidth - 1) / p.textureGridCellWidth,
        (p.textureGridCellHeight - 1) / p.textureGridCellHeight,
    ];
    const textureGridCellScales = [
        p.textureGridCellWidth / p.textureWidth,
        p.textureGridCellHeight / p.textureHeight,
    ];
    const uvScales = [
        textureGridCellScales[0] * pixelBleedingPreventionScales[0],
        textureGridCellScales[1] * pixelBleedingPreventionScales[1],
    ];

    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec2 uvStart;
            attribute vec2 uvSampleSize;
            ${shader.vertexShader}
        `;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <uv_vertex>",
            `
            #include <uv_vertex>
            vMapUv = uvStart + vec2(
                uvSampleSize[0] * vMapUv[0] * ${uvScales[0].toFixed(7)},
                uvSampleSize[1] * vMapUv[1] * ${uvScales[1].toFixed(7)}
            );
            `
        );
    };
    return newMaterial;
}

async function createTextureMaterial(p: TextureMaterialParams): Promise<THREE.Material>
{
    const texture: THREE.Texture = await TextureFactory.loadStaticImageTexture(p.texturePath);

    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;
    newMaterial.transparent = true;
    newMaterial.alphaTest = 0.5;
    if (p.polygonOffsetFactor && p.polygonOffsetUnits)
    {
        newMaterial.polygonOffset = true;
        newMaterial.polygonOffsetFactor = p.polygonOffsetFactor;
        newMaterial.polygonOffsetUnits = p.polygonOffsetUnits;
    }
    return newMaterial;
}