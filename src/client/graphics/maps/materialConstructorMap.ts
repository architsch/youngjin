import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import MaterialParams from "../types/material/materialParams";
import WireframeMaterialParams from "../types/material/wireframeMaterialParams";
import InstancedTexturePackMaterialParams from "../types/material/instancedTexturePackMaterialParams";
import LineBasicMaterialParams from "../types/material/lineBasicMaterialParams";
import TextureMaterialParams from "../types/material/textureMaterialParams";
import SpriteMaterialParams from "../types/material/spriteMaterialParams";
import InstancedColorMaterialParams from "../types/material/instancedColorMaterialParams";
import InstancedEyeMaterialParams from "../types/material/instancedEyeMaterialParams";

export const MaterialConstructorMap: { [materialType: string]:
    (params: MaterialParams) => Promise<THREE.Material> } =
{
    "InstancedTexturePack": async (params: MaterialParams) =>
    {
        return await createInstancedTexturePackMaterial(params as InstancedTexturePackMaterialParams);
    },
    "InstancedColor": async (params: MaterialParams) =>
    {
        return createInstancedColorMaterial(params as InstancedColorMaterialParams);
    },
    "InstancedEye": async (params: MaterialParams) =>
    {
        return createInstancedEyeMaterial(params as InstancedEyeMaterialParams);
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

async function createInstancedTexturePackMaterial(p: InstancedTexturePackMaterialParams): Promise<THREE.Material>
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

function createInstancedColorMaterial(p: InstancedColorMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    // Three.js folds the per-instance color (InstancedMesh.setColorAt) into vColor via the stock
    // color_vertex chunk, but its color_fragment chunk only tints diffuseColor when USE_COLOR is
    // defined (i.e. material.vertexColors). Apply the instance color here so it works on this
    // texture-less material without a per-vertex color attribute. The #ifdef makes this a no-op
    // for instanced meshes that never set an instance color.
    newMaterial.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            #ifdef USE_INSTANCING_COLOR
                diffuseColor.rgb *= vColor;
            #endif
            `
        );
    };
    return newMaterial;
}

function createInstancedEyeMaterial(p: InstancedEyeMaterialParams): THREE.Material
{
    // Renders each "Square" instance as an eyeball made of two concentric circles: the pupil
    // (which takes rendering priority) and the iris (hidden wherever the pupil covers it).
    // The per-instance colors and squared radii come from instanced buffer attributes written
    // by InstancedMeshBinding. The squared radii are expressed in the square's UV space, where
    // the distance from the center to an edge is 0.5. Fragments outside both circles are
    // discarded, and the surviving fragments write their circle's color into diffuseColor
    // before the stock lighting chunks run, so lighting still obeys the regular
    // MeshPhongMaterial rules.
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    newMaterial.side = THREE.DoubleSide; // The eye is an infinitely thin quad, so keep it visible from both sides.
    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec3 pupilColor;
            attribute vec3 irisColor;
            attribute vec2 eyeRadiiSqr;
            varying vec3 vPupilColor;
            varying vec3 vIrisColor;
            varying vec2 vEyeRadiiSqr;
            varying vec2 vEyeUv;
            ${shader.vertexShader}
        `;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `
            #include <begin_vertex>
            vPupilColor = pupilColor;
            vIrisColor = irisColor;
            vEyeRadiiSqr = eyeRadiiSqr;
            vEyeUv = uv;
            `
        );
        shader.fragmentShader = `
            varying vec3 vPupilColor;
            varying vec3 vIrisColor;
            varying vec2 vEyeRadiiSqr;
            varying vec2 vEyeUv;
            ${shader.fragmentShader}
        `;
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `
            #include <color_fragment>
            vec2 offsetFromEyeCenter = vEyeUv - vec2(0.5, 0.5);
            float eyeDistSqr = dot(offsetFromEyeCenter, offsetFromEyeCenter);
            if (eyeDistSqr < vEyeRadiiSqr[0])
                diffuseColor.rgb = vPupilColor;
            else if (eyeDistSqr < vEyeRadiiSqr[1])
                diffuseColor.rgb = vIrisColor;
            else
                discard;
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