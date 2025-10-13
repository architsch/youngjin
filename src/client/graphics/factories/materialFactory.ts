import * as THREE from "three";
import TextureFactory from "./textureFactory";

const loadedMaterials: { [materialId: string]: THREE.Material } = {};

const MaterialFactory =
{
    load: async (materialId: string): Promise<THREE.Material> =>
    {
        if (materialId.startsWith("Phong-"))
            return await loadTexturedPhongMaterial(materialId);
        else if (materialId.startsWith("Wire-"))
            return await loadWireframeMaterial(materialId);
        throw new Error(`Unknown material type (materialId = ${materialId})`);
    },
    unloadAll: (): void =>
    {
        const idsTemp: string[] = [];
        for (const id of Object.keys(loadedMaterials))
            idsTemp.push(id);
        for (const id of idsTemp)
            MaterialFactory.unload(id);
    },
    unload: (materialId: string): void =>
    {
        const material = loadedMaterials[materialId];
        if (material == undefined)
        {
            console.error(`Material is already unloaded (materialId = ${materialId})`);
            return;
        }
        material.dispose();
        delete loadedMaterials[materialId];
    },
}

// materialId format = "Phong-[textureId]"
async function loadTexturedPhongMaterial(materialId: string): Promise<THREE.Material>
{
    const loadedMaterial = loadedMaterials[materialId];
    if (loadedMaterial != undefined)
        return loadedMaterial;

    // 6 = length of "Phong-"
    const texture = await TextureFactory.load(materialId.substring(6));
    const newMaterial = new THREE.MeshPhongMaterial();
    newMaterial.map = texture;

    const pixelBleedingPreventionScale = 127 / 128;
    const textureGridCellScale = 0.125;
    const uvScale = textureGridCellScale * pixelBleedingPreventionScale;

    newMaterial.onBeforeCompile = (shader) => {
        shader.vertexShader = `
            attribute vec2 uvStart;
            ${shader.vertexShader}
        `;
        shader.vertexShader = shader.vertexShader.replace(
            "#include <uv_vertex>",
            `
            #include <uv_vertex>
            vMapUv = uvStart + ${uvScale.toFixed(7)} * vMapUv;
            `
        );
    };

    loadedMaterials[materialId] = newMaterial;
    return newMaterial;
}

// materialId format = "Wire-[colorHex]"
async function loadWireframeMaterial(materialId: string): Promise<THREE.Material>
{
    const loadedMaterial = loadedMaterials[materialId];
    if (loadedMaterial != undefined)
        return loadedMaterial;

    // 5 = length of "Wire-"
    const newMaterial = new THREE.MeshBasicMaterial({ color: materialId.substring(5), wireframe: true });

    loadedMaterials[materialId] = newMaterial;
    return newMaterial;
}

export default MaterialFactory;