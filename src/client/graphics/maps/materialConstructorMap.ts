import * as THREE from "three";
import TextureFactory from "../factories/textureFactory";
import MaterialParams from "../../../shared/graphics/material/types/materialParams";
import WireframeMaterialParams from "../../../shared/graphics/material/types/wireframeMaterialParams";
import InstancedTexturePackMaterialParams from "../../../shared/graphics/material/types/instancedTexturePackMaterialParams";
import LineBasicMaterialParams from "../../../shared/graphics/material/types/lineBasicMaterialParams";
import SpriteMaterialParams from "../../../shared/graphics/material/types/spriteMaterialParams";
import InstancedColorMaterialParams from "../../../shared/graphics/material/types/instancedColorMaterialParams";
import InstancedTinMaterialParams from "../../../shared/graphics/material/types/instancedTinMaterialParams";
import InstancedWoodMaterialParams from "../../../shared/graphics/material/types/instancedWoodMaterialParams";
import InstancedEmissiveMaterialParams from "../../../shared/graphics/material/types/instancedEmissiveMaterialParams";
import LightBlockMapMaterialUtil from "../light/util/lightBlockMapMaterialUtil";
import AtmosphereMaterialUtil from "../util/atmosphereMaterialUtil";
import INSTANCE_COLOR_FRAGMENT_GLSL from "../shaders/instanceColorGLSL";
import installInstancedTexturePackShader, { getUVScales }
    from "../shaders/instancedTexturePackShader";
import installInstancedTinShader, { applyInstancedTinMaterialProperties }
    from "../shaders/instancedTinShader";
import installInstancedWoodShader, { applyInstancedWoodMaterialProperties }
    from "../shaders/instancedWoodShader";

// Material type -> THREE.Material. Shader code lives in @src/client/graphics/shaders (one module per
// surface). "addSampling" = lit by room lamps (see LightBlockMap); "addFogNoise" = stands in the
// room's air (see AtmosphereMaterialUtil). Gizmos get neither.
export const MaterialConstructorMap: { [materialType: string]:
    (params: MaterialParams) => Promise<THREE.Material> } =
{
    "InstancedTexturePack": async (params: MaterialParams) =>
    {
        return AtmosphereMaterialUtil.addFogNoise(LightBlockMapMaterialUtil.addSampling(
            await createInstancedTexturePackMaterial(params as InstancedTexturePackMaterialParams)));
    },
    "InstancedColor": async (params: MaterialParams) =>
    {
        return AtmosphereMaterialUtil.addFogNoise(LightBlockMapMaterialUtil.addSampling(
            createInstancedColorMaterial(params as InstancedColorMaterialParams)));
    },
    "InstancedTin": async (params: MaterialParams) =>
    {
        return AtmosphereMaterialUtil.addFogNoise(LightBlockMapMaterialUtil.addSampling(
            createInstancedTinMaterial(params as InstancedTinMaterialParams)));
    },
    "InstancedWood": async (params: MaterialParams) =>
    {
        return AtmosphereMaterialUtil.addFogNoise(LightBlockMapMaterialUtil.addSampling(
            createInstancedWoodMaterial(params as InstancedWoodMaterialParams)));
    },
    "InstancedEmissive": async (params: MaterialParams) =>
    {
        return AtmosphereMaterialUtil.addFogNoise(
            createInstancedEmissiveMaterial(params as InstancedEmissiveMaterialParams));
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
        {
            const format = p.coverageOnly ? THREE.RedFormat
                : (p.transparent || p.alphaCutout) ? THREE.RGBAFormat : THREE.RGBFormat;
            texture = TextureFactory.loadDynamicEmptyTexture(p.texturePath, p.textureWidth,
                p.textureHeight, format, p.filterType);
            break;
        }
        default:
            throw new Error(`Unknown texture load type :: "${p.textureLoadType}"`);
    }

    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;
    // Transparent quads still depth-test (so walls occlude in-world text) but don't write depth.
    // They never overlap each other, so draw order doesn't matter.
    newMaterial.transparent = p.transparent;
    newMaterial.depthWrite = !p.transparent;
    if (p.alphaCutout)
        newMaterial.alphaTest = 0.5;
    if (p.polygonOffsetFactor && p.polygonOffsetUnits)
    {
        newMaterial.polygonOffset = true;
        newMaterial.polygonOffsetFactor = p.polygonOffsetFactor;
        newMaterial.polygonOffsetUnits = p.polygonOffsetUnits;
    }

    // Computed before compilation so the shader inputs are fixed (see ShaderPrecompileUtil).
    const uvScales = getUVScales(p.textureWidth, p.textureHeight,
        p.textureGridCellWidth, p.textureGridCellHeight);
    newMaterial.onBeforeCompile = (shader) =>
        installInstancedTexturePackShader(shader, uvScales, p.outlineColorHex, p.coverageOnly);
    return newMaterial;
}

function createInstancedColorMaterial(p: InstancedColorMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    newMaterial.onBeforeCompile = installInstanceColorShader;
    return newMaterial;
}

// Unlit, full-strength instance color for light emitters. Not lamp-lit, or it would brighten in its
// own glow.
function createInstancedEmissiveMaterial(p: InstancedEmissiveMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshBasicMaterial();
    newMaterial.transparent = false;
    // Beyond the wood's (see instancedWoodShader), so a lamp's glow stays in front of its board: at
    // oblique angles the board's offset outgrows the real gap between them.
    newMaterial.polygonOffset = true;
    newMaterial.polygonOffsetFactor = -2;
    newMaterial.polygonOffsetUnits = -2;
    newMaterial.onBeforeCompile = installInstanceColorShader;
    return newMaterial;
}

function createInstancedTinMaterial(p: InstancedTinMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshPhongMaterial();
    applyInstancedTinMaterialProperties(newMaterial);
    newMaterial.onBeforeCompile = installInstancedTinShader;
    return newMaterial;
}

function createInstancedWoodMaterial(p: InstancedWoodMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshPhongMaterial();
    applyInstancedWoodMaterialProperties(newMaterial);
    newMaterial.onBeforeCompile = installInstancedWoodShader;
    return newMaterial;
}

// Applies the per-instance color (see instanceColorGLSL).
function installInstanceColorShader(shader: THREE.WebGLProgramParametersWithUniforms)
{
    shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `
        #include <color_fragment>
        ${INSTANCE_COLOR_FRAGMENT_GLSL}
        `
    );
}
