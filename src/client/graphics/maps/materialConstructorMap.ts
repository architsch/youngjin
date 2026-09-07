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

// Which THREE.Material each of the game's material types is built out of, and what it is dressed in.
//
// **What a material looks like is not written here.** Everything a material does by rewriting
// three.js's own shader source lives in @src/client/graphics/shaders , one module per surface, and
// this map only says which of them a given type installs — so that adding a material is adding a
// file rather than growing this one.
//
// Two things about a material are decided here and nowhere else.
//
// **Which materials are lit**: a material wrapped in "addSampling" is one the room's own lamps reach
// (see LightBlockMap), and one left bare is either unlit by nature — a sprite, a gizmo's wireframe —
// or a source of light rather than a receiver of it.
//
// **Which materials stand in the room's air**: a material wrapped in "addFogNoise" fades into the
// same drifting haze the sky is painted with, rather than into a flat color (see
// AtmosphereMaterialUtil). Everything that is part of the room is; the gizmos are not, being drawn
// over the world rather than in it.
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
            texture = TextureFactory.loadDynamicEmptyTexture(p.texturePath, p.textureWidth,
                p.textureHeight, p.transparent, p.filterType);
            break;
        default:
            throw new Error(`Unknown texture load type :: "${p.textureLoadType}"`);
    }

    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;
    // Depth *testing* stays on either way, so a see-through quad is still hidden by whatever stands
    // in front of it — which is the whole point of writing text into the world rather than over it.
    // What is turned off is depth writing, since a quad that is mostly nothing would otherwise mask
    // what is behind it. These quads are small and never overlap one another, so nothing turns on
    // the order they are drawn in.
    newMaterial.transparent = p.transparent;
    newMaterial.depthWrite = !p.transparent;
    if (p.polygonOffsetFactor && p.polygonOffsetUnits)
    {
        newMaterial.polygonOffset = true;
        newMaterial.polygonOffsetFactor = p.polygonOffsetFactor;
        newMaterial.polygonOffsetUnits = p.polygonOffsetUnits;
    }

    // Worked out once here rather than on compilation, so that everything the shader is built from
    // is settled before the material exists (see ShaderPrecompileUtil).
    const uvScales = getUVScales(p.textureWidth, p.textureHeight,
        p.textureGridCellWidth, p.textureGridCellHeight);
    newMaterial.onBeforeCompile = (shader) =>
        installInstancedTexturePackShader(shader, uvScales, p.outlineColorHex);
    return newMaterial;
}

function createInstancedColorMaterial(p: InstancedColorMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.transparent = false;
    newMaterial.onBeforeCompile = installInstanceColorShader;
    return newMaterial;
}

// The finish of something that gives off light rather than receiving it: an unlit material, drawn at
// the full strength of its own per-instance color whatever is falling on it — which is what a lamp's
// lit face, a glowing filament or a screen actually looks like.
//
// Deliberately not given the block map's sampling (see MaterialConstructorMap's own note): a lamp's
// emitter is where the room's light comes from, and lighting it by the field it is itself filling
// would have it brighten in its own glow.
function createInstancedEmissiveMaterial(p: InstancedEmissiveMaterialParams): THREE.Material
{
    const newMaterial = new THREE.MeshBasicMaterial();
    newMaterial.transparent = false;
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

// The whole of what the two plain instanced materials do to their shader: take the color the
// instance was given (see the snippet's own note for why three.js does not).
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
