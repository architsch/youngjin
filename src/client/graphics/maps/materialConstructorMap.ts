import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import MaterialParams from "../types/material/materialParams";
import WireframeMaterialParams from "../types/material/wireframeMaterialParams";
import TexturePackMaterialParams from "../types/material/texturePackMaterialParams";

export const MaterialConstructorMap: { [materialType: string]:
    (params: MaterialParams) => Promise<THREE.Material> } =
{
    "TexturePack": async (params: MaterialParams) =>
    {
        const p = params as TexturePackMaterialParams;
        switch (p.textureLoadType)
        {
            case "staticImageFromURL":
                return createTexturePackMaterial(
                    await TextureFactory.loadStaticImageTexture(p.textureId),
                    p.textureWidth, p.textureHeight, p.textureGridCellWidth, p.textureGridCellHeight
                );
            case "dynamicEmpty":
                return createTexturePackMaterial(
                    TextureFactory.loadDynamicEmptyTexture(p.textureId, p.textureWidth, p.textureHeight),
                    p.textureWidth, p.textureHeight, p.textureGridCellWidth, p.textureGridCellHeight
                );
            default:
                throw new Error(`Unknown texture load type :: "${p.textureLoadType}"`);
        }
    },
    "Wireframe": async (params: MaterialParams) =>
    {
        const p = params as WireframeMaterialParams;
        const newMaterial = new THREE.MeshBasicMaterial({ color: p.colorHex, wireframe: true });
        return newMaterial;
    },
}

function createTexturePackMaterial(texture: THREE.Texture,
    textureWidth: number, textureHeight: number,
    textureGridCellWidth: number, textureGridCellHeight: number): THREE.Material
{
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;

    const pixelBleedingPreventionScales = [
        (textureGridCellWidth - 1) / textureGridCellWidth,
        (textureGridCellHeight - 1) / textureGridCellHeight,
    ];
    const textureGridCellScales = [
        textureGridCellWidth / textureWidth,
        textureGridCellHeight / textureHeight,
    ];
    const uvScales = [
        textureGridCellScales[0] * pixelBleedingPreventionScales[0],
        textureGridCellScales[1] * pixelBleedingPreventionScales[1],
    ];

    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec2 uvStart;
            ${shader.vertexShader}
        `;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <uv_vertex>",
            `
            #include <uv_vertex>
            vMapUv = uvStart + vec2(${uvScales[0].toFixed(7)} * vMapUv[0], ${uvScales[1].toFixed(7)} * vMapUv[1]);
            `
        );
    };
    return newMaterial;
}